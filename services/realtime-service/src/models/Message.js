'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      required: [true, 'orderId is required.'],
      index: true,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      required: [true, 'fromUserId is required.'],
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      required: [true, 'toUserId is required.'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Message text is required.'],
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for chronological message retrieval per order
messageSchema.index({ orderId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
