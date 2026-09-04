'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      default: 'system',
    },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'orderNumber is required.'],
      unique: true,
      index: true,
      trim: true,
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
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required.'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item.',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required.'],
      min: 0,
    },
    deliveryAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, default: '', trim: true },
      pincode: { type: String, required: true, trim: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0],
        },
      },
    },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'COD'],
      required: [true, 'paymentMethod must be ONLINE or COD.'],
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'PENDING_ON_DELIVERY', 'FAILED'],
      default: 'PENDING',
    },
    status: {
      type: String,
      enum: [
        'PLACED',
        'CONFIRMED',
        'PREPARING',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'PLACED',
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    reviewSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
