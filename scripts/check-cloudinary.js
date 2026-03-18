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

async function checkCloudinary() {
    try {
        console.log('Using Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
        const result = await cloudinary.api.resources({ max_results: 5 });
        console.log('SUCCESS: Connected to Cloudinary!');
        console.log('Found assets:', result.resources.map(r => r.public_id));
        process.exit(0);
    } catch (error) {
        console.error('FAILED: Cloudinary API Error:', error.message);
        process.exit(1);
    }
}

checkCloudinary();
