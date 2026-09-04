'use strict';

const express    = require('express');
const controller = require('../controllers/auth.controller');
const jwtVerify  = require('../../../../shared/middleware/jwtVerify');

const router = express.Router();

// POST /auth/signup
router.post('/signup', controller.signup);

// POST /auth/login
router.post('/login', controller.login);

// POST /auth/refresh
router.post('/refresh', controller.refresh);

// GET /auth/me  — requires valid JWT
router.get('/me', jwtVerify, controller.me);

module.exports = router;
