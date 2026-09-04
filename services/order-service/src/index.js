'use strict';

require('dotenv').config();

const app                      = require('./app');
const db                       = require('./db');
const { startPaymentConsumer } = require('./events/paymentConsumer');

const PORT = process.env.PORT || process.env.ORDER_SERVICE_PORT || 4004;

async function start() {
  // 1. Connect to MongoDB (nearmart_orders)
  await db.connect();

  // 2. Start RabbitMQ payment event consumers (non-blocking)
  startPaymentConsumer().catch((err) =>
    console.error('[order-service] paymentConsumer startup error:', err.message)
  );

  // 3. Start HTTP server
  app.listen(PORT, () => {
    console.log(
      `[order-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[order-service] Fatal startup error:', err);
  process.exit(1);
});
