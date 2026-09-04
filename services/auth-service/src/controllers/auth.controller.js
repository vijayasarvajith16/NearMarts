'use strict';

const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const User         = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const BCRYPT_ROUNDS         = 12;
const BCRYPT_TOKEN_ROUNDS   = 10;   // lower cost — tokens are long random strings, not passwords
const JWT_EXPIRES_IN        = process.env.JWT_EXPIRES_IN        || '15m';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = parseInt(
  (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d').replace('d', ''), 10
);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function signJwt(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');

  return jwt.sign(
    {
      sub:        user._id.toString(),
      id:         user._id.toString(),
      role:       user.role,
      adminScope: user.adminScope || null,
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function createRefreshToken(userId) {
  const rawToken  = `${userId}:${crypto.randomBytes(48).toString('hex')}`;
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_TOKEN_ROUNDS);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({ userId, tokenHash, expiresAt });
  return rawToken;  // only the raw token is returned — never stored
}

// ─────────────────────────────────────────────────────────────────
// POST /auth/signup
// ─────────────────────────────────────────────────────────────────
async function signup(req, res, next) {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'name, email, phone, and password are required.' });
    }

    // Duplicate checks (email or phone already taken)
    const exists = await User.findOne({ $or: [{ email }, { phone }] });
    if (exists) {
      const field = exists.email === email.toLowerCase() ? 'email' : 'phone';
      return res.status(409).json({ error: `A user with that ${field} already exists.` });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: role || 'buyer',
    });

    const accessToken  = signJwt(user);
    const refreshToken = await createRefreshToken(user._id);

    return res.status(201).json({
      message:      'User created successfully.',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    // select: false on passwordHash — must explicitly request it
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const accessToken  = signJwt(user);
    const refreshToken = await createRefreshToken(user._id);

    return res.status(200).json({
      message:      'Login successful.',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────────────────────────
async function refresh(req, res, next) {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) {
      return res.status(400).json({ error: 'refreshToken is required.' });
    }

    // We cannot query by hash directly (bcrypt is non-deterministic with per-hash salts),
    // so we load all non-expired token docs for the userId embedded in the raw token.
    // To avoid a full-collection scan we decode a userId hint from the token's prefix,
    // but the simplest safe approach for a single-user session model is: the client
    // must send userId alongside, OR we scan and bcrypt.compare each candidate.
    //
    // Strategy: We store no userId hint in the raw token, so we must find candidates
    // by scanning recent non-expired docs and comparing. To keep this O(sessions per user)
    // we require the client to also send their userId (extracted from the still-valid
    // or just-expired access token's sub claim).
    //
    // Simpler production approach used here: embed userId as a prefix in the raw token
    // so we can filter candidates before comparing.
    //
    // Token format: "{userId}:{randomHex48}"
    const separatorIdx = rawToken.indexOf(':');
    if (separatorIdx === -1) {
      return res.status(401).json({ error: 'Invalid refresh token format.' });
    }
    const claimedUserId = rawToken.slice(0, separatorIdx);

    // Load all non-expired token docs for this user (typically 1–2)
    const candidates = await RefreshToken.find({
      userId:    claimedUserId,
      expiresAt: { $gt: new Date() },
    });

    if (candidates.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    // bcrypt.compare against each candidate; constant-time, stops on first match
    let matchedDoc = null;
    for (const doc of candidates) {
      const isMatch = await bcrypt.compare(rawToken, doc.tokenHash);
      if (isMatch) { matchedDoc = doc; break; }
    }

    if (!matchedDoc) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(matchedDoc.userId);
    if (!user || user.status === 'suspended') {
      return res.status(401).json({ error: 'User not found or suspended.' });
    }

    // Rotate: delete old, issue new
    await matchedDoc.deleteOne();
    const newAccessToken  = signJwt(user);
    const newRefreshToken = await createRefreshToken(user._id);

    return res.status(200).json({
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /users/:id/contact (internal endpoint for notifications)
// ─────────────────────────────────────────────────────────────────
async function getUserContact(req, res, next) {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = await User.findById(id).select('name phone email role');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ id: user._id, name: user.name, phone: user.phone, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, me, getUserContact };
