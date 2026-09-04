'use strict';

const express = require('express');
const router  = express.Router();
const webhookController = require('../controllers/webhook.controller');

// POST /webhooks/razorpay — public webhook endpoint verified by HMAC signature
router.post('/razorpay', webhookController.handleRazorpayWebhook);

module.exports = router;
