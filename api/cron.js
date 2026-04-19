import { google } from 'googleapis';

// Generate a 3-character alphanumeric suffix, e.g. "7X2"
function randomSuffix() {
  return Math.random().toString(36).substring(2, 5).toUpperCase();
}

// ─── Filename parser ────────────────────────────────────────────────────────
// New format: Category_ProductName_Type.ext
//   e.g.  Chair_The Azure Scandi_skeleton.jpg
//         Chair_The Azure Scandi_Ai_Walnut.jpg
//         Chair_The Azure Scandi_Ai_Walnut_grid.jpg
//         Chair_The Azure Scandi_Ai_Walnut_360.mp4
//
// Returns { category, productName, typeStr }
// typeStr is the raw suffix after `Category_ProductName_`, lowercased.
function parseFilename(filename) {
  // Strip extension
  const noExt = filename.replace(/\.[^/.]+$/, '');
  const parts  = noExt.split('_');

  if (parts.length < 3) {
    // Old format fallback: treat entire prefix as category, no productName
    return { category: parts[0] || 'Unknown', productName: '', typeStr: parts.slice(1).join('_').toLowerCase() };
  }

  const category    = parts[0];                  // "Chair"
  const productName = parts[1];                  // "The Azure Scandi"  (may have spaces — Drive replaces with spaces but filenames keep underscores, so we restore below)
  const typeStr     = parts.slice(2).join('_').toLowerCase(); // "skeleton" | "ai_walnut" | "ai_walnut_grid" | "ai_walnut_360"

  return {
    category:    category.replace(/-/g, ' ').trim(),
    productName: productName.replace(/-/g, ' ').trim(),
    typeStr,
  };
}

