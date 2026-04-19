import { google } from 'googleapis';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

export default async function handler(request, response) {
  const isValidAuthHeader = request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isValidQuerySecret = request.query.secret === process.env.CRON_SECRET;

  if (!isValidAuthHeader && !isValidQuerySecret && process.env.VERCEL_ENV === 'production') {
    return response.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('--- STARTING AUTONOMOUS VERCEL CRON ---');

    // 1. Initialize Google Auth from Environment Variables (Not local JSON)
    // Note: On Vercel, store your Private Key with \n characters properly escaped.
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

    const auth = new google.auth.GoogleAuth({
      credentials: { 
        client_email: clientEmail, 
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim()
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 2. Query Google Drive for new skeletons inside the last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const driveRes = await drive.files.list({
      q: `'${process.env.SKELETON_FOLDER_ID}' in parents and modifiedTime > '${oneHourAgo}' and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });

    const newFiles = driveRes.data.files;
    
    if (!newFiles || newFiles.length === 0) {
      console.log('No new files detected in the last hour.');
      return response.status(200).json({ message: 'Success', processed: 0 });
    }

    // 3. Initialize Firebase (Check prevents crash on Vercel warm-starts)
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.GOOGLE_PROJECT_ID,
          clientEmail, 
          privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim()
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }
    const bucket = admin.storage().bucket();
    const sheets = google.sheets({ version: 'v4', auth });

    // 4. Process Loop
    const styles = ['Walnut and Cream', 'Oak and Forest Green', 'Matte Black and Tan'];
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('CRITICAL: GEMINI_API_KEY is missing in Vercel environment.');
    }
    
    for (const skeleton of newFiles) {
      console.log(`Processing New Upload: ${skeleton.name}`);
      
      const firebaseSignedUrls = [];

      // Initialize Gemini SDK
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Loop through styles to generate images
      for (let i = 0; i < styles.length; i++) {
        const style = styles[i];
        const fileName = `${skeleton.id}-${i}.png`;
        
        console.log(`[Generating] Image variant via Imagen: ${style}`);
        
        try {
          // 4A. Call GoogleGenAI Imagen model
          const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `A high-end luxury furniture piece in the style of ${style}. Minimalist boutique furniture showroom with cinematic lighting, architectural digest style.`,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/png",
              aspectRatio: "1:1"
            }
          });
          
          const base64Str = response.generatedImages[0].image.imageBytes;
          const imageBuffer = Buffer.from(base64Str, 'base64');

          // 4B. Upload the physical buffer to Firebase using await
          console.log(`Uploading ${fileName} to Firebase...`);
          const fileRef = bucket.file(`renders/${fileName}`);
          await fileRef.save(imageBuffer, {
            metadata: { contentType: 'image/png' }
          });
          
          firebaseSignedUrls.push(`https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_STORAGE_BUCKET}/o/renders%2F${fileName}?alt=media`);
          console.log(`[Uploaded] ${fileName}`);
        } catch (genError) {
          console.error(`Failed to generate/upload variant ${style}:`, genError.message);
          firebaseSignedUrls.push(`GENERATION_ERROR: ${genError.message.replace(/,/g, '_')}`);
        }
      }

      // 5. Append to Google Sheets
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[
          `SKEL-${Date.now()}`,
          'Autonomously Detected',
          `https://drive.google.com/file/d/${skeleton.id}/view`,
          firebaseSignedUrls.join(','),
          `Luxury Variant Series: ${skeleton.name}`,
          'Processed automatically by Vercel Cron. Features High-End Finishes.',
          'Price TBD',
          'Live'
        ]]}
      });
    }

    return response.status(200).json({ message: 'Success', processed: newFiles.length });

  } catch (error) {
    console.error('CRON ERROR:', error);
    return response.status(500).json({ error: error.message });
  }
}
