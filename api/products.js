import { google } from 'googleapis';

export default async function handler(request, response) {
  try {
    // 1. Initialize Google Auth
    const privateKey  = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Fetch the catalog
    // Col: A=SkeletonID  B=Category  C=ProductName  D=Skeleton
    //      E=Renders     F=Styles    G=Desc          H=Price
    //      I=Status      J=Grids     K=Videos        L=Tag
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.CATALOG_SHEET_ID,
      range: 'Sheet1!A2:L200',
    });

    const rows = sheetRes.data.values;
    if (!rows) return response.status(200).json([]);

    // 3. Map rows → clean JSON
    const products = rows.map((row) => {
      const finishedImageRaw = row[4] || '';
      const gridLink         = row[9] || '';

      // If no AI renders exist (Col E), fall back to the grid image (Col J)
      const finishedImage  = finishedImageRaw || gridLink;
      const isGridFallback = !finishedImageRaw && !!gridLink;

      return {
        id:           row[0]  || '',   // A: SkeletonID  e.g. "Chair7X2"
        category:     row[1]  || '',   // B: Category    e.g. "Chair"
        productName:  row[2]  || '',   // C: ProductName e.g. "The Azure Scandi"
        // `name` is the primary display label for the card / product page
        name:         row[2]  || row[1] || row[0] || '',
        rawImage:     row[3]  || '',   // D: Skeleton image
        finishedImage,                 // E (or J fallback)
        isGridFallback,
        styleNames:   row[5]  ? row[5].split(',').map(s => s.trim())  : [],  // F
        description:  row[6]  || '',   // G
        price:        row[7]  || '',   // H
        status:       row[8]  || '',   // I
        angleViews:   gridLink ? gridLink.split(',').map(s => s.trim()).filter(Boolean) : [],  // J
        videos:       row[10] ? row[10].split(',').map(s => s.trim()) : [],  // K
        tag:          row[11] ? row[11].trim() : '',  // L: e.g. "New", "Best", "Sale"
      };
    });

    // Cache for 60 s on Vercel edge
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return response.status(200).json(products);

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: 'Failed to fetch live inventory.' });
  }
}
