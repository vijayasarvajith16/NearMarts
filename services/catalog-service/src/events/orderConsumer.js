'use strict';

const amqp    = require('amqplib');
const Product = require('../models/Product');

const EXCHANGE_NAME  = 'nearmart.events';
const QUEUE_NAME     = 'catalog-service.order.placed';
const ROUTING_KEY    = 'order.placed';
const RECONNECT_MS   = 10000;

let isConnecting = false;

async function startOrderConsumer() {
  if (isConnecting) return;
  isConnecting = true;

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error('[orderConsumer] RABBITMQ_URL not set. Consumer disabled.');
    isConnecting = false;
    return;
  }

  try {
    const conn = await amqp.connect(url);
    const channel = await conn.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

    channel.prefetch(1);

    console.log(`[orderConsumer] Connected. Listening on queue "${QUEUE_NAME}" (key "${ROUTING_KEY}")…`);
    isConnecting = false;

    conn.on('error', (err) => {
      console.error('[orderConsumer] Connection error:', err.message);
    });

    conn.on('close', () => {
      console.warn(`[orderConsumer] Connection closed. Retrying in ${RECONNECT_MS / 1000}s…`);
      isConnecting = false;
      setTimeout(startOrderConsumer, RECONNECT_MS);
    });

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const rawContent = msg.content.toString();
        const event = JSON.parse(rawContent);
        const payload = event.payload || event;

        console.log(`[orderConsumer] Received event order.placed for orderId: ${payload.orderId || 'N/A'}`);

        const items = payload.items || [];
        for (const item of items) {
          const productId = item.productId || item.id || item._id;
          const quantity = Number(item.quantity || item.qty || 1);

          if (productId && !isNaN(quantity) && quantity > 0) {
            const updatedProduct = await Product.findByIdAndUpdate(
              productId,
              { $inc: { stock: -quantity } },
              { new: true }
            );

            if (updatedProduct) {
              console.log(
                `[orderConsumer] Decremented product ${productId} stock by ${quantity}. New stock: ${updatedProduct.stock}`
              );

              if (updatedProduct.stock <= 0) {
                updatedProduct.stock = 0;
                updatedProduct.isAvailable = false;
                await updatedProduct.save();
                console.log(`[orderConsumer] Product ${productId} stock reached 0. Marked as unavailable.`);
              }
            } else {
              console.warn(`[orderConsumer] Product ${productId} not found during stock decrement.`);
            }
          }
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[orderConsumer] Failed to process order.placed event:', err.message);
        // Nack without requeue for unparseable/invalid payload
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(`[orderConsumer] Connection failed (${err.message}). Retrying in ${RECONNECT_MS / 1000}s…`);
    isConnecting = false;
    setTimeout(startOrderConsumer, RECONNECT_MS);
  }
}

module.exports = { startOrderConsumer };
