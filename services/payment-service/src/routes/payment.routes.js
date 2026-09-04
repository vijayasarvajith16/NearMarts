'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const paymentController = require('../controllers/payment.controller');

// POST /payments/initiate — initiate COD or ONLINE payment
router.post('/initiate', jwtVerify, paymentController.initiatePayment);

// GET /payments/order/:orderId — get payment history records for an order
router.get('/order/:orderId', paymentController.getPaymentByOrder);

module.exports = router;
