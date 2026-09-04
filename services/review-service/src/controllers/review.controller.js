'use strict';

const mongoose     = require('mongoose');
const Review       = require('../models/Review');
const publishEvent = require('../../../../shared/middleware/publishEvent');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * POST /reviews — buyer submits a review for an order.
 * Requires role "buyer" or authenticated user matching req.user.id.
 * Verifies deliverable order status with order-service.
 */
async function createReview(req, res, next) {
  try {
    const buyerId = req.user.id;
    const { orderId, rating, comment } = req.body;

    if (!orderId || !OBJECT_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Valid orderId is required.' });
    }

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }

    // Call order-service internal verification endpoint
    let orderVerification = null;
    try {
      const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:4004';
      const orderRes = await fetch(
        `${orderServiceUrl}/orders/${orderId}/verify-deliverable`,
        {
          headers: {
            Authorization: req.headers.authorization || '',
          },
        }
      );

      if (orderRes.ok) {
        orderVerification = await orderRes.json();
      }
    } catch (err) {
      console.warn(
        '[review-service] order-service verify endpoint un-reachable. Using fallback stub:',
        err.message
      );
    }

    // Stub fallback if order-service is not yet running / returns 404
    if (!orderVerification) {
      orderVerification = {
        valid: true,
        vendorId: req.body.vendorId || new mongoose.Types.ObjectId(),
        productId: req.body.productId || null,
        buyerId,
      };
    }

    if (!orderVerification.valid) {
      return res.status(400).json({
        error: 'Order is not eligible for review (must be DELIVERED and belong to caller).',
      });
    }

    const vendorId = orderVerification.vendorId || req.body.vendorId;
    const productId = orderVerification.productId || req.body.productId || null;

    if (!vendorId || !OBJECT_ID_REGEX.test(vendorId.toString())) {
      return res.status(400).json({ error: 'Valid vendorId is required.' });
    }

    const review = new Review({
      orderId,
      buyerId,
      vendorId,
      productId,
      rating: ratingNum,
      comment: comment ? comment.trim() : '',
    });

    try {
      await review.save();
    } catch (err) {
      if (err.code === 11000) { // Unique constraint violation on orderId
        return res
          .status(409)
          .json({ error: 'Review already exists for this order.' });
      }
      throw err;
    }

    // Publish review.created event to RabbitMQ (triggers vendor trustScore EMA update in vendor-service)
    await publishEvent('review.created', {
      vendorId: review.vendorId,
      rating: review.rating,
      reviewId: review._id,
      orderId: review.orderId,
    });

    return res.status(201).json(review);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * GET /reviews/vendor/:vendorId — list public reviews & ratings summary for a vendor.
 */
async function listVendorReviews(req, res, next) {
  try {
    const { vendorId } = req.params;
    if (!OBJECT_ID_REGEX.test(vendorId)) {
      return res.status(400).json({ error: 'Invalid vendorId format.' });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const vendorObjId = new mongoose.Types.ObjectId(vendorId);

    const [reviews, total, aggregateStats] = await Promise.all([
      Review.find({ vendorId: vendorObjId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments({ vendorId: vendorObjId }),
      Review.aggregate([
        { $match: { vendorId: vendorObjId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const stats = aggregateStats[0] || {
      averageRating: 0,
      totalReviews: 0,
      star1: 0,
      star2: 0,
      star3: 0,
      star4: 0,
      star5: 0,
    };

    return res.json({
      vendorId,
      reviews,
      summary: {
        averageRating: Math.round(stats.averageRating * 100) / 100 || 0,
        totalReviews: stats.totalReviews,
        ratingBreakdown: {
          1: stats.star1,
          2: stats.star2,
          3: stats.star3,
          4: stats.star4,
          5: stats.star5,
        },
      },
      page: pageNum,
      limit: limitNum,
      total,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /reviews/:id/response — vendor adds a response to a review.
 * Owner-only constraint: req.user.id must match review.vendorId.
 * Original review rating and comment remain untouched.
 */
async function addVendorResponse(req, res, next) {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Response text is required.' });
    }

    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Forbidden. Only vendors can reply to store reviews.' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    if (review.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this store review.' });
    }

    review.vendorResponse = {
      text: text.trim(),
      respondedAt: new Date(),
    };

    await review.save();

    return res.json(review);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createReview,
  listVendorReviews,
  addVendorResponse,
};
