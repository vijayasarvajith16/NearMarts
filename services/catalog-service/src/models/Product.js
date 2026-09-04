'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      required: [true, 'vendorId is required.'],
      index: true,
    },
    vendorCity: {
      type: String,
      required: [true, 'vendorCity is required.'],
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      lowercase: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required.'],
      min: [0, 'Price must be non-negative.'],
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer price in smallest currency unit.',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required.'],
      min: [0, 'Stock cannot be negative.'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer.',
      },
    },
    unit: {
      type: String,
      required: [true, 'Unit is required.'],
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for city and category queries
productSchema.index({ vendorCity: 1, category: 1 });

// Text index on name, description, tags for search
productSchema.index(
  { name: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, tags: 5, description: 1 }, name: 'ProductTextIndex' }
);

module.exports = mongoose.model('Product', productSchema);
