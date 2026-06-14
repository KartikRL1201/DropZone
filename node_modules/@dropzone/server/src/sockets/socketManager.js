import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from '../config/redis.config.js';
import { verifyAccessToken } from '../utils/jwt.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Setup Redis Adapter for horizontal scaling
  // We use the same redisClient for both pub and sub. In a very high-throughput
  // production environment, you might want separate duplicate connections.
  const pubClient = redisClient;
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Authentication Middleware for WebSockets
  io.use((socket, next) => {
    // Temporary bypass for Admin Dashboard development
    socket.user = { id: '111111111111111111111111', role: 'SUPER_ADMIN' };
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User ID: ${socket.user.id})`);

    // Clients can join specific "rooms" to only receive updates for a particular crisis zone
    socket.on('join_crisis_room', (crisisId) => {
      socket.join(`crisis:${crisisId}`);
      console.log(`User ${socket.user.id} joined room crisis:${crisisId}`);
    });

    socket.on('leave_crisis_room', (crisisId) => {
      socket.leave(`crisis:${crisisId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Accessor for the io instance to be used inside services
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};
