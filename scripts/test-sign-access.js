import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const publicId = 'minidrive-uploads/xm1muwjcrthzluiynokj';
const signedUrl = cloudinary.url(publicId, { 
    sign_url: true, 
    resource_type: 'image', // Try image first as many PDFs are uploaded this way
    secure: true
});

console.log('Testing URL:', signedUrl);

https.get(signedUrl, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers['content-type']);
    if (res.statusCode === 200) {
        console.log('SUCCESS: Signed URL works!');
    } else {
        console.log('FAILED: Signed URL also returned', res.statusCode);
        
        // Try 'raw' type if image failed
        const signedUrlRaw = cloudinary.url(publicId, { 
            sign_url: true, 
            resource_type: 'raw',
            secure: true
        });
        console.log('Testing RAW type URL...');
        https.get(signedUrlRaw, (res2) => {
            console.log('STATUS (RAW):', res2.statusCode);
            if (res2.statusCode === 200) {
                console.log('SUCCESS: RAW Signed URL works!');
            } else {
                console.log('FAILED both types.');
            }
            process.exit(0);
        });
    }
}).on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
