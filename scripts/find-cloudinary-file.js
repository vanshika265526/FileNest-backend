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

async function findResource() {
    try {
        const publicId = 'minidrive-uploads/xm1muwjcrthzluiynokj';
        console.log(`Searching for Resource: ${publicId}`);
        
        // Try to find it by trying common resource types
        let resource = null;
        for (const type of ['image', 'raw', 'video']) {
            try {
                resource = await cloudinary.api.resource(publicId, { resource_type: type });
                if (resource) {
                    console.log(`FOUND as type: ${type}`);
                    break;
                }
            } catch (e) {
                // Not found as this type
            }
        }

        if (resource) {
            console.log('Resource Details:');
            console.log(JSON.stringify(resource, null, 2));
        } else {
            console.log('NOT FOUND in Cloudinary as image, raw, or video.');
            // List everything in the folder
            const folderRes = await cloudinary.api.resources({ 
                type: 'upload', 
                prefix: 'minidrive-uploads/'
            });
            console.log('Files in folder:', folderRes.resources.map(r => `${r.public_id} (${r.resource_type})`));
        }
        process.exit(0);
    } catch (error) {
        console.error('API Error:', error.message);
        process.exit(1);
    }
}

findResource();
