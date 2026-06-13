import mongoose from 'mongoose';
import { env } from './env.config.js';

/**
 * Establishes a connection to MongoDB.
 * In a disaster scenario, networks can be flaky. This includes retry logic
 * and event listeners to log connection drops.
 */
export const connectDB = async () => {
  try {
    // Configure mongoose globally
    mongoose.set('strictQuery', true);
    
    // Connect to the DB defined in the environment variables
    const connection = await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      maxPoolSize: 50, // High concurrency pool for allocation engine
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000, 
    });

    console.log(`✅ MongoDB Connected: ${connection.connection.host}/${connection.connection.name}`);

    // Set up event listeners for network instability
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    return connection;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1); // We cannot run without the DB, crash the server
  }
};
