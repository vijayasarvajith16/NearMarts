'use strict';

const Product = require('../models/Product');
const redis   = require('../redis');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const CART_TTL_SECONDS = 86400; // 24 hours

/**
 * POST /cart/items — add {productId, quantity} to Redis hash cart:{userId}
 */
async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId || !OBJECT_ID_REGEX.test(productId)) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    const qtyNumber = parseInt(quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    // Verify product exists in MongoDB
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (!product.isAvailable) {
      return res.status(400).json({ error: 'Product is currently unavailable.' });
    }

    const cartKey = `cart:${userId}`;

    // Get current item quantity from Redis
    const currentQtyStr = await redis.hget(cartKey, productId);
    const currentQty = currentQtyStr ? parseInt(currentQtyStr, 10) : 0;
    const newQty = currentQty + qtyNumber;

    // Set updated quantity in Redis hash
    await redis.hset(cartKey, productId, String(newQty));

    // Reset 24h TTL on cart hash
    await redis.expire(cartKey, CART_TTL_SECONDS);

    return res.status(200).json({
      message: 'Item added to cart.',
      cartKey,
      productId,
      quantity: newQty,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /cart — return buyer's cart contents enriched with product details.
 */
async function getCart(req, res, next) {
  try {
    const userId = req.user.id;
    const cartKey = `cart:${userId}`;

    const rawCart = await redis.hgetall(cartKey);

    if (!rawCart || Object.keys(rawCart).length === 0) {
      return res.json({ items: [], totalItems: 0, totalAmount: 0 });
    }

    const productIds = Object.keys(rawCart);

    // Fetch product details for each item in batch
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    const productMap = new Map();
    products.forEach((p) => productMap.set(p._id.toString(), p));

    let totalItems = 0;
    let totalAmount = 0;
    const items = [];

    for (const [pId, qtyStr] of Object.entries(rawCart)) {
      const qty = parseInt(qtyStr, 10) || 0;
      const product = productMap.get(pId);

      if (product && qty > 0) {
        const itemSubtotal = product.price * qty;
        totalItems += qty;
        totalAmount += itemSubtotal;

        items.push({
          productId: pId,
          quantity: qty,
          itemSubtotal,
          product: {
            _id: product._id,
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            currency: product.currency,
            stock: product.stock,
            unit: product.unit,
            images: product.images,
            isAvailable: product.isAvailable,
            tags: product.tags,
            vendorId: product.vendorId,
            vendorCity: product.vendorCity,
          },
        });
      }
    }

    return res.json({ items, totalItems, totalAmount });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /cart/items/:productId — remove one item from cart.
 */
async function removeFromCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId || !OBJECT_ID_REGEX.test(productId)) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    const cartKey = `cart:${userId}`;
    await redis.hdel(cartKey, productId);

    // Refresh 24h TTL if key still has items
    await redis.expire(cartKey, CART_TTL_SECONDS);

    return res.json({ message: 'Item removed from cart.' });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /cart — clear entire cart.
 */
async function clearCart(req, res, next) {
  try {
    const userId = req.user.id;
    const cartKey = `cart:${userId}`;

    await redis.del(cartKey);

    return res.json({ message: 'Cart cleared successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
};
