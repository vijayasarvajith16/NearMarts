'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: [true, 'orderId is required.'],
      unique: true, // One review per order, enforced at DB level
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'buyerId is required.'],
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      required: [true, 'vendorId is required.'],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating cannot exceed 5.'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer rating.',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    vendorResponse: {
      text: {
        type: String,
        trim: true,
      },
      respondedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for vendor's public reviews page
reviewSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