export default async function handler(request, response) {
  const isValidAuthHeader = request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isValidQuerySecret = request.query.secret === process.env.CRON_SECRET;

  if (!isValidAuthHeader && !isValidQuerySecret && process.env.VERCEL_ENV === 'production') {
    return response.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    // 1. Initialize Google Auth
    const privateKey   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const clientEmail  = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const drive  = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Scan ALL files in the skeleton folder
    const driveRes = await drive.files.list({
      q: `'${process.env.SKELETON_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
    });

    const allFiles = driveRes.data.files;
    if (!allFiles || allFiles.length === 0) {
      return response.status(200).json({ message: 'Folder is empty', processed: 0 });
    }

    // 3. GROUP files by "Category_ProductName" key
    //    e.g. all "Chair_The Azure Scandi_*" files → one product
    const productsMap = {};

    allFiles.forEach(file => {
      const { category, productName, typeStr } = parseFilename(file.name);

      // Grouping key = "Category|ProductName"
      const groupKey = `${category}|${productName}`;

      if (!productsMap[groupKey]) {
        productsMap[groupKey] = {
          groupKey,
          category,
          productName,
          skeleton:      null,
          variants:      [],
          variantGrids:  {},
          variantVideos: {},
          globalGrid:    null,
        };
      }

      const prod = productsMap[groupKey];

      if (typeStr === 'skeleton') {
        prod.skeleton = file.webViewLink;

      } else if (typeStr.startsWith('ai')) {
        // typeStr examples: "ai_walnut"  |  "ai_walnut_grid"  |  "ai_walnut_360"
        const isGrid  = typeStr.includes('_grid') || typeStr.includes('_gird');
        const isVideo = typeStr.includes('_360');

        // Style name = everything after "ai_", minus _grid/_gird/_360 suffixes
        let styleName = typeStr.replace(/^ai_/i, '');
        styleName = styleName.replace(/_grid$/i, '').replace(/_gird$/i, '').replace(/_360$/i, '');
        styleName = styleName.replace(/_/g, ' ').trim() || 'Luxury Variant';
        // Capitalise first letter of each word
        styleName = styleName.replace(/\b\w/g, c => c.toUpperCase());

        if (isGrid) {
          prod.variantGrids[styleName] = file.webViewLink;
        } else if (isVideo) {
          prod.variantVideos[styleName] = file.webViewLink;
        } else {
          prod.variants.push({ url: file.webViewLink, style: styleName });
        }

      } else if (typeStr.includes('grid') || typeStr.includes('gird')) {
        prod.globalGrid = file.webViewLink;
      }
    });

    // 4. Filter complete sets (need at least a skeleton + one render/grid)
    const productsToSync = Object.values(productsMap).filter(
      p => p.skeleton && (p.variants.length > 0 || p.globalGrid || Object.keys(p.variantGrids).length > 0)
    );

    if (productsToSync.length === 0) {
      return response.status(200).json({ message: 'No complete sets found', processed: 0 });
    }

    // 5. Fetch full sheet to build ID→rowNumber map
    //    Sheet columns:
    //    A=SkeletonID  B=Category  C=ProductName  D=Skeleton  E=Renders
    //    F=Styles      G=Desc      H=Price         I=Status    J=Grids  K=Videos
    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.CATALOG_SHEET_ID,
      range: 'Sheet1!A:K',
    });
    const existingRows = currentSheet.data.values || [];

    // Map: "Category|ProductName" → { rowNumber, existingId }
    // We match on B+C (category+productName) so updates survive ID regeneration
    const groupKeyToRow = {};
    existingRows.forEach((row, idx) => {
      if (row[0] && row[1] && row[2]) {
        const key = `${row[1]}|${row[2]}`; // category|productName
        groupKeyToRow[key] = { rowNumber: idx + 1, existingId: row[0] };
      }
    });

    const updateData = [];
    const newRows    = [];

    for (const prod of productsToSync) {
      // Build per-variant arrays (grids + videos aligned to variants)
      const assignedGrids = prod.variants.map(v => {
        return prod.variantGrids[v.style] || prod.globalGrid || '';
      });
      const assignedVideos = prod.variants.map(v => {
        return prod.variantVideos[v.style] || '';
      });

      const finalGridString  = assignedGrids.length  > 0 ? assignedGrids.join(',')  : (prod.globalGrid || '');
      const finalVideoString = assignedVideos.length > 0 ? assignedVideos.join(',') : '';

      const existingEntry = groupKeyToRow[prod.groupKey];

      if (existingEntry) {
        // ── UPDATE existing row in-place ───────────────────────────────────
        const r = existingEntry.rowNumber;
        const existingRowData = existingRows[r - 1];

        updateData.push({
          range: `Sheet1!A${r}:K${r}`,
          values: [[
            existingEntry.existingId,                                                      // A: keep existing ID
            prod.category,                                                                  // B: category
            prod.productName,                                                               // C: product name
            prod.skeleton,                                                                  // D: skeleton
            prod.variants.map(v => v.url).join(','),                                       // E: renders
            prod.variants.map(v => v.style).join(','),                                     // F: styles
            existingRowData[6] || `High-end ${prod.productName} by Hayyat Furnishes.`,    // G: description (preserve)
            existingRowData[7] || 'Price TBD',                                             // H: price (preserve)
            existingRowData[8] || 'Live',                                                   // I: status (preserve)
            finalGridString,                                                                // J: grids
            finalVideoString,                                                               // K: videos
          ]],
        });
      } else {
        // ── INSERT new row ─────────────────────────────────────────────────
        const newId = `${prod.category.replace(/\s+/g,'').substring(0,6)}${randomSuffix()}`;

        newRows.push([
          newId,
          prod.category,
          prod.productName,
          prod.skeleton,
          prod.variants.map(v => v.url).join(','),
          prod.variants.map(v => v.style).join(','),
          `High-end ${prod.productName} by Hayyat Furnishes.`,
          'Price TBD',
          'Live',
          finalGridString,
          finalVideoString,
        ]);
      }
    }

    // Execute batch update
    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        resource: { valueInputOption: 'USER_ENTERED', data: updateData },
      });
    }

    // Append new rows
    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:K',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows },
      });
    }

    return response.status(200).json({
      message:         'Sync Complete',
      updated:         updateData.length,
      inserted:        newRows.length,
      processed:       updateData.length + newRows.length,
      detected_groups: Object.keys(productsMap).length,
    });

  } catch (error) {
    console.error('CRON ERROR:', error);
    return response.status(500).json({ error: error.message });
  }
}
