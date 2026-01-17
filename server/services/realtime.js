const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getQuery, runQuery } = require('../database/db');

/**
 * Enterprise Real-time Communication System
 * WebSocket server for real-time updates, notifications, and collaboration
 */

class RealtimeService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedUsers = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId

    this.initialize();
  }

  initialize() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('Real-time service initialized');
  }

  async handleConnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Store connection
    this.connectedUsers.set(userId, socket.id);
    this.socketUsers.set(socket.id, userId);

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`role:${userRole}`);

    // Update user status
    await this.updateUserStatus(userId, 'online');

    logger.info(`User ${userId} connected (Socket: ${socket.id})`);

    // Emit connection success
    socket.emit('connected', {
      message: 'Connected to real-time service',
      userId,
      timestamp: new Date().toISOString()
    });

    // Notify others about user online status
    socket.to(`role:${userRole}`).emit('user:status', {
      userId,
      status: 'online'
    });

    // Handle visit updates
    socket.on('visit:subscribe', (visitId) => {
      socket.join(`visit:${visitId}`);
      logger.debug(`User ${userId} subscribed to visit ${visitId}`);
    });

    socket.on('visit:unsubscribe', (visitId) => {
      socket.leave(`visit:${visitId}`);
      logger.debug(`User ${userId} unsubscribed from visit ${visitId}`);
    });

    // Handle patient updates
    socket.on('patient:subscribe', (patientId) => {
      socket.join(`patient:${patientId}`);
      logger.debug(`User ${userId} subscribed to patient ${patientId}`);
    });

    // Handle notifications
    socket.on('notification:mark-read', async (notificationId) => {
      try {
        await runQuery(
          `UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = ? AND (to_user_id = ? OR to_role = ?)`,
          [notificationId, userId, userRole]
        );
        socket.emit('notification:read', { notificationId });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
      }
    });

    // Handle typing indicators (for chat/collaboration)
    socket.on('typing:start', (data) => {
      socket.to(data.room).emit('typing:start', {
        userId,
        userName: data.userName
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(data.room).emit('typing:stop', { userId });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      await this.handleDisconnection(socket);
    });
  }

  async handleDisconnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Remove connection
    this.connectedUsers.delete(userId);
    this.socketUsers.delete(socket.id);

    // Update user status
    await this.updateUserStatus(userId, 'offline');

    logger.info(`User ${userId} disconnected (Socket: ${socket.id})`);

    // Notify others about user offline status
    socket.to(`role:${userRole}`).emit('user:status', {
      userId,
      status: 'offline'
    });
  }

  async updateUserStatus(userId, status) {
    try {
      await runQuery(
        `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [userId]
      );
    } catch (error) {
      logger.error('Error updating user status:', error);
    }
  }

  // Broadcast visit update to all subscribers
  broadcastVisitUpdate(visitId, data) {
    this.io.to(`visit:${visitId}`).emit('visit:update', {
      visitId,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast patient update
  broadcastPatientUpdate(patientId, data) {
    this.io.to(`patient:${patientId}`).emit('patient:update', {
      patientId,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit('notification:new', notification);
  }

  // Send notification to role
  sendNotificationToRole(role, notification) {
    this.io.to(`role:${role}`).emit('notification:new', notification);
  }

  // Broadcast system message
  broadcastSystemMessage(message, roles = null) {
    const event = {
      type: 'system',
      message,
      timestamp: new Date().toISOString()
    };

    if (roles) {
      roles.forEach(role => {
        this.io.to(`role:${role}`).emit('system:message', event);
      });
    } else {
      this.io.emit('system:message', event);
    }
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  // Get online users by role
  getOnlineUsersByRole(role) {
    // This would require storing role information with socket
    // For now, return count
    return this.io.sockets.adapter.rooms.get(`role:${role}`)?.size || 0;
  }
}

module.exports = RealtimeService;
