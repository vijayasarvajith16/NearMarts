'use strict';

const ngeohash      = require('ngeohash');
const Vendor        = require('../models/Vendor');
const redis         = require('../redis');
const publishEvent  = require('../../../../shared/middleware/publishEvent');

const NEARBY_CACHE_TTL = 300; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — admin authorisation + city-scope enforcement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that the requester is an admin and, if they are a city-scoped admin,
 * that their city matches the vendor's city.
 *
 * @param {object} user        - req.user (id, role, adminScope)
 * @param {object} vendor      - Vendor mongoose document
 * @param {object} res         - Express response (used to send 403 on failure)
 * @returns {boolean}          - true if authorised, false if response already sent
 */
function assertAdmin(user, vendor, res) {
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }

  const scope = user.adminScope;
  if (scope && scope.level === 'city') {
    if (!scope.city || scope.city.toLowerCase() !== vendor.city.toLowerCase()) {
      res.status(403).json({ error: 'This vendor is outside your city scope.' });
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /vendors
// Vendor creates their store profile — status defaults to "pending"
// ─────────────────────────────────────────────────────────────────────────────
async function createVendor(req, res, next) {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Only users with role "vendor" can create a store.' });
    }

    const {
      storeName, description, city, address,
      location, category, logoUrl, kycDocs, selfDelivery,
    } = req.body;

    // Basic validation
    if (!storeName || !city || !location || !category) {
      return res.status(400).json({
        error: 'storeName, city, location, and category are required.',
      });
    }

    if (
      !location.coordinates ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        error: 'location.coordinates must be [longitude, latitude].',
      });
    }

    // One store per user account (userId unique index will also catch duplicates)
    const existing = await Vendor.findOne({ userId: req.user.id });
    if (existing) {
      return res.status(409).json({ error: 'You already have a registered store.' });
    }

    const vendor = await Vendor.create({
      userId: req.user.id,
      storeName,
      description,
      city: city.toLowerCase().trim(),
      address,
      location: {
        type:        'Point',
        coordinates: location.coordinates,
      },
      category,
      logoUrl,
      kycDocs,
      selfDelivery,
    });

    return res.status(201).json({ vendor });
  } catch (err) {
    // Duplicate userId (race condition)
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You already have a registered store.' });
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /vendors/nearby?lng=&lat=&maxDistance=&category=
// Public — geo search using $near, Redis-cached by geohash6 + category
// ─────────────────────────────────────────────────────────────────────────────
async function getNearby(req, res, next) {
  try {
    const { lng, lat, maxDistance = 5000, category } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ error: 'lng and lat query params are required.' });
    }

    const longitude   = parseFloat(lng);
    const latitude    = parseFloat(lat);
    const maxDistMeters = parseInt(maxDistance, 10);

    if (isNaN(longitude) || isNaN(latitude)) {
      return res.status(400).json({ error: 'lng and lat must be valid numbers.' });
    }

    // ── Redis cache lookup ──────────────────────────────────────────────────
    const geohash6   = ngeohash.encode(latitude, longitude, 6); // precision ~1.2 km
    const cacheKey   = `nearby:${geohash6}:${category || 'all'}`;
    const cached     = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({ vendors: cached, source: 'cache' });
    }

    // ── MongoDB $near query ─────────────────────────────────────────────────
    const filter = {
      approvalStatus: 'approved',
      isActive:       true,
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: maxDistMeters,
        },
      },
    };

    if (category) filter.category = category;

    const vendors = await Vendor.find(filter).lean();

    // ── Cache result (even empty arrays — avoids repeated Mongo hits) ───────
    await redis.set(cacheKey, vendors, NEARBY_CACHE_TTL);

    return res.status(200).json({ vendors, source: 'db' });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /vendors/pending?city=
