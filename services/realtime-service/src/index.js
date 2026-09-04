'use strict';

require('dotenv').config();

const http                         = require('http');
const { Server }                   = require('socket.io');
const { createAdapter }            = require('@socket.io/redis-adapter');
const app                          = require('./app');
const db                           = require('./db');
const redis                        = require('./redis');
const { setupSocketIO }            = require('./sockets/socketHandler');
const { startOrderEventsConsumer } = require('./events/orderEventsConsumer');

const PORT = process.env.PORT || process.env.REALTIME_SERVICE_PORT || 4007;

async function start() {
  // 1. Connect to MongoDB (nearmart_realtime)
  await db.connect();

  // 2. Connect Redis pub/sub clients
  await redis.connect();
  const { pubClient, subClient } = redis.getPubSubClients();

  // 3. Create HTTP Server & Socket.io Server
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 4. Attach Redis Adapter to Socket.io for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient));
  console.log('[realtime-service] Socket.io Redis adapter attached.');

  // 5. Setup Socket.io event listeners & auth middleware
  setupSocketIO(io);

  // 6. Start RabbitMQ consumer for order events (non-blocking)
  startOrderEventsConsumer(io).catch((err) =>
    console.error('[realtime-service] orderEventsConsumer startup error:', err.message)
  );

  // 7. Start HTTP + Socket.io Server
  server.listen(PORT, () => {
    console.log(
      `[realtime-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[realtime-service] Fatal startup error:', err);
  process.exit(1);
});
