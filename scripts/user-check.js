import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to MongoDB: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`);
        
        const User = mongoose.model('User', new mongoose.Schema({ email: String, fullName: String, role: String }));
        const users = await User.find({});
        
        console.log('\n--- Current Users ---');
        if (users.length === 0) {
            console.log('No users found in this database.');
        } else {
            users.forEach(user => {
                console.log(`- ${user.fullName} (${user.email}) [Role: ${user.role}]`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

connectDB();
