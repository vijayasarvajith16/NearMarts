'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const orderController = require('../controllers/order.controller');

// GET /orders/:id/verify-deliverable — must come before /:id
router.get('/:id/verify-deliverable', orderController.verifyDeliverable);

// All other endpoints require authentication
router.post('/', jwtVerify, orderController.createOrder);
router.get('/', jwtVerify, orderController.listOrders);
router.get('/:id', jwtVerify, orderController.getOrderById);
router.patch('/:id/status', jwtVerify, orderController.updateOrderStatus);

module.exports = router;
