# NearMart — Complete Schema Reference

> **Canonical source of truth** for all database schemas, Redis key patterns, and RabbitMQ
> event contracts across every microservice. Update this file whenever a schema changes.

---

## Cross-Service Reference Rule

> No service ever runs a query against another service's database. Any field that looks like a
> "join" (e.g. `vendorCity` on products, or item `name`/`price` snapshotted on orders) is
> **intentionally denormalized** at write time — either passed in the original request or filled
> in by an event consumer. This is what makes the services independently deployable.

---

## 1. Auth Service — `nearmart_auth`

### `users` collection

```js
{
  _id:          ObjectId,
  name:         String,          // required
  email:        String,          // required, unique, lowercase
  phone:        String,          // required, unique, E.164 format
  passwordHash: String,          // bcrypt, required  (select: false)
  role:         String,          // enum: "buyer" | "vendor" | "admin"
  adminScope: {                  // only present when role = "admin"
    level:    String,            // enum: "super" | "city" | "category"
    city:     String,            // required if level = "city" or "category"
    category: String             // required if level = "category"
  },
  isVerified: Boolean,           // default: false (phone/email OTP verified)
  status:     String,            // enum: "active" | "suspended", default: "active"
  createdAt:  Date,
  updatedAt:  Date
}
```

**Indexes:**
```js
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ phone: 1 }, { unique: true })
db.users.createIndex({ role: 1 })
```

---

### `refresh_tokens` collection

```js
{
  _id:       ObjectId,
  userId:    ObjectId,   // ref: users
  tokenHash: String,     // hashed — never store raw token
  expiresAt: Date,
  createdAt: Date
}
```

