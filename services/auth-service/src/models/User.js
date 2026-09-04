'use strict';

const mongoose = require('mongoose');

/**
 * users collection
 *
 * Fields:
 *   name          — display name
 *   email         — unique, indexed
 *   phone         — unique, indexed
 *   passwordHash  — bcrypt hash, never returned via toJSON
 *   role          — buyer | vendor | admin
 *   adminScope    — only meaningful when role === 'admin'
 *   isVerified    — email/phone verification flag
 *   status        — active | suspended
 */
const adminScopeSchema = new mongoose.Schema(
  {
    level:    { type: String, enum: ['super', 'city', 'category'] },
    city:     { type: String, default: null },
    category: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:        { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false }, // never sent to client by default
    role:         { type: String, enum: ['buyer', 'vendor', 'admin'], default: 'buyer' },
    adminScope:   { type: adminScopeSchema, default: null },
    isVerified:   { type: Boolean, default: false },
    status:       { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt automatically
    versionKey: false,
  }
);

// Strip sensitive fields when serialising to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
