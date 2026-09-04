'use strict';

require('dotenv').config();

const app = require('./app');
const db  = require('./db');

const PORT = process.env.PORT || process.env.REVIEW_SERVICE_PORT || 4006;

async function start() {
  // 1. Connect to MongoDB (nearmart_reviews)
  await db.connect();

  // 2. Start HTTP server
  app.listen(PORT, () => {
    console.log(
      `[review-service] Listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
    );
  });
}

start().catch((err) => {
  console.error('[review-service] Fatal startup error:', err);
  process.exit(1);
});
