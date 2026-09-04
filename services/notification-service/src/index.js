'use strict';

require('dotenv').config();

const app                          = require('./app');
const db                           = require('./db');
const { startNotificationConsumer } = require('./events/notificationConsumer');

const PORT = process.env.PORT || process.env.NOTIFICATION_SERVICE_PORT || 4008;

async function start() {
  // 1. Connect to MongoDB (nearmart_notifications)
  await db.connect();

  // 2. Start RabbitMQ notification consumer (non-blocking)
  startNotificationConsumer().catch((err) =>
    console.error('[notification-service] notificationConsumer startup error:', err.message)
  );

  // 3. Start HTTP server
  app.listen(PORT, () => {
    console.log(
      `[notification-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[notification-service] Fatal startup error:', err);
  process.exit(1);
});
