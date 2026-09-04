'use strict';

const mongoose = require('mongoose');
const Message  = require('../models/Message');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * GET /messages/:orderId — return chronological message history for an order.
 *
 * Authorization Approach Choice:
 * We query order-service (`GET /orders/:id`) using the caller's Bearer JWT header
 * to verify that `req.user.id` is either the buyer or vendor party to the order.
 * If order-service is unavailable or returns an error, we fall back to verifying
 * that the user matches at least one existing message's `fromUserId` or `toUserId`.
 */
async function getOrderMessages(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!OBJECT_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId format.' });
    }

    const userId = req.user.id;
    let isAuthorized = false;

    // 1. Attempt authorization check against order-service
    try {
      const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:4004';
      const orderRes = await fetch(`${orderServiceUrl}/orders/${orderId}`, {
        headers: {
          Authorization: req.headers.authorization || '',
        },
      });

      if (orderRes.ok) {
        const order = await orderRes.json();
        const isBuyer = order.buyerId && order.buyerId.toString() === userId;
        const isVendor = order.vendorId && order.vendorId.toString() === userId;

        if (isBuyer || isVendor || req.user.role === 'admin') {
          isAuthorized = true;
        }
      }
    } catch (err) {
      console.warn('[message.controller] order-service authorization call failed, using fallback check:', err.message);
    }

    // 2. Fallback authorization check if order-service call failed
    if (!isAuthorized) {
      const existingMessage = await Message.findOne({
        orderId,
        $or: [{ fromUserId: userId }, { toUserId: userId }],
      });

      if (existingMessage || req.user.role === 'admin') {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden. You are not party to this order chat.' });
    }

    const messages = await Message.find({ orderId }).sort({ createdAt: 1 });
    return res.json({ orderId, messages, count: messages.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getOrderMessages,
};
