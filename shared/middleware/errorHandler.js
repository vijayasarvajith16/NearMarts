'use strict';

/**
 * Centralized Express error handler.
 * Must be registered LAST as an Express middleware (4-arg signature).
 *
 * Client sees:   { error: "<message>" }
 * Server logs:   full stack trace (never sent to client)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log stack server-side only
  console.error(`[ErrorHandler] ${req.method} ${req.originalUrl}`);
  console.error(err.stack || err.message || err);

  const statusCode = typeof err.status === 'number' ? err.status
    : typeof err.statusCode === 'number' ? err.statusCode
    : 500;

  // Never leak internals in production
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error.'
      : err.message || 'Something went wrong.';

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
