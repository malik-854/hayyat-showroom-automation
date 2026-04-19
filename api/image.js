import { google } from 'googleapis';

export default async function handler(request, response) {
  const { id } = request.query;

  if (!id) return response.status(400).send('Image ID required');

  try {
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Fetch the raw media from Google Drive using the service account
    const driveRes = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    // Set the correct content type (usually image/jpeg or image/png)
    response.setHeader('Content-Type', 'image/jpeg');
    // Cache the image for 1 hour to keep the site fast
    response.setHeader('Cache-Control', 'public, max-age=3600');
    
    return response.send(Buffer.from(driveRes.data));

  } catch (error) {
    console.error('Image Proxy Error:', error);
    return response.status(500).send('Error loading image');
  }
}
