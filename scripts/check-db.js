import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
    try {
        const client = await mongoose.connect(process.env.MONGO_URI);
        const dbs = ['test', 'filenest', 'minidrive'];
        
        for (const dbName of dbs) {
            console.log(`\n--- Checking DB: ${dbName} ---`);
            const db = client.connection.useDb(dbName);
            const collections = await db.db.listCollections().toArray();
            console.log('Collections:', collections.map(c => c.name));
            
            if (collections.find(c => c.name === 'files')) {
                const files = await db.db.collection('files').find().sort({ createdAt: -1 }).limit(5).toArray();
                console.log(`Found ${files.length} files:`);
                files.forEach(f => {
                    console.log(`- Name: ${f.name}`);
                    console.log(`  URL:  ${f.url}`);
                    console.log(`  CID:  ${f.cloudinaryId || 'N/A'}`);
                    console.log(`  Cat:  ${f.category}`);
                    console.log('-------------------');
                });
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

check();
