'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const notificationController = require('../controllers/notification.controller');

// GET /notifications/:userId — get notification history for a user
router.get('/:userId', jwtVerify, notificationController.getUserNotifications);

module.exports = router;