**Indexes:**
```js
// TTL index — auto-deletes expired tokens
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

## 2. Vendor Service — `nearmart_vendors`

### `vendors` collection

```js
{
  _id:         ObjectId,
  userId:      ObjectId,           // ref: auth.users (the vendor's login account)
  storeName:   String,             // required
  description: String,
  city:        String,             // required, indexed for admin queue filtering
  address: {
    line1:   String,
    line2:   String,
    pincode: String
  },
  location: {                      // GeoJSON — required for geo search
    type:        { type: String, enum: ["Point"], default: "Point" },
    coordinates: [Number]          // [longitude, latitude]
  },
  category: String,                // enum: "bakery" | "handmade" | "produce" | "plants" | "other"
  logoUrl:  String,
  kycDocs: [{
    type:       String,            // "id_proof" | "address_proof" | "fssai_license"
    url:        String,
    uploadedAt: Date
  }],
  approvalStatus:  String,         // enum: "pending" | "approved" | "rejected"
  approvedBy:      ObjectId,       // ref: auth.users (admin who approved)
  approvedAt:      Date,
  rejectionReason: String,
  selfDelivery:    Boolean,        // true = vendor delivers, false = platform delivery
  trustScore:      Number,         // 0-5, default: 3.0 (neutral start for new vendors)
  fulfillmentRate:         Number, // 0-1, % of orders not cancelled by vendor
  avgResponseTimeMinutes:  Number, // avg time to confirm an order
  isActive:   Boolean,             // default: true (vendor can pause store)
  createdAt:  Date,
  updatedAt:  Date
}
```

**Indexes:**
```js
db.vendors.createIndex({ location: "2dsphere" })
db.vendors.createIndex({ city: 1, approvalStatus: 1 })
db.vendors.createIndex({ category: 1 })
db.vendors.createIndex({ userId: 1 }, { unique: true })  // one store per user account
```

---

## 3. Catalog Service — `nearmart_catalog`

### `products` collection

```js
{
  _id:         ObjectId,
  vendorId:    ObjectId, // ref: vendors.vendors — NOT joined, denormalize vendorCity below
  vendorCity:  String,   // denormalized for fast city-scoped browsing without a join
  name:        String,   // required
  description: String,
  category:    String,   // matches vendor category taxonomy
  price:       Number,   // required, in paise/smallest unit to avoid float errors
  currency:    String,   // default: "INR"
  stock:       Number,   // required, default: 0
  unit:        String,   // "piece" | "kg" | "dozen" | "packet" etc.
  images:      [String], // array of URLs, first = primary
  isAvailable: Boolean,  // default: true (vendor can toggle without deleting)
  tags:        [String], // for search: ["eggless", "vegan", "organic"]
  createdAt:   Date,
  updatedAt:   Date
}
```

**Indexes:**
```js
db.products.createIndex({ vendorId: 1 })
db.products.createIndex({ vendorCity: 1, category: 1 })
db.products.createIndex({ name: "text", description: "text", tags: "text" })  // full-text search
```

---

### `categories` collection

```js
{
  _id:            ObjectId,
  name:           String,    // required, unique
  slug:           String,    // unique, url-safe
  parentCategory: ObjectId,  // ref: categories (self-ref, null for top-level)
  icon:           String
}
```

---

## 4. Order Service — `nearmart_orders`

### `orders` collection

```js
{
  _id:         ObjectId,
  orderNumber: String,       // human-readable, e.g. "NM-2026-000482", unique
  buyerId:     ObjectId,     // ref: auth.users
  vendorId:    ObjectId,     // ref: vendors.vendors
  items: [{
    productId: ObjectId,     // ref: catalog.products
    name:      String,       // snapshot at time of order — don't rely on live catalog
    price:     Number,       // snapshot (in paise)
    quantity:  Number,
    subtotal:  Number
  }],
  totalAmount: Number,       // required (in paise)
  deliveryAddress: {
    line1:   String,
    line2:   String,
    pincode: String,
    location: {              // GeoJSON, for future delivery-partner routing
      type:        { type: String, default: "Point" },
      coordinates: [Number]
    }
  },
  paymentMethod: String,     // enum: "ONLINE" | "COD"
  paymentStatus: String,     // enum: "PENDING" | "PAID" | "PENDING_ON_DELIVERY" | "FAILED"
  status: String,            // enum: "PLACED" | "CONFIRMED" | "PREPARING" |
                             //       "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED"
  statusHistory: [{          // audit trail — never mutate past entries
    status:    String,
    changedAt: Date,
    changedBy: ObjectId      // ref: auth.users
  }],
  cancellationReason: String,
  reviewSubmitted:    Boolean, // default: false — used by review-service gate
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
db.orders.createIndex({ buyerId: 1, createdAt: -1 })
db.orders.createIndex({ vendorId: 1, status: 1 })
db.orders.createIndex({ orderNumber: 1 }, { unique: true })
```

---

## 5. Payment Service — `nearmart_payments`

> **Append-only ledger** — never update a row in place, only insert new state entries.

### `payments` collection

```js
{
  _id:               ObjectId,
  orderId:           ObjectId,  // ref: orders.orders
  vendorId:          ObjectId,
  buyerId:           ObjectId,
  method:            String,    // enum: "ONLINE" | "COD"
  amount:            Number,    // in paise
  currency:          String,    // default: "INR"
  razorpayOrderId:   String,    // only for ONLINE
  razorpayPaymentId: String,    // set once captured
  status: String,               // enum: "CREATED" | "CAPTURED" | "FAILED" |
                                //       "REFUNDED" | "PENDING_ON_DELIVERY" | "COLLECTED"
  webhookEventId: String,       // razorpay event id — dedupe guard for webhook retries
  createdAt: Date
}
```

**Indexes:**
```js
db.payments.createIndex({ orderId: 1 })
db.payments.createIndex({ razorpayOrderId: 1 })
db.payments.createIndex({ webhookEventId: 1 }, { unique: true, sparse: true })
```

---

### `payouts` collection (vendor settlements — Phase 2)

```js
{
  _id:              ObjectId,
  vendorId:         ObjectId,
  periodStart:      Date,
  periodEnd:        Date,
  grossAmount:      Number,
  commissionAmount: Number,
  netPayoutAmount:  Number,
  status:           String,  // "PENDING" | "PROCESSED" | "FAILED"
  processedAt:      Date
}
```

---

## 6. Review Service — `nearmart_reviews`

### `reviews` collection

```js
{
  _id:       ObjectId,
  orderId:   ObjectId,  // ref: orders.orders — one review per order, enforced by unique index
  buyerId:   ObjectId,
  vendorId:  ObjectId,
  productId: ObjectId,
  rating:    Number,    // 1-5, required
  comment:   String,
  vendorResponse: {     // vendor can reply, not delete
    text:        String,
    respondedAt: Date
  },
  createdAt: Date
}
```

**Indexes:**
```js
db.reviews.createIndex({ orderId: 1 }, { unique: true })    // hard-enforces one review per order
db.reviews.createIndex({ vendorId: 1, createdAt: -1 })
```

---

## 7. Real-time Service — `nearmart_realtime`

### `messages` collection

```js
{
  _id:        ObjectId,
  orderId:    ObjectId,  // ref: orders.orders — chat is always order-scoped
  fromUserId: ObjectId,
  toUserId:   ObjectId,
  text:       String,
  readAt:     Date,      // null until read
  createdAt:  Date
}
```

**Indexes:**
```js
db.messages.createIndex({ orderId: 1, createdAt: 1 })
```

---

## 8. Notification Service — `nearmart_notifications`

### `notifications` collection

```js
{
  _id:               ObjectId,
  userId:            ObjectId,
  channel:           String,   // enum: "whatsapp" | "sms" | "push" | "email"
  template:          String,   // e.g. "order_confirmed", "vendor_approved"
  payload:           Object,   // template variables
  status:            String,   // "QUEUED" | "SENT" | "FAILED"
  providerMessageId: String,   // Twilio/Gupshup message id
  createdAt:         Date,
  sentAt:            Date
}
```

**Indexes:**
```js
db.notifications.createIndex({ userId: 1, createdAt: -1 })
```

---

## 9. Redis Key Patterns

All services share one Redis instance, **namespaced by prefix**.

| Key Pattern | Purpose | Type | TTL |
|---|---|---|---|
| `cart:{userId}` | Buyer's active cart | Hash (`productId → qty`) | 24h |
| `nearby:{geohash6}:{category}` | Cached geo search results | String (JSON) | 5 min |
| `session:{userId}` | Active session / token blacklist check | String | matches JWT expiry |
| `otp:{phone}` | OTP for phone verification | String | 5 min |
| `ratelimit:{ip}:{route}` | Gateway rate limiting counter | String (counter) | 1 min |
| `socket:presence:{userId}` | Online/offline status for chat | String (`"online"`) | 60s (heartbeat-refreshed) |

**Cart hash example:**
```
HSET cart:64f1a2... prod_123 2
HSET cart:64f1a2... prod_456 1
EXPIRE cart:64f1a2... 86400
```

---

## 10. Event Schemas (RabbitMQ)

- **Exchange:** `nearmart.events`
- **Exchange type:** `topic`
- **Routing key:** = `eventType` (e.g. `order.placed`)

**Envelope (all events):**
```js
{
  eventId:   String,   // UUID — for consumer-side idempotency
  eventType: String,   // e.g. "order.placed"
  timestamp: Date,
  payload:   Object    // event-specific, see table below
}
```

| Event Type | Published By | Consumed By | Payload |
|---|---|---|---|
| `order.placed` | order-service | catalog-service, payment-service | `{ orderId, vendorId, items: [{productId, quantity}] }` |
| `payment.captured` | payment-service | order-service, notification-service | `{ orderId, paymentId, amount }` |
| `payment.failed` | payment-service | order-service, notification-service | `{ orderId, reason }` |
| `order.confirmed` | order-service | realtime-service, notification-service | `{ orderId, buyerId, vendorId }` |
| `order.status_changed` | order-service | realtime-service, notification-service | `{ orderId, oldStatus, newStatus }` |
| `order.delivered` | order-service | notification-service (prompts review) | `{ orderId, buyerId, vendorId }` |
| `review.created` | review-service | vendor-service (recalc `trustScore`) | `{ vendorId, rating }` |
| `vendor.approved` | vendor-service | notification-service | `{ vendorId, userId }` |
