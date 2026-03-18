import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const fileSchema = new mongoose.Schema({
            name: String,
            url: String,
            cloudinaryId: String
        });
        
        const File = mongoose.model('File', fileSchema, 'files');
        const files = await File.find({ cloudinaryId: { $ne: null } });
        
        console.log(`Analyzing ${files.length} records with cloudinaryId...`);
        
        for (const file of files) {
            const needsFix = !file.url || !file.url.startsWith('http');
            if (needsFix) {
                console.log(`Fixing record: [${file.name}] ID: ${file.cloudinaryId}`);
                try {
                    // Try to fetch resource details to get secure_url
                    const res = await cloudinary.v2.api.resource(file.cloudinaryId);
                    if (res && res.secure_url) {
                        file.url = res.secure_url;
                        await file.save();
                        console.log(`  ✅ Updated to: ${res.secure_url}`);
                    } else {
                        console.log(`  ⚠️ No secure_url found in resource`);
                    }
                } catch (error) {
                    console.error(`  ❌ Cloudinary Error (${file.cloudinaryId}): ${error.message}`);
                    
                    // Specific fallback for "Resource not found" - maybe ID is missing folder prefix?
                    // Or maybe it's already absolute and just didn't match startsWith? 
                    // (Shouldn't happen with needsFix check)
                }
            } else {
                console.log(`Skipping (Already Absolute): [${file.name}]`);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
