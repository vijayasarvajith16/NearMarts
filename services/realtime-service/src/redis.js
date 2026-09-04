'use strict';

const Redis = require('ioredis');

let pubClient = null;
let subClient = null;

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set for realtime-service.');

  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}

function getPubSubClients() {
  if (!pubClient) {
    pubClient = createRedisClient();
    subClient = createRedisClient();

    pubClient.on('error', (err) => console.error('[realtime-service] Redis Pub error:', err.message));
    subClient.on('error', (err) => console.error('[realtime-service] Redis Sub error:', err.message));
  }
  return { pubClient, subClient };
}

async function connect() {
  const { pubClient, subClient } = getPubSubClients();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  console.log('[realtime-service] Redis pub/sub clients connected.');
}

module.exports = {
  getPubSubClients,
  connect,
};
