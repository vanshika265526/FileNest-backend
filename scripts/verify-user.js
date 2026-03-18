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
        
        const targetId = '69b99daf0a76647584fbb072';
        console.log(`Checking for User ID: ${targetId}`);
        
        const user = await User.findById(targetId);
        if (user) {
            console.log('USER FOUND:', user.email);
        } else {
            console.log('USER NOT FOUND with that ID');
            // List all users with full IDs
            const allUsers = await User.find({});
            console.log(`There are ${allUsers.length} users in DB.`);
            allUsers.forEach(u => {
                console.log(`- ${u._id} (${u.email})`);
            });
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB();
