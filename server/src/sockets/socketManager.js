import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from '../config/redis.config.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { fleetEngine } from './FleetEngine.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Setup Redis Adapter for horizontal scaling
  const pubClient = redisClient;
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;


    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    socket.user = decoded;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User ID: ${socket.user.id})`);

    // Emit current speed to the newly connected client
    socket.emit('hq:speed_update', fleetEngine.globalSpeedMultiplier);

    // Sync mission state on login
    if (socket.user.role === 'DRIVER') {
      const authDriverId = socket.user.id;
      socket.join(`driver:${authDriverId}`);
      console.log(`[SOCKET] Driver ${authDriverId} joined personal room driver:${authDriverId}`);
      
      const mission = fleetEngine.getMission(authDriverId);
      if (mission) {
        console.log(`[FLEET ENGINE] Driver ${authDriverId} reconnected, syncing state...`);
        socket.emit('server:sync_state', mission);
      }
    }

    socket.on('driver:start_engine', (data) => {
        // Enforce the driver ID is the authenticated user ID
        fleetEngine.startEngine(socket.user.id);
    });

    socket.on('join_crisis_room', (crisisId) => {
      socket.join(`crisis:${crisisId}`);
      console.log(`User ${socket.user.id} joined room crisis:${crisisId}`);
    });

    socket.on('subscribe', (room) => {
      socket.join(room);
      console.log(`User ${socket.id} joined room: ${room}`);
      
      // Send all active missions to admin when they subscribe to hq room
      if (room === 'hq') {
          const allMissions = Array.from(fleetEngine.activeMissions.values());
          socket.emit('fleet:active_missions', allMissions);
      }
    });

    socket.on('unsubscribe', (room) => {
      socket.leave(room);
      console.log(`User ${socket.id} left room: ${room}`);
    });

    socket.on('admin:speed_update', (speed) => {
      io.to('drivers').emit('admin:speed_update', speed);
      fleetEngine.setSpeed(speed);
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

