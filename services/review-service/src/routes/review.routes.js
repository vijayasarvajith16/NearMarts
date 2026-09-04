'use strict';

const express = require('express');
const router  = express.Router();
const jwtVerify = require('../../../../shared/middleware/jwtVerify');
const reviewController = require('../controllers/review.controller');

// GET /reviews/vendor/:vendorId — list vendor public reviews & summary
router.get('/vendor/:vendorId', reviewController.listVendorReviews);

// POST /reviews — buyer submits a review
router.post('/', jwtVerify, reviewController.createReview);

// POST /reviews/:id/response — vendor adds reply to review (owner only)
router.post('/:id/response', jwtVerify, reviewController.addVendorResponse);

module.exports = router;
