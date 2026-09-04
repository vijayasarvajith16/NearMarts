'use strict';

const mongoose = require('mongoose');

// ── KYC document sub-schema ───────────────────────────────────────────────────
const kycDocSchema = new mongoose.Schema(
  {
    type:       { type: String, enum: ['id_proof', 'address_proof', 'fssai_license'], required: true },
    url:        { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Address sub-schema ────────────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    line1:   { type: String },
    line2:   { type: String },
    pincode: { type: String },
  },
  { _id: false }
);

// ── Main vendor schema ────────────────────────────────────────────────────────
const vendorSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    userId:      { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    storeName:   { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    city:        { type: String, required: true, trim: true, lowercase: true },
    address:     { type: addressSchema },

    // ── Location (GeoJSON) ────────────────────────────────────────────────────
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },  // [longitude, latitude]
    },

    // ── Catalog metadata ──────────────────────────────────────────────────────
    category: {
      type: String,
      enum: ['bakery', 'handmade', 'produce', 'plants', 'other'],
      required: true,
    },
    logoUrl: { type: String },
    kycDocs: { type: [kycDocSchema], default: [] },

    // ── Approval workflow ─────────────────────────────────────────────────────
    approvalStatus:  { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy:      { type: mongoose.Schema.Types.ObjectId, default: null }, // ref: auth.users
    approvedAt:      { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    // ── Operations ────────────────────────────────────────────────────────────
    selfDelivery:           { type: Boolean, default: false },
    trustScore:             { type: Number, default: 3.0, min: 0, max: 5 },
    fulfillmentRate:        { type: Number, default: null },   // 0-1
    avgResponseTimeMinutes: { type: Number, default: null },
    isActive:               { type: Boolean, default: true },
  },
  {
    timestamps: true,   // createdAt, updatedAt
    versionKey: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
vendorSchema.index({ location: '2dsphere' });
vendorSchema.index({ city: 1, approvalStatus: 1 });
vendorSchema.index({ category: 1 });
// userId unique index already declared via { unique: true } in the field def

const Vendor = mongoose.model('Vendor', vendorSchema, 'vendors');
module.exports = Vendor;
