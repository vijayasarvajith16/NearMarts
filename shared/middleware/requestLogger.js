'use strict';

/**
 * Simple morgan-style request logger.
 * Logs: METHOD /path STATUS duration_ms — at response finish.
 *
 * Usage:
 *   const requestLogger = require('./requestLogger');
 *   app.use(requestLogger);
 */
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = (Number(durationNs) / 1_000_000).toFixed(2);
    const { statusCode } = res;

    const level = statusCode >= 500 ? 'ERROR'
      : statusCode >= 400 ? 'WARN'
      : 'INFO';

    const ts = new Date().toISOString();
    console.log(`[${ts}] [${level}] ${method} ${originalUrl} ${statusCode} — ${durationMs}ms`);
  });

  next();
}

module.exports = requestLogger;
