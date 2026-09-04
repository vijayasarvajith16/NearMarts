'use strict';

const Redis = require('ioredis');

let client = null;

/**
 * Returns a lazily-created, cached ioredis client.
 * Logs errors and reconnections — does NOT throw on connection loss so
 * that HTTP endpoints can still serve requests when Redis is temporarily down.
 */
function getClient() {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set for vendor-service.');

  client = new Redis(url, {
    lazyConnect:         true,
    maxRetriesPerRequest: 3,
    enableReadyCheck:    true,
  });

  client.on('connect',  () => console.log('[vendor-service] Redis connected.'));
  client.on('ready',    () => console.log('[vendor-service] Redis ready.'));
  client.on('error',    (err) => console.error('[vendor-service] Redis error:', err.message));
  client.on('reconnecting', () => console.warn('[vendor-service] Redis reconnecting…'));

  return client;
}

async function connect() {
  await getClient().connect();
}

/** get — returns parsed JSON or null on miss / error */
async function get(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[redis] GET "${key}" failed:`, err.message);
    return null;
  }
}

/** set — stores JSON string with optional TTL in seconds */
async function set(key, value, ttlSeconds) {
  try {
    const serialised = JSON.stringify(value);
    if (ttlSeconds) {
      await getClient().set(key, serialised, 'EX', ttlSeconds);
    } else {
      await getClient().set(key, serialised);
    }
  } catch (err) {
    console.error(`[redis] SET "${key}" failed:`, err.message);
  }
}

/** del — deletes one or more keys */
async function del(...keys) {
  try {
    if (keys.length) await getClient().del(...keys);
  } catch (err) {
    console.error(`[redis] DEL failed:`, err.message);
  }
}

/**
 * scan — finds keys matching a glob pattern (e.g. "nearby:*")
 * Returns an array of matching key strings.
 */
async function scanKeys(pattern) {
  const matched = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await getClient().scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    matched.push(...keys);
  } while (cursor !== '0');
  return matched;
}

module.exports = { connect, get, set, del, scanKeys };
