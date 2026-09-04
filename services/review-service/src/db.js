'use strict';

const mongoose = require('mongoose');

let isConnected = false;

async function connect() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI || process.env.REVIEW_SERVICE_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is not set for review-service.');

  await mongoose.connect(uri);
  isConnected = true;
  console.log('[review-service] MongoDB connected:', mongoose.connection.name);
}

async function disconnect() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[review-service] MongoDB disconnected.');
}

module.exports = { connect, disconnect };