// Admin queue — filtered by their adminScope automatically
// ─────────────────────────────────────────────────────────────────────────────
async function getPending(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const filter = { approvalStatus: 'pending' };

    const scope = req.user.adminScope;
    if (scope && (scope.level === 'city' || scope.level === 'category')) {
      // City-scoped admins only see their city
      if (scope.city) filter.city = scope.city.toLowerCase();
      // Category-scoped admins also filter by category
      if (scope.level === 'category' && scope.category) filter.category = scope.category;
    } else if (req.query.city) {
      // Super-admins can optionally filter by city query param
      filter.city = req.query.city.toLowerCase();
    }

    const vendors = await Vendor.find(filter).sort({ createdAt: 1 }).lean();
    return res.status(200).json({ vendors });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /vendors/:id
// Public store page
// ─────────────────────────────────────────────────────────────────────────────
async function getById(req, res, next) {
  try {
    // Guard against invalid ObjectId strings (e.g. "12345", XSS payloads)
    if (!req.params.id.match(/^[a-f\d]{24}$/i)) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    return res.status(200).json({ vendor });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /vendors/:id/approve
// Admin only — city-scope enforced
// ─────────────────────────────────────────────────────────────────────────────
async function approveVendor(req, res, next) {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    if (!assertAdmin(req.user, vendor, res)) return;

    if (vendor.approvalStatus === 'approved') {
      return res.status(409).json({ error: 'Vendor is already approved.' });
    }

    vendor.approvalStatus  = 'approved';
    vendor.approvedBy      = req.user.id;
    vendor.approvedAt      = new Date();
    vendor.rejectionReason = null;
    await vendor.save();

    // Publish vendor.approved event — non-blocking, best-effort
    publishEvent('vendor.approved', {
      vendorId: vendor._id.toString(),
      userId:   vendor.userId.toString(),
    }).catch((err) => console.error('[vendor-service] Failed to publish vendor.approved:', err.message));

    // Invalidate nearby cache for the vendor's geohash region (best-effort)
    const [lng, lat] = vendor.location.coordinates;
    const geohash6   = ngeohash.encode(lat, lng, 6);
    redis.scanKeys(`nearby:${geohash6}:*`)
      .then((keys) => keys.length && redis.del(...keys))
      .catch(() => {});

    return res.status(200).json({ vendor });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /vendors/:id/reject
// Admin only — requires rejectionReason in body
// ─────────────────────────────────────────────────────────────────────────────
async function rejectVendor(req, res, next) {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required.' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    if (!assertAdmin(req.user, vendor, res)) return;

    if (vendor.approvalStatus === 'rejected') {
      return res.status(409).json({ error: 'Vendor is already rejected.' });
    }

    vendor.approvalStatus  = 'rejected';
    vendor.rejectionReason = rejectionReason.trim();
    vendor.approvedBy      = null;
    vendor.approvedAt      = null;
    await vendor.save();

    return res.status(200).json({ vendor });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /vendors/me
// Get authenticated vendor's own store profile
// ─────────────────────────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const vendor = await Vendor.findOne({ userId: req.user.id }).lean();
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor store profile not found.' });
    }
    return res.status(200).json({ vendor });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /vendors/me
// Update authenticated vendor's own store settings (isActive, description, etc.)
// ─────────────────────────────────────────────────────────────────────────────
async function updateMe(req, res, next) {
  try {
    const vendor = await Vendor.findOne({ userId: req.user.id });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor store profile not found.' });
    }

    const { storeName, description, isActive, category, selfDelivery, logoUrl, address } = req.body;

    if (storeName !== undefined) vendor.storeName = storeName;
    if (description !== undefined) vendor.description = description;
    if (isActive !== undefined) vendor.isActive = Boolean(isActive);
    if (category !== undefined) vendor.category = category;
    if (selfDelivery !== undefined) vendor.selfDelivery = Boolean(selfDelivery);
    if (logoUrl !== undefined) vendor.logoUrl = logoUrl;
    if (address !== undefined) vendor.address = address;

    await vendor.save();

    return res.status(200).json({ vendor });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createVendor,
  getNearby,
  getPending,
  getById,
  approveVendor,
  rejectVendor,
  getMe,
  updateMe,
};
