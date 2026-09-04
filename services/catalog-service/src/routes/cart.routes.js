'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const cartController = require('../controllers/cart.controller');

// All cart routes require a valid JWT (authenticated user)
router.use(jwtVerify);

// POST /cart/items — add {productId, quantity}
router.post('/items', cartController.addToCart);

// GET /cart — get enriched cart contents
router.get('/', cartController.getCart);

// DELETE /cart/items/:productId — remove single item
router.delete('/items/:productId', cartController.removeFromCart);

// DELETE /cart — clear entire cart
router.delete('/', cartController.clearCart);

module.exports = router;
