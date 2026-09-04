'use strict';

const mongoose     = require('mongoose');
const Order        = require('../models/Order');
const publishEvent = require('../../../../shared/middleware/publishEvent');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * POST /orders — buyer checks out.
 * 1. Fetches buyer's active cart snapshot from catalog-service (or uses explicit items payload).
 * 2. Creates Order record in status PLACED.
 * 3. Publishes "order.placed" event (triggers stock decrement in catalog-service).
 * 4. Calls payment-service POST /payments/initiate synchronously.
 * 5. Clears buyer's cart in catalog-service.
 */
async function createOrder(req, res, next) {
  try {
    const buyerId = req.user.id;
    const { deliveryAddress, paymentMethod, vendorId: inputVendorId, items: inputItems } = req.body;

    if (!deliveryAddress || !deliveryAddress.line1 || !deliveryAddress.pincode) {
      return res.status(400).json({ error: 'Valid deliveryAddress (line1, pincode) is required.' });
    }
    if (!['ONLINE', 'COD'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be ONLINE or COD.' });
    }

    let orderItems = [];
    let vendorId = inputVendorId;
    let totalAmount = 0;

    const catalogServiceUrl = process.env.CATALOG_SERVICE_URL || 'http://localhost:4003';
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4005';

    // Fetch buyer's cart from catalog-service if explicit items not supplied
    if (!inputItems || inputItems.length === 0) {
      try {
        const cartRes = await fetch(`${catalogServiceUrl}/cart`, {
          headers: { Authorization: req.headers.authorization || '' },
        });

        if (cartRes.ok) {
          const cartData = await cartRes.json();
          if (cartData.items && cartData.items.length > 0) {
            orderItems = cartData.items.map((i) => ({
              productId: i.productId,
              name: i.product.name,
              price: i.product.price,
              quantity: i.quantity,
              subtotal: i.itemSubtotal,
            }));
            totalAmount = cartData.totalAmount;
            if (!vendorId && cartData.items[0]?.product?.vendorId) {
              vendorId = cartData.items[0].product.vendorId;
            }
          }
        }
      } catch (err) {
        console.warn('[order-service] Failed to fetch cart from catalog-service:', err.message);
      }
    } else {
      // Use explicit items array
      orderItems = inputItems.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.subtotal || i.price * i.quantity,
      }));
      totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    }

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Cannot create order.' });
    }
    if (!vendorId || !OBJECT_ID_REGEX.test(vendorId.toString())) {
      return res.status(400).json({ error: 'Valid vendorId is required.' });
    }

    const orderNumber = `NM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const initialPaymentStatus = paymentMethod === 'COD' ? 'PENDING_ON_DELIVERY' : 'PENDING';

    const order = new Order({
      orderNumber,
      buyerId,
      vendorId,
      items: orderItems,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      paymentStatus: initialPaymentStatus,
      status: 'PLACED',
      statusHistory: [
        {
          status: 'PLACED',
          changedAt: new Date(),
          changedBy: buyerId,
        },
      ],
    });

    await order.save();
    console.log(`[order-service] Order created! orderNumber: ${order.orderNumber}, id: ${order._id}`);

    // 1. Publish "order.placed" event (catalog-service stock decrement consumer listens to this)
    await publishEvent('order.placed', {
      orderId: order._id,
      vendorId: order.vendorId,
      items: order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    });

    // 2. Call payment-service POST /payments/initiate synchronously
    let paymentResult = null;
    try {
      const paymentRes = await fetch(`${paymentServiceUrl}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || '',
        },
        body: JSON.stringify({
          orderId: order._id,
          vendorId: order.vendorId,
          buyerId: order.buyerId,
          amount: order.totalAmount,
          method: paymentMethod,
        }),
      });

      if (paymentRes.ok) {
        paymentResult = await paymentRes.json();
      } else {
        const errData = await paymentRes.json().catch(() => ({}));
        console.warn('[order-service] Synchronous payment initiate returned status:', paymentRes.status, errData);
        paymentResult = { warning: 'Payment initiation response degraded', details: errData };
      }
    } catch (err) {
      console.error('[order-service] Failed to call payment-service /payments/initiate:', err.message);
      paymentResult = { warning: 'Payment service unreachable', error: err.message };
    }

    // 3. Clear buyer cart asynchronously in catalog-service
    fetch(`${catalogServiceUrl}/cart`, {
      method: 'DELETE',
      headers: { Authorization: req.headers.authorization || '' },
    }).catch((err) => console.warn('[order-service] Async cart clear failed:', err.message));

    return res.status(201).json({
      order,
      payment: paymentResult,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * GET /orders/:id — view an order by ID (buyer or vendor party to order).
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const userId = req.user.id;
    const isBuyer = order.buyerId.toString() === userId;
    const isVendor = order.vendorId.toString() === userId;

    if (!isBuyer && !isVendor && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You are not party to this order.' });
    }

    return res.json(order);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /orders — list orders (filtered by vendorId or buyerId).
 */
async function listOrders(req, res, next) {
  try {
    const { vendorId, buyerId, status, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (vendorId) {
      if (!OBJECT_ID_REGEX.test(vendorId)) {
        return res.status(400).json({ error: 'Invalid vendorId format.' });
      }
      filter.vendorId = vendorId;
    }

    if (buyerId) {
      if (!OBJECT_ID_REGEX.test(buyerId)) {
        return res.status(400).json({ error: 'Invalid buyerId format.' });
      }
      filter.buyerId = buyerId;
    }

    if (status) {
      filter.status = status;
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Order.countDocuments(filter),
    ]);

    return res.json({ orders, total, page: pageNum, limit: limitNum });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /orders/:id/status — vendor updates order status.
 * Allowed manual transitions: PREPARING, OUT_FOR_DELIVERY, DELIVERED.
 */
async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const allowedStatuses = ['PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid status transition. Allowed manual statuses: ${allowedStatuses.join(', ')}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    let isVendorOwner = order.vendorId.toString() === req.user.id;
    if (!isVendorOwner && req.user.role === 'vendor') {
      try {
        const vendorServiceUrl = process.env.VENDOR_SERVICE_URL || 'http://localhost:4002';
        const vRes = await fetch(`${vendorServiceUrl}/vendors/me`, {
          headers: { Authorization: req.headers.authorization || '' },
        });
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.vendor && vData.vendor._id.toString() === order.vendorId.toString()) {
            isVendorOwner = true;
          }
        }
      } catch (err) {}
    }

    if (!isVendorOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Only the order vendor can update order status.' });
    }

    const oldStatus = order.status;
    order.status = newStatus;

    order.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      changedBy: req.user.id,
    });

    if (newStatus === 'DELIVERED') {
      if (order.paymentMethod === 'COD') {
        order.paymentStatus = 'PAID';
      }
      await publishEvent('order.delivered', {
        orderId: order._id,
        buyerId: order.buyerId,
        vendorId: order.vendorId,
      });
    }

    // Publish order.status_changed for every transition
    await publishEvent('order.status_changed', {
      orderId: order._id,
      oldStatus,
      newStatus,
    });

    await order.save();

    return res.json(order);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /orders/:id/verify-deliverable — internal endpoint for review-service.
 */
async function verifyDeliverable(req, res, next) {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_REGEX.test(id)) {
      return res.json({ valid: false });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.json({ valid: false });
    }

    if (order.status === 'DELIVERED' && order.reviewSubmitted === false) {
      return res.json({
        valid: true,
        vendorId: order.vendorId,
        productId: order.items[0]?.productId || null,
        buyerId: order.buyerId,
      });
    }

    return res.json({ valid: false });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  verifyDeliverable,
};
