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
        const User = mongoose.model('User', new mongoose.Schema({ email: String }), 'users');
        const users = await User.find({});
        console.log('USERS IN DB:');
        users.forEach(u => console.log(`- ID: ${u._id}, Email: ${u.email}`));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB();
