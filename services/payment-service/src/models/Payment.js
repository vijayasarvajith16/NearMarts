'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Payment Schema — Append-Only Ledger
 * Each status transition inserts a new record into this collection.
 * No document in this collection should ever be updated in place.
 */
const paymentSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: [true, 'orderId is required.'],
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      required: [true, 'vendorId is required.'],
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'buyerId is required.'],
      index: true,
    },
    method: {
      type: String,
      enum: ['ONLINE', 'COD'],
      required: [true, 'Payment method must be ONLINE or COD.'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [0, 'Amount must be non-negative.'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer amount in smallest currency unit.',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'CAPTURED',
        'FAILED',
        'REFUNDED',
        'PENDING_ON_DELIVERY',
        'COLLECTED',
      ],
      required: [true, 'Payment status is required.'],
    },
    webhookEventId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    // Do not automatically modify timestamps on update, as collection is append-only
    timestamps: false,
  }
);

// Compound index for querying order payment history chronologically
paymentSchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
