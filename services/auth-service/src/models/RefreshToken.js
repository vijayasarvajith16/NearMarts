'use strict';

const mongoose = require('mongoose');

/**
 * refresh_tokens collection
 *
 * Stores a bcrypt hash of the opaque refresh token — never the raw value.
 * The raw token is only ever held in memory and returned to the client once.
 * TTL index on `expiresAt` — MongoDB will auto-delete expired documents.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },       // bcrypt hash of the raw opaque token
    expiresAt: { type: Date, required: true },         // TTL index target
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// MongoDB TTL index — automatically removes documents when expiresAt is reached
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema, 'refresh_tokens');
module.exports = RefreshToken;
