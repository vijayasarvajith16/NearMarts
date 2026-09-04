'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwtVerify = require('../../shared/middleware/jwtVerify');
const requestLogger = require('../../shared/middleware/requestLogger');

const app = express();

// ── 0. CORS Middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ── 1. Request Logging ────────────────────────────────────────────────────────
app.use(requestLogger);

// ── 2. IP Rate Limiter (100 requests per minute) ──────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after a minute.' },
});
app.use(limiter);

// ── 3. Centralized Gateway JWT Authentication ────────────────────────────────
/**
 * Gateway-level JWT Authentication Middleware.
 * Applies jwtVerify to all protected routes, while exempting public browsing
 * and authentication endpoints.
 */
function gatewayAuthFilter(req, res, next) {
  const path = req.path;
  const method = req.method;

  // Always exempt OPTIONS preflight requests from JWT check
  if (method === 'OPTIONS') {
    return next();
  }

  // Exempt public endpoints
  if (
    (method === 'POST' && path === '/api/auth/signup') ||
    (method === 'POST' && path === '/api/auth/login') ||
    (method === 'POST' && path === '/api/auth/refresh') ||
    (method === 'GET'  && path.startsWith('/api/vendors/nearby')) ||
    (method === 'GET'  && path.startsWith('/api/products/search')) ||
    (method === 'GET'  && path.startsWith('/api/products')) ||
    (method === 'GET'  && path.startsWith('/api/reviews/vendor')) ||
    (method === 'POST' && path.startsWith('/api/webhooks')) ||
    path === '/health' ||
    path === '/'
  ) {
    return next();
  }

  return jwtVerify(req, res, next);
}

app.use(gatewayAuthFilter);

// ── 4. Target Service URLs (Read from environment for K8s / Docker Compose) ────
const targets = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  vendor: process.env.VENDOR_SERVICE_URL || 'http://localhost:4002',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:4003',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:4004',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4005',
  review: process.env.REVIEW_SERVICE_URL || 'http://localhost:4006',
  realtime: process.env.REALTIME_SERVICE_URL || 'http://localhost:4007',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4008',
};

// ── 5. Proxy Route Configurations ────────────────────────────────────────────

// /api/auth/* -> auth-service (:4001)
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: targets.auth,
    changeOrigin: true,
    pathRewrite: { '^/api/auth': '/auth' },
  })
);

// /api/vendors/* -> vendor-service (:4002)
app.use(
  '/api/vendors',
  createProxyMiddleware({
    target: targets.vendor,
    changeOrigin: true,
    pathRewrite: { '^/api/vendors': '/vendors' },
  })
);

// /api/products/* -> catalog-service (:4003)
app.use(
  '/api/products',
  createProxyMiddleware({
    target: targets.catalog,
    changeOrigin: true,
    pathRewrite: { '^/api/products': '/products' },
  })
);

// /api/cart/* -> catalog-service (:4003)
app.use(
  '/api/cart',
  createProxyMiddleware({
    target: targets.catalog,
    changeOrigin: true,
    pathRewrite: { '^/api/cart': '/cart' },
  })
);

// /api/orders/* -> order-service (:4004)
app.use(
  '/api/orders',
  createProxyMiddleware({
    target: targets.order,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/orders' },
  })
);

// /api/payments/* -> payment-service (:4005)
app.use(
  '/api/payments',
  createProxyMiddleware({
    target: targets.payment,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '/payments' },
  })
);

// /api/webhooks/* -> payment-service (:4005)
app.use(
  '/api/webhooks',
  createProxyMiddleware({
    target: targets.payment,
    changeOrigin: true,
    pathRewrite: { '^/api/webhooks': '/webhooks' },
  })
);

// /api/reviews/* -> review-service (:4006)
app.use(
  '/api/reviews',
  createProxyMiddleware({
    target: targets.review,
    changeOrigin: true,
    pathRewrite: { '^/api/reviews': '/reviews' },
  })
);

/**
 * /api/messages/* -> realtime-service (:4007) [REST endpoints only]
 *
 * Architecture Note:
 * Realtime Socket.io connections connect DIRECTLY to realtime-service's own port (:4007),
 * bypassing the Gateway to prevent WebSocket handshake and proxy buffering issues.
 * Only HTTP REST endpoints (such as GET /api/messages/:orderId) route through this Gateway proxy.
 */
app.use(
  '/api/messages',
  createProxyMiddleware({
    target: targets.realtime,
    changeOrigin: true,
    pathRewrite: { '^/api/messages': '/messages' },
  })
);

// /api/notifications/* -> notification-service (:4008)
app.use(
  '/api/notifications',
  createProxyMiddleware({
    target: targets.notification,
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '/notifications' },
  })
);

// ── 6. Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'gateway',
    targets,
  })
);

// ── 7. 404 Handler ───────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Gateway route not found.' }));

module.exports = app;
