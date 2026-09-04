'use strict';

const mongoose = require('mongoose');
const Product  = require('../models/Product');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * POST /products — vendor creates a product.
 * Role must be "vendor". vendorId comes from req.user.id (JWT sub).
 * vendorCity is passed in the request body (denormalized).
 */
async function createProduct(req, res, next) {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Forbidden. Only vendors can create products.' });
    }

    const vendorId = req.user.id;
    const {
      vendorCity,
      name,
      description,
      category,
      price,
      currency,
      stock,
      unit,
      images,
      isAvailable,
      tags,
    } = req.body;

    if (!vendorCity) {
      return res.status(400).json({ error: 'vendorCity is required.' });
    }

    const product = new Product({
      vendorId,
      vendorCity,
      name,
      description,
      category,
      price,
      currency,
      stock,
      unit,
      images,
      isAvailable,
      tags,
    });

    await product.save();
    return res.status(201).json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * GET /products?vendorId= — list products.
 * If vendorId is supplied, filter by vendorId.
 */
async function listProducts(req, res, next) {
  try {
    const { vendorId, category, isAvailable, limit = 50, page = 1 } = req.query;

    const filter = {};

    if (vendorId) {
      if (!OBJECT_ID_REGEX.test(vendorId)) {
        return res.status(400).json({ error: 'Invalid vendorId format.' });
      }
      filter.vendorId = vendorId;
    }

    if (category) {
      filter.category = category.toLowerCase();
    }

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === 'true' || isAvailable === true;
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    return res.json({ products, total, page: pageNum, limit: limitNum });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /products/search?q=&city=&category= — text search scoped to a city.
 */
async function searchProducts(req, res, next) {
  try {
    const { q, city, vendorCity, category, limit = 50, page = 1 } = req.query;
    const searchCity = city || vendorCity;

    if (!searchCity) {
      return res.status(400).json({ error: 'city query parameter is required.' });
    }

    const filter = {
      vendorCity: searchCity.toLowerCase(),
      isAvailable: true,
    };

    if (category) {
      filter.category = category.toLowerCase();
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    let query;
    let sortOption = { createdAt: -1 };

    if (q && q.trim().length > 0) {
      filter.$text = { $search: q.trim() };
      sortOption = { score: { $meta: 'textScore' } };
      query = Product.find(filter, { score: { $meta: 'textScore' } });
    } else {
      query = Product.find(filter);
    }

    const [products, total] = await Promise.all([
      query.sort(sortOption).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    return res.json({ products, total, page: pageNum, limit: limitNum });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /products/:id — update product (owner only).
 */
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this product.' });
    }

    const allowedUpdates = [
      'name',
      'description',
      'category',
      'price',
      'currency',
      'stock',
      'unit',
      'images',
      'isAvailable',
      'tags',
      'vendorCity',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();
    return res.json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * DELETE /products/:id — delete product (owner only).
 */
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this product.' });
    }

    await product.deleteOne();
    return res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /products/:id/stock — internal-use endpoint to decrement stock.
 */
async function updateStock(req, res, next) {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const quantity = Number(req.body.quantity || req.body.decrementBy || req.body.qty || 1);
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid decrement quantity is required.' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const newStock = Math.max(0, product.stock - quantity);
    product.stock = newStock;
    if (newStock === 0) {
      product.isAvailable = false;
    }
    await product.save();

    return res.json({ message: 'Stock updated successfully.', product });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createProduct,
  listProducts,
  searchProducts,
  updateProduct,
  deleteProduct,
  updateStock,
};
