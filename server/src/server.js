import http from 'http';
import app from './app.js';
import { env } from './config/env.config.js';
import { connectDB } from './config/db.config.js';
import { seedWarehouses } from './seeders/warehouse.seeder.js';
import { closeRedis } from './config/redis.config.js';
import { initSocket } from './sockets/socketManager.js';
import { initWorker, closeWorker, maintenanceQueue } from './jobs/workerManager.js';
import './jobs/cleanup.job.js'; // Import to ensure it registers the processor

// Create the HTTP server wrapping the Express app
// We do this instead of app.listen() so we can easily attach Socket.IO later
const server = http.createServer(app);

// Start the server
const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();
    await seedWarehouses();
    
    // 2. Initialize Real-Time WebSockets
    initSocket(server);
    console.log('✅ WebSockets (Socket.IO) Initialized');

    // 3. Initialize Background Workers
    initWorker();
    console.log('✅ Background Workers (BullMQ) Initialized');

    // Schedule the cleanup job to run every 12 hours
    await maintenanceQueue.add('stale_request_cleanup', {}, {
      repeat: {
        pattern: '0 */12 * * *', // Every 12 hours
      }
    });
    
    // 4. Start listening for HTTP requests
    server.listen(env.PORT, () => {
      console.log(`🚀 DropZone Engine running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();

// --- Graceful Shutdown ---
// When the process is killed (e.g., by Docker or Ctrl+C), we need to shut down cleanly
// to ensure no allocations are half-written or locked indefinitely.
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new HTTP requests
  server.close(async () => {
    console.log('HTTP server closed.');
    
    try {
      // Close Redis connection
      await closeRedis();
      console.log('Redis connections closed.');
      
      // Close BullMQ workers
      await closeWorker();
      console.log('BullMQ workers closed.');
      
      // We will close MongoDB connection here eventually via mongoose.disconnect()
      
      console.log('Graceful shutdown complete. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force shutdown if it takes longer than 10 seconds
  setTimeout(() => {
    console.error('Shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
