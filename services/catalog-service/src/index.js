'use strict';

require('dotenv').config();

const app                 = require('./app');
const db                  = require('./db');
const redis               = require('./redis');
const { startOrderConsumer } = require('./events/orderConsumer');

const PORT = process.env.PORT || process.env.CATALOG_SERVICE_PORT || 4003;

async function start() {
  // 1. Connect to MongoDB (nearmart_catalog)
  await db.connect();

  // 2. Connect to Redis
  await redis.connect();

  // 3. Start RabbitMQ order.placed consumer (non-blocking)
  startOrderConsumer().catch((err) =>
    console.error('[catalog-service] orderConsumer startup error:', err.message)
  );

  // 4. Start HTTP server
  app.listen(PORT, () => {
    console.log(
      `[catalog-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[catalog-service] Fatal startup error:', err);
  process.exit(1);
});
