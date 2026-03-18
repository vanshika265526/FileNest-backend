import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const fileSchema = new mongoose.Schema({
            name: String,
            url: String,
            category: String,
            cloudinaryId: String
        });
        
        const File = mongoose.model('File', fileSchema, 'files');
        const files = await File.find({});
        
        let output = `Found ${files.length} records in 'files' collection.\n`;
        
        files.forEach((f, i) => {
            output += `\n--- FILE ${i+1} ---\n`;
            output += `ID:       ${f._id}\n`;
            output += `Name:     ${f.name}\n`;
            output += `URL:      ${f.url}\n`;
            output += `Category: ${f.category}\n`;
            output += `C_ID:     ${f.cloudinaryId}\n`;
            output += `------------------\n`;
        });
        
        fs.writeFileSync('db_dump.txt', output);
        console.log('Database dump written to db_dump.txt');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

connectDB();
