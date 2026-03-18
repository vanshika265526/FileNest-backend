import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const publicId = 'minidrive-uploads/xm1muwjcrthzluiynokj';
// For PDFs, they are often 'image' or 'raw'. Let's check both
const signedUrlImage = cloudinary.url(publicId, { 
    sign_url: true, 
    resource_type: 'image',
    secure: true
});

const signedUrlRaw = cloudinary.url(publicId, { 
    sign_url: true, 
    resource_type: 'raw',
    secure: true
});

console.log('SIGNED URL (image):', signedUrlImage);
console.log('SIGNED URL (raw):', signedUrlRaw);
