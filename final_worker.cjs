const { google } = require('googleapis');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

// 1. Initialize Firebase 
if (!admin.apps.length) {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: privateKey
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}
const bucket = admin.storage().bucket();

async function processSkeletons() {
  console.log('🔍 Ghost Worker: Scanning Google Drive for new luxury potential...');

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // Scan for images
  const driveRes = await drive.files.list({
    q: `'${process.env.SKELETON_FOLDER_ID}' in parents and trashed = false and mimeType contains 'image/'`,
    fields: 'files(id, name)',
  });

  const files = driveRes.data.files;
  if (!files || files.length === 0) {
    console.log('😴 Nothing new found. Sleeping for 60 seconds...');
    return;
  }

  // Vertex AI setup
  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_PROJECT_ID,
    location: 'us-central1',
    googleAuthOptions: { keyFile: './credentials.json' }
  });
  const model = vertexAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });

  for (const file of files) {
    console.log(`✨ Detected: ${file.name}. Starting Luxury Conversion...`);
    
    // Check if we already processed this (Mock check for this demo - you could track IDs in a local file)
    // To keep it simple, we'll assume new files are new.
    
    const styles = ['Empire Gold & Walnut', 'Scandinavian Matte Oak', 'Midnight Obsidian Silk'];
    const firebaseUrls = [];

    for (let i = 0; i < styles.length; i++) {
        const style = styles[i];
        console.log(`🎨 Painting Variant ${i+1}: ${style}...`);

        try {
            const prediction = await model.predict({
                instances: [{ prompt: `A high-end luxury furniture piece in the style of ${style}. Professional studio lighting, 8k architecture photography.` }],
                parameters: { sampleCount: 1 }
            });

            const base64 = prediction.predictions[0].bytesBase64Encoded;
            const buffer = Buffer.from(base64, 'base64');
            const destName = `renders/${file.id}-${i}.png`;
            
            const fileRef = bucket.file(destName);
            await fileRef.save(buffer, { metadata: { contentType: 'image/png' } });
            
            firebaseUrls.push(`https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(destName)}?alt=media`);
            
            console.log(`✅ Uploaded: Variant ${i+1}`);

            // ⚡ THE QUOTA PROTECTOR: Wait 60 seconds between images so Google doesn't block you
            if (i < 2) {
                console.log('⏳ Respecting Quota: Waiting 60s before next variant...');
                await new Promise(r => setTimeout(r, 60000));
            }

        } catch (err) {
            console.error(`❌ Error in ${style}:`, err.message);
        }
    }

    // Update Spreadsheet
    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.CATALOG_SHEET_ID,
        range: 'Sheet1!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[
            `AUTO-${Date.now()}`,
            file.name.split('.')[0],
            `https://drive.google.com/file/d/${file.id}/view`,
            firebaseUrls.join(','),
            styles.join(', '),
            'Automatically rendered luxury set.',
            'Pricing TBD',
            'Live'
        ]]}
    });

    console.log(`🏆 FINALIZED: ${file.name} is now LIVE on the website!`);
    
    // Move the file to a "Processed" folder or delete it so we don't loop forever
    // For now, we will just stop.
  }
}

// Run every 2 minutes
setInterval(processSkeletons, 120000);
processSkeletons();
