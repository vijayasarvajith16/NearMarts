'use strict';

const express    = require('express');
const controller = require('../controllers/vendor.controller');
const jwtVerify  = require('../../../../shared/middleware/jwtVerify');

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────

// GET /vendors/nearby — geo search (public, no auth)
router.get('/nearby', controller.getNearby);

// GET /vendors/pending — admin queue (MUST come before /:id to avoid "pending" being an id)
router.get('/pending', jwtVerify, controller.getPending);

// GET /vendors/me — logged-in vendor profile (MUST come before /:id)
router.get('/me', jwtVerify, controller.getMe);

// PATCH /vendors/me — logged-in vendor updates store settings (MUST come before /:id)
router.patch('/me', jwtVerify, controller.updateMe);

// GET /vendors/:id — public store page
router.get('/:id', controller.getById);

// ── Authenticated routes ───────────────────────────────────────────────────────

// POST /vendors — vendor registers their store
router.post('/', jwtVerify, controller.createVendor);

// PATCH /vendors/:id/approve — admin approves a vendor
router.patch('/:id/approve', jwtVerify, controller.approveVendor);

// PATCH /vendors/:id/reject — admin rejects a vendor
router.patch('/:id/reject', jwtVerify, controller.rejectVendor);

module.exports = router;
