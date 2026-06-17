import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb://Admin:Kartik12@ac-mqm4rda-shard-00-00.z94sspy.mongodb.net:27017,ac-mqm4rda-shard-00-01.z94sspy.mongodb.net:27017,ac-mqm4rda-shard-00-02.z94sspy.mongodb.net:27017/?replicaSet=atlas-ucndwu-shard-0&ssl=true&authSource=admin';

async function test() {
    await mongoose.connect(MONGODB_URI, { dbName: 'dropzone' });
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@dropzone.com' });
    console.log("Admin user:", user);
    
    if (user) {
        const isMatch = await bcrypt.compare('DropzoneAdmin2026!', user.passwordHash);
        console.log("Password match:", isMatch);
    }
    
    process.exit(0);
}

test().catch(console.error);
