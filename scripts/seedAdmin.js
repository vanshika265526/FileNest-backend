import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        await connectDB();

        const email = 'vanshika2976910b@gmail.com';
        const password = '123';
        const securityKey = '123';

        const adminExists = await Admin.findOne({ email });

        if (adminExists) {
            console.log('Admin already exists. Updating credentials...');
            adminExists.password = password;
            adminExists.securityKey = securityKey;
            await adminExists.save();
            console.log('Admin updated successfully.');
        } else {
            const admin = await Admin.create({
                fullName: 'Vanshika Admin',
                email,
                password,
                securityKey
            });
            console.log('Admin created successfully:', admin.email);
        }

        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error.message);
        process.exit(1);
    }
};

seedAdmin();
