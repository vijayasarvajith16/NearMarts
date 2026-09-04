'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const messageController = require('../controllers/message.controller');

// GET /messages/:orderId — get chat history for an order (buyer or vendor party only)
router.get('/:orderId', jwtVerify, messageController.getOrderMessages);

module.exports = router;
