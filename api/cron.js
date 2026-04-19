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
        productsMap[prefix] = { id: prefix, name: prefix, skeleton: null, variants: [], grid: null };
      }

      if (file.name.toLowerCase().includes('_skeleton')) {
        productsMap[prefix].skeleton = file.webViewLink;
      } else if (file.name.toLowerCase().includes('_ai')) {
        const styleName = parts.slice(2).join(' ').split('.')[0]; 
        productsMap[prefix].variants.push({
          url: file.webViewLink,
          style: styleName || 'Luxury Variant'
        });
      } else if (file.name.toLowerCase().includes('_grid')) {
        // New: Detect the 4-angle grid image
        productsMap[prefix].grid = file.webViewLink;
      }
    });

    // 4. SYNC TO GOOGLE SHEET
    const productsToSync = Object.values(productsMap).filter(p => p.skeleton && (p.variants.length > 0 || p.grid));
    
    if (productsToSync.length === 0) {
      return response.status(200).json({ message: 'No complete sets found', processed: 0 });
    }

    // Get current sheet data to prevent duplicates
    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.CATALOG_SHEET_ID,
      range: 'Sheet1!A:A',
    });
    const existingIds = (currentSheet.data.values || []).map(row => row[0]);

    const newRows = [];
    for (const prod of productsToSync) {
      if (!existingIds.includes(prod.id)) {
        newRows.push([
          prod.id,
          prod.name.replace(/-/g, ' '), 
          prod.skeleton,
          prod.variants.map(v => v.url).join(','),
          prod.variants.map(v => v.style).join(','),
          `High-end ${prod.name} with custom artisan variations.`,
          'Price TBD',
          'Live',
          prod.grid || '' // Column I: The Multi-Angle Grid link
        ]);
      }
    }

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:I',
        valueInputOption: 'USER_ENTERED',
        resource: { values: newRows }
      });
    }

    return response.status(200).json({ 
      message: 'Sync Complete', 
      processed: newRows.length,
      detected_groups: Object.keys(productsMap).length 
    });

  } catch (error) {
    console.error('CRON ERROR:', error);
    return response.status(500).json({ error: error.message });
  }
}
