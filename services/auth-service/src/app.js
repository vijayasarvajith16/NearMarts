'use strict';

const express       = require('express');
const requestLogger = require('../../../shared/middleware/requestLogger');
const errorHandler  = require('../../../shared/middleware/errorHandler');
const authRoutes    = require('./routes/auth.routes');

const app = express();

// ── Body parsing ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logging ────────────────────────────────────────────────
app.use(requestLogger);

const authController = require('./controllers/auth.controller');

// ── Routes ─────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.get('/users/:id/contact', authController.getUserContact);

// ── Health check ───────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// ── 404 handler ────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Centralized error handler (must be last) ───────────────────────
app.use(errorHandler);

module.exports = app;
