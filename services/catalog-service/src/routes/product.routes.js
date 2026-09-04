'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const productController = require('../controllers/product.controller');

// ── Public / Query routes ───────────────────────────────────────────────────
// GET /products/search — must come before /:id
router.get('/search', productController.searchProducts);

// GET /products — list products (by vendorId, etc.)
router.get('/', productController.listProducts);

// ── Authenticated / Owner routes ────────────────────────────────────────────
// POST /products — create product (vendor only)
router.post('/', jwtVerify, productController.createProduct);

// PATCH /products/:id/stock — internal-use stock decrement
router.patch('/:id/stock', productController.updateStock);

// PATCH /products/:id — update product (owner only)
router.patch('/:id', jwtVerify, productController.updateProduct);

// DELETE /products/:id — delete product (owner only)
router.delete('/:id', jwtVerify, productController.deleteProduct);

module.exports = router;
