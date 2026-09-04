'use strict';

const amqplib = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const EXCHANGE_NAME = 'nearmart.events';
const EXCHANGE_TYPE = 'topic';

let channelPromise = null;

/**
 * Lazily creates (and caches) a single RabbitMQ channel.
 * Re-creates the connection if it has been closed.
 */
async function getChannel() {
  if (channelPromise) return channelPromise;

  channelPromise = (async () => {
    const url = process.env.RABBITMQ_URL;
    if (!url) throw new Error('RABBITMQ_URL environment variable is not set.');

    const connection = await amqplib.connect(url);

    // Clear cached channel on connection close so the next call reconnects
    connection.on('close', () => {
      console.warn('[publishEvent] RabbitMQ connection closed; will reconnect on next publish.');
      channelPromise = null;
    });
    connection.on('error', (err) => {
      console.error('[publishEvent] RabbitMQ connection error:', err.message);
      channelPromise = null;
    });

    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

    console.log(`[publishEvent] Connected to RabbitMQ. Exchange "${EXCHANGE_NAME}" ready.`);
    return channel;
  })();

  return channelPromise;
}

/**
 * Publishes an event to the "nearmart.events" topic exchange.
 *
 * @param {string} eventType  - Routing key, e.g. "order.placed"
 * @param {object} payload    - Event-specific payload object
 * @returns {Promise<void>}
 */
async function publishEvent(eventType, payload) {
  const channel = await getChannel();

  const envelope = {
    eventId:   uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const messageBuffer = Buffer.from(JSON.stringify(envelope));

  return new Promise((resolve, reject) => {
    channel.publish(
      EXCHANGE_NAME,
      eventType,           // routing key = eventType
      messageBuffer,
      {
        persistent:  true,
        contentType: 'application/json',
      },
      (err) => {
        if (err) {
          console.error(`[publishEvent] Failed to publish "${eventType}":`, err.message);
          return reject(err);
        }
        console.log(`[publishEvent] Published event "${eventType}" (id=${envelope.eventId})`);
        resolve();
      }
    );
  });
}

module.exports = publishEvent;
