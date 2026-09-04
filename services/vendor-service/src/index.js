'use strict';

require('dotenv').config();

const app                 = require('./app');
const db                  = require('./db');
const redis               = require('./redis');
const { startReviewConsumer } = require('./events/reviewConsumer');

const PORT = process.env.PORT || process.env.VENDOR_SERVICE_PORT || 4002;

async function start() {
  // 1. Connect to MongoDB
  await db.connect();

  // 2. Connect to Redis
  await redis.connect();

  // 3. Start RabbitMQ consumer (non-blocking — it retries internally on failure)
  startReviewConsumer().catch((err) =>
    console.error('[vendor-service] reviewConsumer startup error:', err.message)
  );

  // 4. Start HTTP server
  app.listen(PORT, () => {
    console.log(
      `[vendor-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[vendor-service] Fatal startup error:', err);
  process.exit(1);
});
