'use strict';

const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Payment  = require('../models/Payment');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

// Initialize Razorpay SDK client (uses test keys if not provided in environment)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

/**
 * POST /payments/initiate — initiate payment for an order.
 * Accepts body: { orderId, vendorId, buyerId, amount, method, currency }
 * Append-only: always inserts a new Payment document.
 */
async function initiatePayment(req, res, next) {
  try {
    const { orderId, vendorId, amount, method, currency = 'INR' } = req.body;
    const buyerId = req.body.buyerId || (req.user ? req.user.id : null);

    if (!orderId || !OBJECT_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Valid orderId is required.' });
    }
    if (!vendorId || !OBJECT_ID_REGEX.test(vendorId)) {
      return res.status(400).json({ error: 'Valid vendorId is required.' });
    }
    if (!buyerId || !OBJECT_ID_REGEX.test(buyerId)) {
      return res.status(400).json({ error: 'Valid buyerId is required.' });
    }
    if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'Amount must be a positive integer in smallest currency unit.' });
    }
    if (!['ONLINE', 'COD'].includes(method)) {
      return res.status(400).json({ error: 'Payment method must be ONLINE or COD.' });
    }

    if (method === 'COD') {
      const paymentDoc = new Payment({
        orderId,
        vendorId,
        buyerId,
        method: 'COD',
        amount,
        currency,
        status: 'PENDING_ON_DELIVERY',
      });

      await paymentDoc.save();

      return res.status(201).json({
        message: 'COD payment record created.',
        status: 'PENDING_ON_DELIVERY',
        payment: paymentDoc,
      });
    }

    // method === 'ONLINE'
    let razorpayOrderId;
    try {
      if (
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_ID !== 'rzp_test_dummy_key'
      ) {
        const razorpayOrder = await razorpay.orders.create({
          amount,
          currency,
          receipt: `receipt_${orderId}`,
          notes: { orderId, vendorId, buyerId },
        });
        razorpayOrderId = razorpayOrder.id;
      } else {
        // Fallback stub for development/testing when real Razorpay keys are unavailable
        razorpayOrderId = `order_rzp_stub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      }
    } catch (err) {
      console.warn('[payment-service] Razorpay order creation failed, using stub fallback:', err.message);
      razorpayOrderId = `order_rzp_stub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const paymentDoc = new Payment({
      orderId,
      vendorId,
      buyerId,
      method: 'ONLINE',
      amount,
      currency,
      razorpayOrderId,
      status: 'CREATED',
    });

    await paymentDoc.save();

    return res.status(201).json({
      message: 'Online payment initiated.',
      razorpayOrderId,
      status: 'CREATED',
      payment: paymentDoc,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /payments/order/:orderId — get payment history records for an order.
 */
async function getPaymentByOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!OBJECT_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId format.' });
    }

    const payments = await Payment.find({ orderId }).sort({ createdAt: -1 });
    return res.json({ orderId, payments });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  initiatePayment,
  getPaymentByOrder,
};
