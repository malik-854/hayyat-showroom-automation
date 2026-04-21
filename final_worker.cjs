const { google } = require('googleapis');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();
const fs = require('fs');

// Initialize Firebase (Used for bucket references if needed)
if (!admin.apps.length) {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.GOOGLE_PROJECT_ID || 'hayyat-store-automation',
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL || 'antigravity-worker@hayyat-store-automation.iam.gserviceaccount.com',
        privateKey: privateKey || JSON.parse(fs.readFileSync('./credentials.json')).private_key
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

async function processSkeletons() {
  console.log('🔍 Ghost Worker: Scanning Google Drive for new luxury potential...');

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials.json',
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.SKELETON_FOLDER_ID;

  try {
    // 1. Scan for all files in the folder to check for existing renders
    const driveRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });

    const allFiles = driveRes.data.files || [];
    const skeletonFiles = allFiles.filter(f => f.name.toLowerCase().includes('_skeleton'));

    if (skeletonFiles.length === 0) {
      console.log('😴 No skeletons found. Sleeping...');
      return;
    }

    for (const file of skeletonFiles) {
      const baseName = file.name.split('_skeleton')[0];
      const aiFileName = `${baseName}_ai.png`;
      const gridFileName = `${baseName}_ai_grid.png`;

      // Check if these already exist in the folder
      const hasAi = allFiles.some(f => f.name === aiFileName);
      const hasGrid = allFiles.some(f => f.name === gridFileName);

      if (hasAi && hasGrid) {
        console.log(`✅ Skipping ${baseName}: Media already exists.`);
        continue;
      }

      console.log(`✨ Detected NEW skeleton: ${file.name}. Starting Auto-Generation...`);

      // A. Download Skeleton as Base64 for Reference
      const skeletonRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
      const skeletonBase64 = Buffer.from(skeletonRes.data).toString('base64');

      // B. Generate Studio Render (_ai)
      if (!hasAi) {
        console.log(`🎨 Generating Studio Render for ${baseName}...`);
        const aiPrompt = `A high-end luxury furniture piece in target category, exactly matching the structure of the provided skeleton. Premium walnut wood finish, cream silk upholstery. Professional studio lighting, hyper-realistic, 8k photography, white minimalist background.`;
        
        const aiResponse = await callImagenDirect(aiPrompt, skeletonBase64, '1:1');
        if (aiResponse) {
            await uploadToDrive(drive, folderId, aiFileName, aiResponse);
            console.log(`✅ Uploaded Studio Render: ${aiFileName}`);
        }
      }

      // C. Generate 4-Panel Grid (_ai_grid)
      if (!hasGrid) {
        console.log(`⊞ Generating 4-Panel Grid for ${baseName}...`);
        const gridPrompt = `A photorealistic four-panel collage grid in portrait 4:5 aspect ratio, showcasing the furniture piece from the skeleton. The grid arrangement features a front view in the top-left, a profile side view in the top-right, a direct rear view in the bottom-left, and an elevated three-quarter perspective view in the bottom-right. The background for all four panels is a clean, modern minimalist room with textured concrete walls. Soft daylight, realistic shadows. 100% matching structure to reference image.`;
        
        const gridResponse = await callImagenDirect(gridPrompt, skeletonBase64, '4:5');
        if (gridResponse) {
            await uploadToDrive(drive, folderId, gridFileName, gridResponse);
            console.log(`✅ Uploaded Grid: ${gridFileName}`);
        }
      }
    }
  } catch (err) {
    console.error('Worker Loop Error:', err.message);
  }
}

/**
 * Direct Imagen 3 API Call
 */
async function callImagenDirect(prompt, base64, aspect) {
    try {
        const vertexAI = new VertexAI({ project: 'hayyat-store-automation', location: 'us-central1' });
        const model = vertexAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });

        const request = {
            instances: [{
                prompt: prompt,
                image: { bytesBase64Encoded: base64 } // Reference image
            }],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspect === '4:5' ? '4:5' : '1:1',
                outputMimeType: 'image/png'
            }
        };

        const [response] = await model.predict(request);
        const prediction = response.predictions[0];
        return Buffer.from(prediction.bytesBase64Encoded, 'base64');
    } catch (err) {
        console.error('Generation Error:', err.message);
        return null;
    }
}

async function uploadToDrive(drive, folderId, name, buffer) {
    const fileMetadata = {
        name: name,
        parents: [folderId]
    };
    const media = {
        mimeType: 'image/png',
        body: require('stream').Readable.from(buffer)
    };
    await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
    });
}

// Run immediately, then every 2 minutes
processSkeletons();
setInterval(processSkeletons, 120000);
