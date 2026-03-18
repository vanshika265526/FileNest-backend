import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function findResource() {
    try {
        const publicId = 'minidrive-uploads/xm1muwjcrthzluiynokj';
        let resource = null;
        for (const type of ['image', 'raw', 'video']) {
            try {
                resource = await cloudinary.api.resource(publicId, { resource_type: type });
                if (resource) break;
            } catch (e) {}
        }

        if (resource) {
            const info = {
                public_id: resource.public_id,
                resource_type: resource.resource_type,
                type: resource.type,
                access_mode: resource.access_mode,
                url: resource.url,
                secure_url: resource.secure_url
            };
            fs.writeFileSync('resource_clean.json', JSON.stringify(info, null, 2));
            console.log('Resource info saved to resource_clean.json');
        } else {
            console.log('Resource NOT FOUND');
        }
        process.exit(0);
    } catch (error) {
        console.error('API Error:', error.message);
        process.exit(1);
    }
}

findResource();
