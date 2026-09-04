'use strict';

const Redis = require('ioredis');

let client = null;

/**
 * Returns a lazily-created, cached ioredis client.
 */
function getClient() {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set for catalog-service.');

  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on('connect', () => console.log('[catalog-service] Redis connected.'));
  client.on('ready', () => console.log('[catalog-service] Redis ready.'));
  client.on('error', (err) => console.error('[catalog-service] Redis error:', err.message));
  client.on('reconnecting', () => console.warn('[catalog-service] Redis reconnecting…'));

  return client;
}

async function connect() {
  await getClient().connect();
}

/** Hash set — sets field in hash key */
async function hset(key, field, value) {
  try {
    await getClient().hset(key, field, value);
  } catch (err) {
    console.error(`[redis] HSET "${key}" "${field}" failed:`, err.message);
    throw err;
  }
}

/** Hash get — gets field value from hash key */
async function hget(key, field) {
  try {
    return await getClient().hget(key, field);
  } catch (err) {
    console.error(`[redis] HGET "${key}" "${field}" failed:`, err.message);
    return null;
  }
}

/** Hash getall — returns all field/value pairs for key */
async function hgetall(key) {
  try {
    return await getClient().hgetall(key);
  } catch (err) {
    console.error(`[redis] HGETALL "${key}" failed:`, err.message);
    return {};
  }
}

/** Hash del — removes one or more fields from hash */
async function hdel(key, ...fields) {
  try {
    if (fields.length) {
      await getClient().hdel(key, ...fields);
    }
  } catch (err) {
    console.error(`[redis] HDEL "${key}" failed:`, err.message);
    throw err;
  }
}

/** Set TTL in seconds */
async function expire(key, seconds) {
  try {
    await getClient().expire(key, seconds);
  } catch (err) {
    console.error(`[redis] EXPIRE "${key}" failed:`, err.message);
  }
}

/** Delete key(s) */
async function del(...keys) {
  try {
    if (keys.length) {
      await getClient().del(...keys);
    }
  } catch (err) {
    console.error(`[redis] DEL failed:`, err.message);
    throw err;
  }
}

module.exports = {
  getClient,
  connect,
  hset,
  hget,
  hgetall,
  hdel,
  expire,
  del,
};
