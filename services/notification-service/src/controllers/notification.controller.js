'use strict';

const mongoose     = require('mongoose');
const Notification = require('../models/Notification');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * GET /notifications/:userId — return chronological notification log for a user.
 */
async function getUserNotifications(req, res, next) {
  try {
    const { userId } = req.params;
    if (!OBJECT_ID_REGEX.test(userId)) {
      return res.status(400).json({ error: 'Invalid userId format.' });
    }

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You can only view your own notifications.' });
    }

    const { page = 1, limit = 50 } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Notification.countDocuments({ userId }),
    ]);

    return res.json({
      userId,
      notifications,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getUserNotifications,
};
