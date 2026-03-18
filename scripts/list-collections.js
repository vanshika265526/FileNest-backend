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
        const admin = mongoose.connection.db.admin();
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('COLLECTIONS:');
        collections.forEach(c => console.log(`- ${c.name}`));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB();
