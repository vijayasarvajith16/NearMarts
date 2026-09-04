'use strict';

require('dotenv').config();

const app    = require('./app');
const db     = require('./db');

const PORT = process.env.PORT || process.env.AUTH_SERVICE_PORT || 4001;

async function start() {
  await db.connect();

  app.listen(PORT, () => {
    console.log(`[auth-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });
}

start().catch((err) => {
  console.error('[auth-service] Fatal startup error:', err);
  process.exit(1);
});
