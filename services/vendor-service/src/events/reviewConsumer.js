'use strict';

const amqplib = require('amqplib');
const Vendor  = require('../models/Vendor');

const EXCHANGE_NAME = 'nearmart.events';
const QUEUE_NAME    = 'vendor-service.review.created';
const ROUTING_KEY   = 'review.created';

// Exponential moving average alpha — weights recent reviews more but doesn't erase history
const EMA_ALPHA = 0.2;

/**
 * Starts a RabbitMQ consumer that listens for "review.created" events and
 * recalculates the vendor's trustScore using an EMA.
 *
 * This runs entirely out-of-band from HTTP requests — no HTTP handler waits on it.
 */
async function startReviewConsumer() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error('[reviewConsumer] RABBITMQ_URL is not set — consumer not started.');
    return;
  }

  let connection;
  try {
    connection = await amqplib.connect(url);
  } catch (err) {
    // RabbitMQ may not be up yet during dev — log and bail; no crash
    console.error('[reviewConsumer] Could not connect to RabbitMQ:', err.message);
    console.warn('[reviewConsumer] Retrying in 10 seconds…');
    setTimeout(startReviewConsumer, 10_000);
    return;
  }

  connection.on('error', (err) => {
    console.error('[reviewConsumer] Connection error:', err.message);
  });
  connection.on('close', () => {
    console.warn('[reviewConsumer] Connection closed — reconnecting in 10s…');
    setTimeout(startReviewConsumer, 10_000);
  });

  const channel = await connection.createChannel();

  // Assert the exchange (must match publisher)
  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

  // Durable queue so messages survive broker restarts
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

  // Prefetch 1 — process one message at a time to avoid overloading Mongo
  channel.prefetch(1);

  console.log(`[reviewConsumer] Listening on queue "${QUEUE_NAME}"…`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return; // consumer cancelled

    let envelope;
    try {
      envelope = JSON.parse(msg.content.toString());
    } catch {
      console.error('[reviewConsumer] Failed to parse message — discarding.');
      channel.nack(msg, false, false); // dead-letter, no requeue
      return;
    }

    const { vendorId, rating } = envelope.payload || {};

    if (!vendorId || typeof rating !== 'number') {
      console.error('[reviewConsumer] Invalid payload — missing vendorId or rating. Discarding.');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        console.warn(`[reviewConsumer] Vendor ${vendorId} not found — skipping.`);
        channel.ack(msg); // ack so we don't reprocess infinitely
        return;
      }

      // Exponential Moving Average: new = α × rating + (1-α) × old
      const newScore = parseFloat(
        (EMA_ALPHA * rating + (1 - EMA_ALPHA) * vendor.trustScore).toFixed(2)
      );

      await Vendor.findByIdAndUpdate(vendorId, { trustScore: newScore });

      console.log(
        `[reviewConsumer] trustScore updated for vendor ${vendorId}: ` +
        `${vendor.trustScore} → ${newScore} (rating=${rating})`
      );

      channel.ack(msg);
    } catch (err) {
      console.error('[reviewConsumer] Error processing message:', err.message);
      // nack without requeue to avoid poison-pill loops
      channel.nack(msg, false, false);
    }
  });
}

module.exports = { startReviewConsumer };
