import http from 'http';
import app from './app.js';
import { env } from './config/env.config.js';
import { connectDB } from './config/db.config.js';
import { closeRedis } from './config/redis.config.js';

// Create the HTTP server wrapping the Express app
// We do this instead of app.listen() so we can easily attach Socket.IO later
const server = http.createServer(app);

// Start the server
const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();
    
    // 2. Start listening for HTTP requests
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
