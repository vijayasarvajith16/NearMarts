'use strict';

const crypto       = require('crypto');
const mongoose     = require('mongoose');
const Payment      = require('../models/Payment');
const publishEvent = require('../../../../shared/middleware/publishEvent');

/**
 * POST /webhooks/razorpay — handles Razorpay webhook events.
 *
 * Append-Only Architecture Decision:
 * We choose to INSERT a new Payment document with status 'CAPTURED' or 'FAILED'
 * rather than modifying an existing document in place. This guarantees an immutable,
 * complete ledger of payment state transitions. Duplicate webhook deliveries are
 * deduplicated automatically via the unique sparse index on `webhookEventId`.
 */
async function handleRazorpayWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET || 'nearmart_razorpay_webhook_secret';

    if (!signature) {
      return res.status(400).json({ error: 'Missing x-razorpay-signature header.' });
    }

    // Use rawBody string for HMAC calculation, falling back to JSON.stringify if unavailable
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[webhook] Signature mismatch for Razorpay webhook call.');
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body;
    const eventType = event.event;
    const webhookEventId = event.id || event.event_id;

    if (!webhookEventId) {
      return res.status(400).json({ error: 'Webhook payload missing event id.' });
    }

    const paymentEntity = event.payload?.payment?.entity || {};
    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;
    const notes = paymentEntity.notes || {};

    console.log(`[webhook] Valid Razorpay signature. Event: "${eventType}", webhookEventId: "${webhookEventId}"`);

    // Lookup original payment document to maintain order/vendor/buyer metadata
    const query = [];
    if (razorpayOrderId) query.push({ razorpayOrderId });
    if (notes.orderId) query.push({ orderId: notes.orderId });

    let originalPayment = null;
    if (query.length > 0) {
      originalPayment = await Payment.findOne({ $or: query }).sort({ createdAt: 1 });
    }

    const orderId =
      (originalPayment && originalPayment.orderId) ||
      notes.orderId ||
      new mongoose.Types.ObjectId();

    const vendorId =
      (originalPayment && originalPayment.vendorId) ||
      notes.vendorId ||
      new mongoose.Types.ObjectId();

    const buyerId =
      (originalPayment && originalPayment.buyerId) ||
      notes.buyerId ||
      new mongoose.Types.ObjectId();

    const amount =
      paymentEntity.amount ||
      (originalPayment && originalPayment.amount) ||
      0;

    const currency =
      paymentEntity.currency ||
      (originalPayment && originalPayment.currency) ||
      'INR';

    let targetStatus;
    if (eventType === 'payment.captured') {
      targetStatus = 'CAPTURED';
    } else if (eventType === 'payment.failed') {
      targetStatus = 'FAILED';
    } else {
      // Unhandled event type, return 200 clean acknowledgement
      return res.status(200).json({ status: 'ignored', message: `Unhandled event type ${eventType}` });
    }

    // Create new status transition payment record (append-only)
    const newPayment = new Payment({
      orderId,
      vendorId,
      buyerId,
      method: (originalPayment && originalPayment.method) || 'ONLINE',
      amount,
      currency,
      razorpayOrderId,
      razorpayPaymentId,
      status: targetStatus,
      webhookEventId,
    });

    try {
      await newPayment.save();
      console.log(`[webhook] Inserted new payment status record: ${targetStatus} (id: ${newPayment._id})`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`[webhook] Duplicate webhookEventId "${webhookEventId}" detected. Skipping duplicate processing.`);
        return res.status(200).json({ status: 'ok', message: 'Webhook already processed.' });
      }
      throw err;
    }

    // Publish RabbitMQ domain events
    if (targetStatus === 'CAPTURED') {
      await publishEvent('payment.captured', {
        orderId: newPayment.orderId,
        paymentId: newPayment._id,
        amount: newPayment.amount,
        razorpayPaymentId,
      });
    } else if (targetStatus === 'FAILED') {
      await publishEvent('payment.failed', {
        orderId: newPayment.orderId,
        reason: paymentEntity.error_description || 'Payment authorization failed.',
      });
    }

    return res.status(200).json({ status: 'ok', message: `Webhook processed for event ${eventType}` });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  handleRazorpayWebhook,
};
