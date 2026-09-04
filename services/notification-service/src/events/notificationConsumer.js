'use strict';

const amqp = require('amqplib');
const Notification = require('../models/Notification');
const { sendWhatsApp } = require('../providers/whatsapp.provider');

const EXCHANGE_NAME = 'nearmart.events';
const QUEUE_NAME    = 'notification-service.events';
const ROUTING_KEYS  = [
  'order.confirmed',
  'order.status_changed',
  'order.delivered',
  'payment.failed',
  'vendor.approved',
  'vendor.rejected',
];
const RECONNECT_MS  = 10000;

let isConnecting = false;

/**
 * Resolves lightweight contact information for a user from auth-service.
 */
async function getUserContact(userId) {
  if (!userId) return { name: 'NearMart User', phone: '+919876543210' };

  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
    const res = await fetch(`${authUrl}/users/${userId}/contact`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[notificationConsumer] Contact lookup for ${userId} failed:`, err.message);
  }

  return { name: 'NearMart Customer', phone: '+919876543210' };
}

/**
 * Core notification dispatch helper.
 * Inserts QUEUED record first, attempts dispatch via sendWhatsApp, then updates to SENT or FAILED.
 */
async function dispatchNotification({ userId, template, payload, recipientPhone }) {
  if (!userId) return;

  const notification = new Notification({
    userId,
    channel: 'whatsapp',
    template,
    payload,
    status: 'QUEUED',
  });

  await notification.save();

  try {
    const phone = recipientPhone || '+919876543210';
    const result = await sendWhatsApp(phone, template, payload);

    if (result.success) {
      notification.status = 'SENT';
      notification.providerMessageId = result.providerMessageId;
      notification.sentAt = new Date();
    } else {
      notification.status = 'FAILED';
    }

    await notification.save();
    console.log(`[notificationConsumer] Notification ${notification._id} status: ${notification.status}`);
  } catch (err) {
    console.error(`[notificationConsumer] Dispatch error for notification ${notification._id}:`, err.message);
    notification.status = 'FAILED';
    await notification.save();
  }
}

async function startNotificationConsumer() {
  if (isConnecting) return;
  isConnecting = true;

  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.error('[notificationConsumer] RABBITMQ_URL not set. Consumer disabled.');
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
      `[notificationConsumer] Connected. Listening on queue "${QUEUE_NAME}" for keys [${ROUTING_KEYS.join(', ')}]…`
    );
    isConnecting = false;

    conn.on('error', (err) => {
      console.error('[notificationConsumer] Connection error:', err.message);
    });

    conn.on('close', () => {
      console.warn(`[notificationConsumer] Connection closed. Retrying in ${RECONNECT_MS / 1000}s…`);
      isConnecting = false;
      setTimeout(startNotificationConsumer, RECONNECT_MS);
    });

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const rawContent = msg.content.toString();
        const envelope = JSON.parse(rawContent);
        const eventType = envelope.eventType || msg.fields.routingKey;
        const payload = envelope.payload || envelope;

        console.log(`[notificationConsumer] Processing event "${eventType}"...`);

        if (eventType === 'order.confirmed') {
          const buyer = await getUserContact(payload.buyerId);
          const vendor = await getUserContact(payload.vendorId);
          const orderNumber = payload.orderNumber || payload.orderId || 'N/A';

          // 1. Notify Buyer (order_confirmed)
          await dispatchNotification({
            userId: payload.buyerId,
            template: 'order_confirmed',
            payload: {
              buyerName: buyer.name,
              orderNumber,
              vendorName: vendor.name || 'the store',
            },
            recipientPhone: buyer.phone,
          });

          // 2. Notify Vendor (new_order_vendor)
          await dispatchNotification({
            userId: payload.vendorId,
            template: 'new_order_vendor',
            payload: {
              orderNumber,
            },
            recipientPhone: vendor.phone,
          });
        } else if (eventType === 'order.status_changed') {
          if (payload.newStatus === 'OUT_FOR_DELIVERY') {
            const buyer = await getUserContact(payload.buyerId);
            const orderNumber = payload.orderNumber || payload.orderId || 'N/A';

            await dispatchNotification({
              userId: payload.buyerId,
              template: 'order_out_for_delivery',
              payload: { orderNumber },
              recipientPhone: buyer.phone,
            });
          }
        } else if (eventType === 'order.delivered') {
          const buyer = await getUserContact(payload.buyerId);
          const vendor = await getUserContact(payload.vendorId);
          const orderNumber = payload.orderNumber || payload.orderId || 'N/A';

          await dispatchNotification({
            userId: payload.buyerId,
            template: 'order_delivered',
            payload: {
              orderNumber,
              vendorName: vendor.name || 'the store',
            },
            recipientPhone: buyer.phone,
          });
        } else if (eventType === 'payment.failed') {
          const buyer = await getUserContact(payload.buyerId);
          const orderNumber = payload.orderNumber || payload.orderId || 'N/A';

          await dispatchNotification({
            userId: payload.buyerId,
            template: 'payment_failed',
            payload: { orderNumber },
            recipientPhone: buyer.phone,
          });
        } else if (eventType === 'vendor.approved') {
          const vendor = await getUserContact(payload.vendorId || payload.userId);
          const storeName = payload.storeName || vendor.name || 'your store';

          await dispatchNotification({
            userId: payload.vendorId || payload.userId,
            template: 'vendor_approved',
            payload: { storeName },
            recipientPhone: vendor.phone,
          });
        } else if (eventType === 'vendor.rejected') {
          const vendor = await getUserContact(payload.vendorId || payload.userId);
          const reason = payload.reason || 'Information incomplete';

          await dispatchNotification({
            userId: payload.vendorId || payload.userId,
            template: 'vendor_rejected',
            payload: { reason },
            recipientPhone: vendor.phone,
          });
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[notificationConsumer] Error processing message:', err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(`[notificationConsumer] Connection failed (${err.message}). Retrying in ${RECONNECT_MS / 1000}s…`);
    isConnecting = false;
    setTimeout(startNotificationConsumer, RECONNECT_MS);
  }
}

module.exports = { startNotificationConsumer };
