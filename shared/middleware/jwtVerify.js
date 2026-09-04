'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware — verifies a Bearer JWT from the Authorization header.
 * On success, attaches { id, role, adminScope } to req.user and calls next().
 * On failure, returns 401 { error: '...' }.
 */
function jwtVerify(req, res, next) {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed.' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Misconfiguration — fail closed
    console.error('[jwtVerify] JWT_SECRET environment variable is not set.');
    return res.status(500).json({ error: 'Server misconfiguration.' });
  }

  try {
    const decoded = jwt.verify(token, secret);

    // Attach minimal claims to req.user
    req.user = {
      id: decoded.sub || decoded.id,
      role: decoded.role,
      adminScope: decoded.adminScope || null,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

module.exports = jwtVerify;
