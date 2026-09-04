'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'userId is required.'],
      index: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'sms', 'push', 'email'],
      default: 'whatsapp',
    },
    template: {
      type: String,
      required: [true, 'template is required.'],
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENT', 'FAILED'],
      default: 'QUEUED',
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for retrieving notification log history per user
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
