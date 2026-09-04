'use strict';

const express       = require('express');
const requestLogger = require('../../../shared/middleware/requestLogger');
const errorHandler  = require('../../../shared/middleware/errorHandler');
const productRoutes = require('./routes/product.routes');
const cartRoutes    = require('./routes/cart.routes');

const app = express();

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'catalog-service' })
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
