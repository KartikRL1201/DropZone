import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model.js';
import { env } from '../config/env.config.js';
import { UserRole } from '@dropzone/shared-domain';

const seedAdmin = async () => {
    try {
        await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
        console.log('📦 Connected to MongoDB for seeding...');

        const email = 'admin@dropzone.com';
        const password = 'DropzoneAdmin2026!'; // Memorable but secure

        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log(`⚠️ Admin with email ${email} already exists.`);
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await User.create({
            email,
            passwordHash,
            name: 'System Administrator',
            phone: '555-0100',
            role: UserRole.SUPER_ADMIN,
        });

        console.log('✅ Successfully created initial SUPER_ADMIN!');
        console.log('--------------------------------------------------');
        console.log(`📧 Email:    ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log('--------------------------------------------------');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
