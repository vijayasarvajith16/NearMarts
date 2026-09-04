'use strict';

const GATEWAY_BASE_URL = 'http://localhost:4000/api';

/**
 * Generic API request wrapper against API Gateway (/api/...)
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('nearmart_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${GATEWAY_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `HTTP error ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Auth Services ────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (userData) => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
};

// ── Vendor Services ──────────────────────────────────────────────────────────
export const vendorAPI = {
  getNearby: (lng, lat, category = '', maxDistance = 50000) => {
    let query = `/vendors/nearby?lng=${lng}&lat=${lat}&maxDistance=${maxDistance}`;
    if (category && category !== 'all') {
      query += `&category=${category}`;
    }
    return apiRequest(query);
  },
  getById: (id) => apiRequest(`/vendors/${id}`),
  getMe: () => apiRequest('/vendors/me'),
  createStore: (storeData) => apiRequest('/vendors', { method: 'POST', body: JSON.stringify(storeData) }),
  updateMe: (data) => apiRequest('/vendors/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getPending: (city = '') => apiRequest(`/vendors/pending${city ? '?city=' + encodeURIComponent(city) : ''}`),
  approve: (id) => apiRequest(`/vendors/${id}/approve`, { method: 'PATCH' }),
  reject: (id, rejectionReason) => apiRequest(`/vendors/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectionReason }) }),
};

// ── Catalog / Product Services ───────────────────────────────────────────────
export const productAPI = {
  getByVendor: (vendorId) => apiRequest(`/products?vendorId=${vendorId}`),
  search: (q, city, category = '') => {
    let query = `/products/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`;
    if (category && category !== 'all') query += `&category=${category}`;
    return apiRequest(query);
  },
  create: (productData) => apiRequest('/products', { method: 'POST', body: JSON.stringify(productData) }),
  update: (id, productData) => apiRequest(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(productData) }),
  delete: (id) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
};

// ── Cart Services ────────────────────────────────────────────────────────────
export const cartAPI = {
  getCart: () => apiRequest('/cart'),
  addItem: (productId, quantity = 1) => apiRequest('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  removeItem: (productId) => apiRequest(`/cart/items/${productId}`, { method: 'DELETE' }),
  clearCart: () => apiRequest('/cart', { method: 'DELETE' }),
};

// ── Order Services ───────────────────────────────────────────────────────────
export const orderAPI = {
  create: (orderData) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
  createOrder: (orderData) => apiRequest('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
  getById: (id) => apiRequest(`/orders/${id}`),
  listBuyerOrders: (buyerId) => apiRequest(`/orders?buyerId=${buyerId}`),
  listVendorOrders: (vendorId) => apiRequest(`/orders?vendorId=${vendorId}`),
  listAllOrders: () => apiRequest('/orders'),
  updateStatus: (id, status) => apiRequest(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ── Payment Services ─────────────────────────────────────────────────────────
export const paymentAPI = {
  verify: (data) => apiRequest('/payments/verify', { method: 'POST', body: JSON.stringify(data) }),
  getPaymentByOrder: (orderId) => apiRequest(`/payments/order/${orderId}`),
};

// ── Review Services ──────────────────────────────────────────────────────────
export const reviewAPI = {
  getVendorReviews: (vendorId) => apiRequest(`/reviews/vendor/${vendorId}`),
  addResponse: (reviewId, text) => apiRequest(`/reviews/${reviewId}/response`, { method: 'POST', body: JSON.stringify({ text }) }),
  createReview: (data) => apiRequest('/reviews', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Message / Chat Services ──────────────────────────────────────────────────
export const realtimeAPI = {
  getMessages: (orderId) => apiRequest(`/messages/${orderId}`),
};
export const messageAPI = realtimeAPI;

