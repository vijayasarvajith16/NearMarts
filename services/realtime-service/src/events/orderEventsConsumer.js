'use strict';

const amqp = require('amqplib');

const EXCHANGE_NAME = 'nearmart.events';
const QUEUE_NAME    = 'realtime-service.order.events';
const ROUTING_KEYS  = ['order.confirmed', 'order.status_changed', 'order.delivered'];
const RECONNECT_MS  = 10000;

let isConnecting = false;

async function startOrderEventsConsumer(io) {
  if (isConnecting) return;
  isConnecting = true;

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error('[orderEventsConsumer] RABBITMQ_URL not set. Consumer disabled.');
    isConnecting = false;
    return;
  }

  try {
    const conn = await amqp.connect(url);
    const channel = await conn.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    for (const key of ROUTING_KEYS) {
      await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, key);
    }

    channel.prefetch(1);

    console.log(
      `[orderEventsConsumer] Connected. Listening on queue "${QUEUE_NAME}" for keys [${ROUTING_KEYS.join(', ')}]…`
    );
    isConnecting = false;

    conn.on('error', (err) => {
      console.error('[orderEventsConsumer] Connection error:', err.message);
    });

    conn.on('close', () => {
      console.warn(`[orderEventsConsumer] Connection closed. Retrying in ${RECONNECT_MS / 1000}s…`);
      isConnecting = false;
      setTimeout(() => startOrderEventsConsumer(io), RECONNECT_MS);
    });

    channel.consume(QUEUE_NAME, (msg) => {
      if (!msg) return;

      try {
        const rawContent = msg.content.toString();
        const envelope = JSON.parse(rawContent);
        const eventType = envelope.eventType || msg.fields.routingKey;
        const payload = envelope.payload || envelope;

        const orderId = payload.orderId;

        console.log(`[orderEventsConsumer] Received event "${eventType}" for orderId: ${orderId}`);

        if (orderId) {
          const roomName = `order:${orderId}`;
          const socketEvent = `order:${eventType.replace('order.', '')}`; // e.g. "order:status_changed"

          const pushData = {
            eventType,
            orderId,
            payload,
            timestamp: envelope.timestamp || new Date().toISOString(),
          };

          // Broadcast live push to all sockets tracking this order room
          io.to(roomName).emit(socketEvent, pushData);
          io.to(roomName).emit('order:updated', pushData);

          console.log(`[orderEventsConsumer] Pushed live event "${socketEvent}" to room "${roomName}"`);
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[orderEventsConsumer] Error processing event:', err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(
      `[orderEventsConsumer] Connection failed (${err.message}). Retrying in ${RECONNECT_MS / 1000}s…`
    );
    isConnecting = false;
    setTimeout(() => startOrderEventsConsumer(io), RECONNECT_MS);
  }
}

module.exports = { startOrderEventsConsumer };
