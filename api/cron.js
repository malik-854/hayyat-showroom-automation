import { google } from 'googleapis';

export default async function handler(request, response) {
  const isValidAuthHeader = request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isValidQuerySecret = request.query.secret === process.env.CRON_SECRET;

  if (!isValidAuthHeader && !isValidQuerySecret && process.env.VERCEL_ENV === 'production') {
    return response.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    // 1. Initialize Google Auth
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Scan for ALL files in the skeleton folder
    const driveRes = await drive.files.list({
      q: `'${process.env.SKELETON_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
    });

    const allFiles = driveRes.data.files;
    if (!allFiles || allFiles.length === 0) {
      return response.status(200).json({ message: 'Folder is empty', processed: 0 });
    }

    // 3. GROUPING LOGIC: Group files by their prefix (everything before the first '_')
    const productsMap = {};

    allFiles.forEach(file => {
      const parts = file.name.split('_');
      const prefix = parts[0]; 
      
      if (!productsMap[prefix]) {
        productsMap[prefix] = { id: prefix, name: prefix, skeleton: null, variants: [], globalGrid: null, variantGrids: {}, variantVideos: {} };
      }

      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.includes('_skeleton')) {
        productsMap[prefix].skeleton = file.webViewLink;
      } else if (fileNameLower.includes('_ai')) {
        // Robust check for grids (including common typos) and 360 videos
        const isGrid  = fileNameLower.includes('_grid') || fileNameLower.includes('_gird');
        const isVideo = fileNameLower.includes('_360');

        // Clean up the style name:
        // 1. Remove the prefix and '_Ai_'
        // 2. Remove '_grid', '_gird', '_360', or file extension
        let styleName = file.name.split(/_ai_/i)[1] || '';
        styleName = styleName.split(/\.(?=[^.]*$)/)[0]; // Remove extension
        styleName = styleName.replace(/_grid/i, '').replace(/_gird/i, '').replace(/_360/i, '').replace(/_/g, ' ').trim();

        if (isGrid) {
            if (!productsMap[prefix].variantGrids) productsMap[prefix].variantGrids = {};
            productsMap[prefix].variantGrids[styleName] = file.webViewLink;
        } else if (isVideo) {
            if (!productsMap[prefix].variantVideos) productsMap[prefix].variantVideos = {};
            productsMap[prefix].variantVideos[styleName] = file.webViewLink;
        } else {
            productsMap[prefix].variants.push({
              url: file.webViewLink,
              style: styleName || 'Luxury Variant'
            });
        }
      } else if (fileNameLower.includes('_grid') || fileNameLower.includes('_gird')) {
        productsMap[prefix].globalGrid = file.webViewLink;
      }
    });

    // 4. UPSERT TO GOOGLE SHEET (update existing rows OR append new ones)
    const productsToSync = Object.values(productsMap).filter(p => p.skeleton && (p.variants.length > 0 || p.globalGrid));

    if (productsToSync.length === 0) {
      return response.status(200).json({ message: 'No complete sets found', processed: 0 });
    }

    // Fetch full sheet to know both existing IDs AND their row numbers
    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.CATALOG_SHEET_ID,
      range: 'Sheet1!A:J',
    });
    const existingRows = currentSheet.data.values || [];

    // Build a map of { productId -> sheetRowIndex (1-based, accounting for header) }
    // Row 1 = header, Row 2 = first data row (index 0 in the array = header)
    const idToRowNumber = {};
    existingRows.forEach((row, idx) => {
      if (row[0]) idToRowNumber[row[0]] = idx + 1; // +1 because sheets are 1-based
    });

    const newRows    = []; // Products to append (brand new)
    const updateData = []; // Products to update in-place

    for (const prod of productsToSync) {
      // Build the data columns we control (C, D, E, I, J)
      // We deliberately skip B (name), F (description), G (price), H (status)
      // so any manual edits you make in the sheet are preserved.
      const assignedGrids = prod.variants.map(v => {
        const variantGrid = prod.variantGrids && prod.variantGrids[v.style];
        return variantGrid || prod.globalGrid || '';
      });
      const assignedVideos = prod.variants.map(v => {
        return (prod.variantVideos && prod.variantVideos[v.style]) || '';
      });

      const finalGridString  = assignedGrids.length  > 0 ? assignedGrids.join(',')  : (prod.globalGrid || '');
      const finalVideoString = assignedVideos.length > 0 ? assignedVideos.join(',') : '';

      const existingRowNum = idToRowNumber[prod.id];

      if (existingRowNum) {
        // ── UPDATE: overwrite only the Drive-sourced columns ──────────────────
        // Col A=id, C=skeleton, D=renders, E=styles, I=grids, J=videos
        // Col B, F, G, H are left untouched (manual fields)
        updateData.push({
          range: `Sheet1!A${existingRowNum}:J${existingRowNum}`,
          values: [[
            prod.id,                                    // A: id
            prod.name.replace(/-/g, ' '),               // B: name (refresh from filename)
            prod.skeleton,                              // C: skeleton
            prod.variants.map(v => v.url).join(','),    // D: renders
            prod.variants.map(v => v.style).join(','),  // E: style names
            existingRows[existingRowNum - 1][5] || `High-end ${prod.name} with custom artisan variations.`, // F: description (preserve if set)
            existingRows[existingRowNum - 1][6] || 'Price TBD',  // G: price (preserve)
            existingRows[existingRowNum - 1][7] || 'Live',       // H: status (preserve)
            finalGridString,                            // I: grids
            finalVideoString,                           // J: videos
          ]],
        });
      } else {
        // ── INSERT: brand-new product, append to sheet ────────────────────────
        newRows.push([
          prod.id,
          prod.name.replace(/-/g, ' '),
          prod.skeleton,
          prod.variants.map(v => v.url).join(','),
          prod.variants.map(v => v.style).join(','),
          `High-end ${prod.name} with custom artisan variations.`,
          'Price TBD',
          'Live',
          finalGridString,
          finalVideoString,
        ]);
      }
    }

    // Execute updates (batch all in one API call)
    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        },
      });
    }

    // Append new rows
    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:J',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows },
      });
    }

    return response.status(200).json({
      message: 'Sync Complete',
      updated:  updateData.length,
      inserted: newRows.length,
      processed: updateData.length + newRows.length,
      detected_groups: Object.keys(productsMap).length,
    });

  } catch (error) {
    console.error('CRON ERROR:', error);
    return response.status(500).json({ error: error.message });
  }
}
