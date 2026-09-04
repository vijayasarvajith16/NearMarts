'use strict';

const amqp         = require('amqplib');
const Order        = require('../models/Order');
const publishEvent = require('../../../../shared/middleware/publishEvent');

const EXCHANGE_NAME        = 'nearmart.events';
const QUEUE_CAPTURED       = 'order-service.payment.captured';
const QUEUE_FAILED         = 'order-service.payment.failed';
const ROUTING_KEY_CAPTURED = 'payment.captured';
const ROUTING_KEY_FAILED   = 'payment.failed';
const RECONNECT_MS         = 10000;

let isConnecting = false;

async function startPaymentConsumer() {
  if (isConnecting) return;
  isConnecting = true;

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error('[paymentConsumer] RABBITMQ_URL not set. Consumer disabled.');
    isConnecting = false;
    return;
  }

  try {
    const conn = await amqp.connect(url);
    const channel = await conn.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // Assert queues and bindings
    await channel.assertQueue(QUEUE_CAPTURED, { durable: true });
    await channel.bindQueue(QUEUE_CAPTURED, EXCHANGE_NAME, ROUTING_KEY_CAPTURED);

    await channel.assertQueue(QUEUE_FAILED, { durable: true });
    await channel.bindQueue(QUEUE_FAILED, EXCHANGE_NAME, ROUTING_KEY_FAILED);

    channel.prefetch(1);

    console.log(`[paymentConsumer] Connected. Listening on queues "${QUEUE_CAPTURED}" & "${QUEUE_FAILED}"…`);
    isConnecting = false;

    conn.on('error', (err) => {
      console.error('[paymentConsumer] Connection error:', err.message);
    });

    conn.on('close', () => {
      console.warn(`[paymentConsumer] Connection closed. Retrying in ${RECONNECT_MS / 1000}s…`);
      isConnecting = false;
      setTimeout(startPaymentConsumer, RECONNECT_MS);
    });

    // 1. Consume payment.captured
    channel.consume(QUEUE_CAPTURED, async (msg) => {
      if (!msg) return;

      try {
        const envelope = JSON.parse(msg.content.toString());
        const payload = envelope.payload || envelope;
        const orderId = payload.orderId;

        console.log(`[paymentConsumer] Received payment.captured for orderId: ${orderId}`);

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order) {
            order.status = 'CONFIRMED';
            order.paymentStatus = 'PAID';
            order.statusHistory.push({
              status: 'CONFIRMED',
              changedAt: new Date(),
              changedBy: 'payment-service',
            });

            await order.save();
            console.log(`[paymentConsumer] Order ${orderId} marked CONFIRMED & PAID.`);

            // Publish order.confirmed event
            await publishEvent('order.confirmed', {
              orderId: order._id,
              buyerId: order.buyerId,
              vendorId: order.vendorId,
            });
          } else {
            console.warn(`[paymentConsumer] Order ${orderId} not found.`);
          }
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[paymentConsumer] Error handling payment.captured:', err.message);
        channel.nack(msg, false, false);
      }
    });

    // 2. Consume payment.failed
    channel.consume(QUEUE_FAILED, async (msg) => {
      if (!msg) return;

      try {
        const envelope = JSON.parse(msg.content.toString());
        const payload = envelope.payload || envelope;
        const orderId = payload.orderId;
        const reason = payload.reason || 'Payment failed';

        console.log(`[paymentConsumer] Received payment.failed for orderId: ${orderId}`);

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order) {
            order.status = 'CANCELLED';
            order.paymentStatus = 'FAILED';
            order.cancellationReason = reason;
            order.statusHistory.push({
              status: 'CANCELLED',
              changedAt: new Date(),
              changedBy: 'payment-service',
            });

            await order.save();
            console.log(`[paymentConsumer] Order ${orderId} marked CANCELLED (reason: "${reason}").`);
          } else {
            console.warn(`[paymentConsumer] Order ${orderId} not found.`);
          }
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[paymentConsumer] Error handling payment.failed:', err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(`[paymentConsumer] Connection failed (${err.message}). Retrying in ${RECONNECT_MS / 1000}s…`);
    isConnecting = false;
    setTimeout(startPaymentConsumer, RECONNECT_MS);
  }
}

module.exports = { startPaymentConsumer };
