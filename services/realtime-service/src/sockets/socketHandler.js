'use strict';

const jwt     = require('jsonwebtoken');
const Message = require('../models/Message');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function setupSocketIO(io) {
  // ── 1. Handshake Authentication Middleware ─────────────────────────────────
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (!token) {
      return next(new Error('Authentication error: No token provided in socket handshake.'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[socketHandler] JWT_SECRET is not set.');
      return next(new Error('Server configuration error.'));
    }

    try {
      const decoded = jwt.verify(token, secret);
      socket.user = {
        id: decoded.sub || decoded.id,
        role: decoded.role,
      };
      return next();
    } catch (err) {
      console.warn('[socketHandler] Socket handshake JWT failed:', err.message);
      return next(new Error('Authentication error: Invalid or expired token.'));
    }
  });

  // ── 2. Connection Event ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRoom = `user:${userId}`;

    // Join personal user room for targeted messages & multi-device sync
    socket.join(userRoom);
    console.log(`[socketHandler] Client ${socket.id} (User: ${userId}) connected & joined room "${userRoom}"`);

    // ── 3. Socket event "vendor:message" / "chat:message" ─────────────────────
    const handleMessage = async (data, callback) => {
      try {
        const { orderId, toUserId, text } = data || {};

        if (!orderId || !OBJECT_ID_REGEX.test(orderId)) {
          if (callback) callback({ status: 'error', error: 'Valid orderId is required.' });
          return;
        }
        if (!toUserId || !OBJECT_ID_REGEX.test(toUserId)) {
          if (callback) callback({ status: 'error', error: 'Valid toUserId is required.' });
          return;
        }
        if (!text || typeof text !== 'string' || !text.trim()) {
          if (callback) callback({ status: 'error', error: 'Message text is required.' });
          return;
        }

        const messageDoc = new Message({
          orderId,
          fromUserId: userId,
          toUserId,
          text: text.trim(),
        });

        await messageDoc.save();

        const messagePayload = {
          _id: messageDoc._id,
          orderId: messageDoc.orderId,
          fromUserId: messageDoc.fromUserId,
          toUserId: messageDoc.toUserId,
          text: messageDoc.text,
          readAt: messageDoc.readAt,
          createdAt: messageDoc.createdAt,
        };

        // Emit to recipient's room
        io.to(`user:${toUserId}`).emit('vendor:message', messagePayload);
        io.to(`user:${toUserId}`).emit('chat:message', messagePayload);

        // Echo back to sender's room for multi-device sync
        io.to(userRoom).emit('vendor:message', messagePayload);
        io.to(userRoom).emit('chat:message', messagePayload);

        console.log(`[socketHandler] Message ${messageDoc._id} sent from user ${userId} to user ${toUserId}`);

        if (callback) {
          callback({ status: 'ok', message: messagePayload });
        }
      } catch (err) {
        console.error('[socketHandler] Error handling vendor:message:', err.message);
        if (callback) callback({ status: 'error', error: 'Failed to send message.' });
      }
    };

    socket.on('vendor:message', handleMessage);
    socket.on('chat:message', handleMessage);

    // ── 4. Socket event "order:track" ─────────────────────────────────────────
    socket.on('order:track', (data, callback) => {
      try {
        const { orderId } = data || {};
        if (!orderId || !OBJECT_ID_REGEX.test(orderId)) {
          if (callback) callback({ status: 'error', error: 'Valid orderId is required.' });
          return;
        }

        const orderRoom = `order:${orderId}`;
        socket.join(orderRoom);
        console.log(`[socketHandler] Client ${socket.id} (User: ${userId}) joined tracking room "${orderRoom}"`);

        if (callback) {
          callback({ status: 'ok', room: orderRoom });
        }
      } catch (err) {
        console.error('[socketHandler] Error in order:track:', err.message);
        if (callback) callback({ status: 'error', error: 'Failed to join order tracking room.' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socketHandler] Client ${socket.id} (User: ${userId}) disconnected (${reason}).`);
    });
  });
}

module.exports = { setupSocketIO };
