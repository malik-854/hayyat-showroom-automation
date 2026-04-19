import { google } from 'googleapis';

export default async function handler(request, response) {
  try {
    // 1. Initialize Google Auth (Same as your Cron job)
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Fetch the catalog from your Sheet
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.CATALOG_SHEET_ID,
      range: 'Sheet1!A2:I100', // Skip header; Col I = angle_views (4 URLs from grid slicer)
    });

    const rows = sheetRes.data.values;

    if (!rows) {
      return response.status(200).json([]);
    }

    // 3. Map the raw Google Sheet rows into clean Website JSON
    const products = rows.map((row) => {
      const finishedImageRaw = row[3] || '';
      const gridLink = row[8] || '';

      // Fallback: If no AI renders exist (Col D), use the grid link (Col I) as the main image
      const finishedImage = finishedImageRaw || gridLink;
      const isGridFallback = !finishedImageRaw && !!gridLink;

      return {
        id: row[0],
        name: row[1],
        rawImage: row[2],
        finishedImage: finishedImage, 
        isGridFallback: isGridFallback,
        styleNames: row[4] ? row[4].split(',').map(s => s.trim()) : [],
        description: row[5],
        price: row[6],
        status: row[7],
        angleViews: gridLink ? gridLink.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
    });

    // Cache the response for 60 seconds on Vercel's edge to keep it fast
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(products);

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Failed to fetch live inventory.' });
  }
}
