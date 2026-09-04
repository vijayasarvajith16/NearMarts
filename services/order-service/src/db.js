'use strict';

const mongoose = require('mongoose');

let isConnected = false;

async function connect() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI || process.env.ORDER_SERVICE_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is not set for order-service.');

  await mongoose.connect(uri);
  isConnected = true;
  console.log('[order-service] MongoDB connected:', mongoose.connection.name);
}

async function disconnect() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[order-service] MongoDB disconnected.');
}

module.exports = { connect, disconnect };
