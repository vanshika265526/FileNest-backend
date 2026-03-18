import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const File = mongoose.model('File', new mongoose.Schema({ owner: mongoose.Schema.Types.ObjectId, name: String }), 'files');
        
        const files = await File.find({});
        console.log('FILES AND OWNERS:');
        files.forEach(f => {
            console.log(`- File: ${f.name} (${f._id}), Owner: ${f.owner}`);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB();
