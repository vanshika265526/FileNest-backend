import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const storageType = (process.env.STORAGE_TYPE || 'local').trim().toLowerCase();
const isCloudinary = storageType === 'cloudinary';

console.log('Storage Interface Initialized:', { storageType, isCloudinary });

let storage;

if (isCloudinary) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'minidrive-uploads',
            upload_preset: 'minidrive-uploads',
            allowed_formats: ['jpg', 'png', 'pdf', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx'],
            resource_type: 'auto'
        }
    });
} else {
    storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadPath = 'uploads/';
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        },
    });
}

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

export const deleteFileFromStorage = async (fileUrl, cloudinaryId) => {
    if (isCloudinary) {
        try {
            if (cloudinaryId) {
                const resImg = await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'image' });
                const resRaw = await cloudinary.uploader.destroy(cloudinaryId, { resource_type: 'raw' });
                console.log(`Cloudinary Delete [ID]: ${cloudinaryId}`, { resImg, resRaw });
                return;
            }

            // Fallback for files without a stored cloudinaryId
            const urlParts = fileUrl.split('/');
            const fileNameWithExt = urlParts[urlParts.length - 1];
            const publicId = fileNameWithExt.split('.')[0];
            const folder = 'minidrive-uploads';
            const targetId = `${folder}/${publicId}`;
            
            const resImgFallback = await cloudinary.uploader.destroy(targetId, { resource_type: 'image' });
            const resRawFallback = await cloudinary.uploader.destroy(targetId, { resource_type: 'raw' });
            console.log(`Cloudinary Delete [Fallback]: ${targetId}`, { resImgFallback, resRawFallback });
        } catch (error) {
            console.error('Cloudinary Delete Error:', error);
        }
    } else {
        const filePath = path.join(process.cwd(), fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};

export { upload, isCloudinary };
