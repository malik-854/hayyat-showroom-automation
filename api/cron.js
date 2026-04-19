import { google } from 'googleapis';
import admin from 'firebase-admin';
import { VertexAI } from '@google-cloud/vertexai';

export default async function handler(request, response) {
  const isValidAuthHeader = request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isValidQuerySecret = request.query.secret === process.env.CRON_SECRET;

  if (!isValidAuthHeader && !isValidQuerySecret && process.env.VERCEL_ENV === 'production') {
    return response.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('--- STARTING AUTONOMOUS VERCEL CRON ---');

    // Utility for formatted private key
    const getPrivateKey = () => (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
    const privateKey = getPrivateKey();
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const projectId = process.env.GOOGLE_PROJECT_ID;

    // 1. Initialize Google Auth for Sheets/Drive
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/cloud-platform'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 2. Query Google Drive - Simplified to ensure NO files are missed
    const driveRes = await drive.files.list({
      q: `'${process.env.SKELETON_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });

    const allFiles = driveRes.data.files;
    const newFiles = allFiles.filter(f => f.mimeType.includes('image/'));
    const textFiles = allFiles.filter(f => f.mimeType.includes('text/plain') || f.name.endsWith('.txt'));
    
    if (!newFiles || newFiles.length === 0) {
      console.log('No images found in folder:', process.env.SKELETON_FOLDER_ID);
      return response.status(200).json({ message: 'Success', processed: 0, scanned: allFiles.length });
    }

    // 3. Initialize Firebase
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }
    const bucket = admin.storage().bucket();
    const sheets = google.sheets({ version: 'v4', auth });

    // 4. Initialize Vertex AI for Generation
    const vertexAI = new VertexAI({
      project: projectId,
      location: 'us-central1',
      googleAuthOptions: {
        credentials: { client_email: clientEmail, private_key: privateKey }
      }
    });
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'imagen-3.0-generate-002',
    });

    for (const skeleton of newFiles) {
      const firebaseSignedUrls = [];
      const fileName = `${skeleton.id}-variation.png`;
      
      // A. Try to find custom instructions in a .txt file with similar name
      let stylePrompt = "High-end luxury furniture with premium finishes and cinematic showroom lighting.";
      const baseName = skeleton.name.split('.')[0];
      const matchingTxt = textFiles.find(t => t.name.startsWith(baseName));

      if (matchingTxt) {
        console.log(`Found custom instructions in ${matchingTxt.name}`);
        const txtRes = await drive.files.get({ fileId: matchingTxt.id, alt: 'media' });
        stylePrompt = txtRes.data.toString();
      }

      console.log(`Generating Single Luxury Variant for: ${skeleton.name}`);
      
      try {
        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`;
        const accessToken = await auth.getAccessToken();

        const predictionResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{ prompt: stylePrompt }],
            parameters: { sampleCount: 1 }
          })
        });

        if (!predictionResponse.ok) {
          const errData = await predictionResponse.json();
          throw new Error(errData.error?.message || 'Prediction failed');
        }

        const data = await predictionResponse.json();
        const base64Str = data.predictions[0].bytesBase64Encoded;
        const imageBuffer = Buffer.from(base64Str, 'base64');
        const fileRef = bucket.file(`renders/${fileName}`);
        await fileRef.save(imageBuffer, { metadata: { contentType: 'image/png' } });
        
        firebaseSignedUrls.push(`https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_STORAGE_BUCKET}/o/renders%2F${fileName}?alt=media`);
      } catch (genError) {
        firebaseSignedUrls.push(`GENERATION_ERROR: ${genError.message.replace(/,/g, '_')}`);
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[
          `SKEL-${Date.now()}`,
          skeleton.name.split('.')[0],
          `https://drive.google.com/file/d/${skeleton.id}/view`,
          firebaseSignedUrls[0] || 'FAILED',
          'Luxury Original',
          'Processed automatically by Vertex AI.',
          'Price TBD',
          'Live'
        ]]}
      });
    }

    return response.status(200).json({ message: 'Success', processed: newFiles.length });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
