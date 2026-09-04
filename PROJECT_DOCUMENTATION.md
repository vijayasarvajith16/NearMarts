# NearMart — Hyperlocal E-Commerce Platform
### Architecture, Technology Stack, System Workflows, Schemas & Entity-Relationship (ER) Documentation

---

## 1. Executive Summary

**NearMart** is an enterprise-grade, distributed hyperlocal commerce platform engineered to connect neighborhood artisans, bakeries, indie roasters, urban growers, and specialty makers directly with nearby consumers for rapid local delivery.

Unlike traditional broad-market e-commerce, NearMart is architected around **geospatial proximity** (sub-50ms radius queries), **event-driven asynchronous workflows**, **real-time bi-directional synchronization**, and a **Shopify-inspired cinematic dark canvas design system**.

---

## 2. System Architecture

NearMart utilizes a decoupled **Microservices Architecture** orchestrated through an **API Gateway (Reverse Proxy)** with an **Asynchronous Event-Driven Messaging Bus (RabbitMQ)** and a **Shared In-Memory Cache/Adapter Layer (Redis)**.

```mermaid
graph TD
    subgraph Clients
        BuyerClient["Web Client (Buyer Flow)"]
        VendorClient["Web Client (Vendor Hub)"]
        AdminClient["Web Client (Admin Panel)"]
    end

    Gateway["API Gateway (Port 4000)<br/>Reverse Proxy · JWT Verification · Rate Limiter"]

    subgraph Core Services
        AuthService["Auth Service (Port 4001)<br/>JWT, Token Rotation, Roles"]
        VendorService["Vendor Service (Port 4002)<br/>Geo-Discovery 2dsphere, Store KYC"]
        CatalogService["Catalog Service (Port 4003)<br/>Product CRUD, Inventory, Cart"]
        OrderService["Order Service (Port 4004)<br/>State Machine, Life-cycle Pipeline"]
        PaymentService["Payment Service (Port 4005)<br/>Razorpay Orders & Webhooks"]
        ReviewService["Review Service (Port 4006)<br/>Ratings, Store Trust, Merchant Replies"]
    end

    subgraph Real-Time & Event Services
        RealtimeService["Realtime Service (Port 4007)<br/>Socket.io Cluster, Redis Adapter, Chat"]
        NotificationService["Notification Service (Port 4008)<br/>Twilio WhatsApp, Template Registry"]
    end

    subgraph Messaging & Cache
        RabbitMQ["RabbitMQ Message Broker<br/>Exchanges: order.events, payment.events"]
        Redis["Redis Cache & Pub/Sub<br/>Geo-cache, Session store, Socket adapter"]
    end

    subgraph Databases
        MongoAuth[("nearmart_auth")]
        MongoVendor[("nearmart_vendors")]
        MongoCatalog[("nearmart_catalog")]
        MongoOrder[("nearmart_orders")]
        MongoPayment[("nearmart_payments")]
        MongoReview[("nearmart_reviews")]
        MongoRealtime[("nearmart_realtime")]
        MongoNotification[("nearmart_notifications")]
    end

    Clients -->|HTTP / REST| Gateway
    Clients -.->|WebSockets wss://| RealtimeService

    Gateway -->|/api/auth| AuthService
    Gateway -->|/api/vendors| VendorService
    Gateway -->|/api/products, /api/cart| CatalogService
    Gateway -->|/api/orders| OrderService
    Gateway -->|/api/payments| PaymentService
    Gateway -->|/api/reviews| ReviewService
    Gateway -->|/api/messages| RealtimeService

    AuthService --> MongoAuth
    VendorService --> MongoVendor
    CatalogService --> MongoCatalog
    OrderService --> MongoOrder
    PaymentService --> MongoPayment
    ReviewService --> MongoReview
    RealtimeService --> MongoRealtime
    NotificationService --> MongoNotification

    VendorService <--> Redis
    RealtimeService <--> Redis

    OrderService -->|Publish Events| RabbitMQ
    PaymentService -->|Publish Events| RabbitMQ
    RabbitMQ -->|Consume Events| NotificationService
    RabbitMQ -->|Consume Events| OrderService
    RabbitMQ -->|Consume Events| RealtimeService
    RabbitMQ -->|Consume Events| CatalogService
    RabbitMQ -->|Consume Events| VendorService
```

---

## 3. Technology Stack & Tech Utilization

| Technology | Layer | Role in NearMart | Why it Was Chosen |
| :--- | :--- | :--- | :--- |
| **Node.js & Express** | Backend Services & Gateway | Powers the API Gateway and all 8 microservices | Non-blocking asynchronous I/O, lightweight footprint, robust HTTP routing ecosystem. |
| **React 19 & Vite** | Frontend Client | Drives the buyer experience, vendor workspace, and admin moderation portal | Ultra-fast HMR build speeds, component modularity, modern Hooks state model. |
| **Vanilla CSS (Shopify Design System)** | UI Styling Architecture | Defines tokens, elevations (Level 1/2/3), pill buttons, thin typography | 100% control without CSS framework overhead; strictly enforces Shopify design constraints. |
| **MongoDB & Mongoose** | Primary Persistence | Per-service isolated database instances (`nearmart_*`) | Native JSON-like document flexibility; built-in geospatial `$near` spatial index support. |
| **Redis & ioredis** | In-Memory Cache & Adapter | Caches vendor geo-queries, flushes on updates, connects Socket.io adapter | Microsecond latency, distributed pub/sub, prevents database bottlenecks during surges. |
| **RabbitMQ & amqplib** | Event Message Broker | Asynchronous decoupled message passing across microservices | Guarantees at-least-once message delivery, durable queues, prevents cascading failure. |
| **Socket.io & Redis Adapter** | Real-Time Engine | Powers live order state updates and bi-directional customer-to-vendor messaging | Room-based isolation (`order:{id}`, `user:{id}`) horizontally scalable across nodes. |
| **Razorpay SDK & Webhooks** | Payment Processing | Generates checkout orders and verifies signatures with HMAC-SHA256 | Compliant Indian payment rails (UPI, cards, netbanking) with asynchronous webhook confirmation. |
| **Twilio API** | Outbound Notifications | Dispatches automated WhatsApp and SMS template alerts to buyers and vendors | Reliable global delivery for transactional milestones (e.g., order placed, out for delivery). |
| **JWT & bcryptjs** | Authentication & Security | Stateless access tokens (15m TTL), refresh token rotation (7d TTL), salted password hashing | Industry-standard role-gated protection (`buyer`, `vendor`, `admin`) across all gateways. |
| **Docker & Docker Compose** | Infrastructure & Orchestration | Spins up containerized MongoDB, Redis, and RabbitMQ instances | One-command reproducible local and staging infrastructure setup. |

---

## 4. End-to-End System Workflows

### 4.1 Buyer Discovery to Order Delivery Flow
1. **Location Resolution**: Buyer loads home page; browser requests geolocation coordinates (`lng`, `lat`). If granted, client calls `GET /api/vendors/nearby?lng=...&lat=...`. If denied, buyer selects city from manual dropdown.
2. **Catalog Browsing**: Buyer clicks merchant card → requests `GET /api/vendors/:id` and `GET /api/products?vendorId=...`.
3. **Cart Assembly**: Adding items hits `POST /api/cart/items`. Cart operations validate merchant consistency (one vendor per order).
4. **Checkout**: Buyer inputs delivery address, selects **ONLINE** (Razorpay) or **COD**, and submits `POST /api/orders`.
5. **Payment Authorization**: For online orders, Razorpay Checkout widget initializes. Upon capture, webhook hits `POST /api/payments/webhook` with HMAC signature verification.
6. **Live Tracking**: Client navigates to `/tracking/:orderId`, establishing a WebSocket connection to `realtime-service` (`ws://localhost:4007`). Client joins room `order:{orderId}` to receive status changes (`PLACED` → `PREPARING` → `OUT_FOR_DELIVERY` → `DELIVERED`).

### 4.2 Vendor Store Management & Kanban Inbox
1. **Onboarding**: Merchant signs up with `role: "vendor"`, submits store KYC profile via `POST /api/vendors`. Store defaults to `approvalStatus: "pending"`.
2. **Product Management**: Vendor manages catalog via `ProductManagement.jsx` (`POST/PATCH/DELETE /api/products`).
3. **Order Inbox**: `OrderInbox.jsx` polls and listens to orders. Orders appear under the 4-column Kanban board. Vendor advances state by clicking progression pills (`PATCH /api/orders/:id/status`).
4. **Store Settings**: Vendor toggles `isActive` status or `selfDelivery` via pure CSS toggle switches (`PATCH /api/vendors/me`).

### 4.3 Admin Moderation & City Governance
1. **Role Gating**: Admin signs in with `role: "admin"` (e.g., `admin@nearmart.com`).
2. **Pending Queue**: Admins view unapproved stores filtered by city scope (`GET /api/vendors/pending?city=...`).
3. **Verification Decision**:
   - **Approve**: Hits `PATCH /api/vendors/:id/approve`. Vendor `approvalStatus` becomes `approved` and is immediately indexed for buyer discovery.
   - **Reject**: Admin supplies rejection reason via modal (`PATCH /api/vendors/:id/reject`). Store is rejected and vendor notified.
4. **Platform Analytics**: Admin inspects real-time GMV, order volume, and active merchant metrics.

---

## 5. Event-Driven Message Flow (RabbitMQ)

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    participant Gateway as API Gateway
    participant OrderService as Order Service
    participant PaymentService as Payment Service
    participant RabbitMQ as RabbitMQ Broker
    participant RealtimeService as Realtime Service
    participant NotificationService as Notification Service

    Buyer->>Gateway: POST /api/orders (Create Order)
    Gateway->>OrderService: Forward Order Creation
    OrderService->>RabbitMQ: Publish "order.placed"
    RabbitMQ-->>NotificationService: Consume "order.placed" -> Send WhatsApp
    RabbitMQ-->>RealtimeService: Consume "order.placed" -> Emit to Vendor Room

    Buyer->>Gateway: POST /api/payments/verify
    Gateway->>PaymentService: Validate Razorpay HMAC
    PaymentService->>RabbitMQ: Publish "payment.captured"
    RabbitMQ-->>OrderService: Consume "payment.captured" -> Update status to "CONFIRMED"

    actor Vendor
    Vendor->>Gateway: PATCH /api/orders/:id/status ("OUT_FOR_DELIVERY")
    Gateway->>OrderService: Update Order State
    OrderService->>RabbitMQ: Publish "order.status_changed"
    RabbitMQ-->>RealtimeService: Consume -> Emit "order:status_updated" to order:{id}
    RealtimeService-->>Buyer: WebSocket Push: Step changes on Stepper UI
    RabbitMQ-->>NotificationService: Dispatch "order_out_for_delivery" WhatsApp
```

---

## 6. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o| VENDOR : operates
    USER ||--o{ ORDER : places
    USER ||--o{ REVIEW : writes
    USER ||--o{ NOTIFICATION : receives

    VENDOR ||--o{ PRODUCT : catalogs
    VENDOR ||--o{ ORDER : fulfills
    VENDOR ||--o{ REVIEW : receives

    ORDER ||--|{ ORDER_ITEM : contains
    ORDER ||--o| PAYMENT : transactions
    ORDER ||--o{ MESSAGE : tracks

    USER {
        ObjectId _id PK
        string name
        string email UK
        string phone UK
        string passwordHash
        string role "buyer | vendor | admin"
        object adminScope "city scope if admin"
        string status "active | suspended"
        date createdAt
    }

    REFRESH_TOKEN {
        ObjectId _id PK
        ObjectId userId FK
        string tokenHash
        date expiresAt
        date createdAt
    }

    VENDOR {
        ObjectId _id PK
        ObjectId userId FK
        string storeName
        string description
        string category "bakery | handmade | produce | plants | other"
        string city
        object address "line1, city, pincode"
        object location "GeoJSON Point [lng, lat]"
        string approvalStatus "pending | approved | rejected"
        boolean isActive
        boolean selfDelivery
        object rating "average, count"
        date createdAt
    }

    PRODUCT {
        ObjectId _id PK
        ObjectId vendorId FK
        string name
        string description
        string category
        number price "in paise"
        number stock
        string unit "piece | kg | box"
        array images
        array tags
        boolean isActive
        date createdAt
    }

    ORDER {
        ObjectId _id PK
        string orderNumber UK
        ObjectId buyerId FK
        ObjectId vendorId FK
        array items "productId, name, price, quantity"
        number totalAmount "in paise"
        number deliveryFeePaise
        string status "PLACED | PREPARING | OUT_FOR_DELIVERY | DELIVERED | CANCELLED"
        string paymentMethod "ONLINE | COD"
        string paymentStatus "PENDING | PAID | FAILED"
        string razorpayOrderId
        object deliveryAddress
        date createdAt
    }

    PAYMENT {
        ObjectId _id PK
        ObjectId orderId FK
        ObjectId buyerId FK
        number amountPaise
        string currency "INR"
        string status "PENDING | SUCCESS | FAILED"
        string razorpayOrderId
        string razorpayPaymentId
        string razorpaySignature
        date createdAt
    }

    REVIEW {
        ObjectId _id PK
        ObjectId vendorId FK
        ObjectId buyerId FK
        ObjectId orderId FK
        number rating "1 to 5"
        string comment
        object vendorResponse "text, respondedAt"
        date createdAt
    }

    MESSAGE {
        ObjectId _id PK
        ObjectId orderId FK
        ObjectId fromUserId FK
        ObjectId toUserId FK
        string text
        date readAt
        date createdAt
    }

    NOTIFICATION {
        ObjectId _id PK
        ObjectId userId FK
        string channel "whatsapp | sms | email | push"
        string template
        object payload
        string status "QUEUED | SENT | FAILED"
        string providerMessageId
        date sentAt
        date createdAt
    }
```

---

## 7. Database Schemas Breakdown

### 7.1 Database: `nearmart_auth`
* **Collection `users`**: Stores authentication credentials, identity, contact information, role mapping (`buyer`, `vendor`, `admin`), and city scope.
  * Indices: `{ email: 1 }` (unique), `{ phone: 1 }` (unique).
* **Collection `refresh_tokens`**: Stores hashed refresh tokens with automatic MongoDB TTL expiration index.
  * Indices: `{ expiresAt: 1 }` (`expireAfterSeconds: 0`), `{ userId: 1 }`.

### 7.2 Database: `nearmart_vendors`
* **Collection `vendors`**: Stores merchant store information, address, operating flags (`isActive`, `selfDelivery`), and GeoJSON Point coordinates.
  * Indices: `{ location: "2dsphere" }` (for `$near` spatial discovery), `{ city: 1, approvalStatus: 1 }`, `{ userId: 1 }`.

### 7.3 Database: `nearmart_catalog`
* **Collection `products`**: Stores inventory items, pricing in paise (to eliminate floating-point math rounding errors), units, image arrays, and categories.
  * Indices: `{ vendorId: 1, isActive: 1 }`, `{ name: "text", description: "text" }` (full-text search).
* **Collection `carts`** (Redis Keyed): Transient shopping cart states mapped per user (`cart:{userId}`) with TTL.

### 7.4 Database: `nearmart_orders`
* **Collection `orders`**: Manages order progression state machine, snapshot items, amounts, delivery addresses, and payment linkage.
  * Indices: `{ buyerId: 1, createdAt: -1 }`, `{ vendorId: 1, status: 1 }`, `{ orderNumber: 1 }` (unique).

### 7.5 Database: `nearmart_payments`
* **Collection `payments`**: Stores transaction logs, Razorpay order and payment IDs, signature audits, and webhook verification statuses.
  * Indices: `{ orderId: 1 }`, `{ razorpayOrderId: 1 }`.

### 7.6 Database: `nearmart_reviews`
* **Collection `reviews`**: Stores 1-to-5 star customer feedback, text reviews, and vendor public replies.
  * Indices: `{ vendorId: 1, createdAt: -1 }`, `{ orderId: 1 }` (unique).

### 7.7 Database: `nearmart_realtime`
* **Collection `messages`**: Stores chat history between customer and merchant scoped by order ID.
  * Indices: `{ orderId: 1, createdAt: 1 }`.

### 7.8 Database: `nearmart_notifications`
* **Collection `notifications`**: Transactional outbox logging dispatched WhatsApp and SMS provider messages.
  * Indices: `{ userId: 1, createdAt: -1 }`.

---

## 8. API Gateway Routing Table

All inbound client requests route through the Gateway at `http://localhost:4000/api`.

| Route Pattern | Target Microservice | Authentication Gate | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/signup` | `auth-service` (Port 4001) | Public | Register buyer, vendor, or admin |
| `/api/auth/login` | `auth-service` (Port 4001) | Public | Authenticate and obtain JWT access token |
| `/api/auth/me` | `auth-service` (Port 4001) | `jwtVerify` | Fetch currently authenticated user identity |
| `/api/vendors/nearby` | `vendor-service` (Port 4002) | Public | Geospatial search for nearby approved stores |
| `/api/vendors/:id` | `vendor-service` (Port 4002) | Public | Fetch single vendor store details |
| `/api/vendors` (POST) | `vendor-service` (Port 4002) | `jwtVerify` (Vendor) | Register store profile |
| `/api/vendors/pending` | `vendor-service` (Port 4002) | `jwtVerify` (Admin) | List pending merchant KYC queue |
| `/api/vendors/:id/approve`| `vendor-service` (Port 4002) | `jwtVerify` (Admin) | Approve store for discovery |
| `/api/vendors/:id/reject` | `vendor-service` (Port 4002) | `jwtVerify` (Admin) | Reject store registration |
| `/api/products` (GET) | `catalog-service` (Port 4003) | Public | List products by vendor ID |
| `/api/products/search`| `catalog-service` (Port 4003) | Public | Text search across product titles and tags |
| `/api/products` (POST)| `catalog-service` (Port 4003) | `jwtVerify` (Vendor) | Create new product |
| `/api/cart/*` | `catalog-service` (Port 4003) | `jwtVerify` | Get, add, or clear user cart |
| `/api/orders` (POST) | `order-service` (Port 4004) | `jwtVerify` (Buyer) | Place new hyperlocal order |
| `/api/orders/:id` | `order-service` (Port 4004) | `jwtVerify` | View order state and line items |
| `/api/orders/:id/status`| `order-service` (Port 4004)| `jwtVerify` (Vendor) | Progress order lifecycle status |
| `/api/payments/verify`| `payment-service` (Port 4005)| `jwtVerify` (Buyer) | Verify Razorpay checkout signature |
| `/api/payments/webhook`| `payment-service` (Port 4005)| Public (HMAC Verified) | Webhook handler for payment capture |
| `/api/reviews/*` | `review-service` (Port 4006) | Public / `jwtVerify` | Post reviews and merchant responses |
| `/api/messages/:orderId`| `realtime-service` (Port 4007)| `jwtVerify` | Fetch historical order chat messages |

*Note: WebSocket connections connect directly to `ws://localhost:4007` with handshake JWT authentication to avoid HTTP proxy bottlenecking.*

---

## 9. Local Installation & Deployment Guide

### Prerequisites
- Node.js (v18 or v20+)
- Docker & Docker Compose
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/vijayasarvajith16/NearMarts.git
cd NearMarts
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Launch Core Infrastructure (Docker)
Starts MongoDB (port 27017), Redis (port 6379), and RabbitMQ (port 5672/15672):
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### 4. Start Microservices & Gateway
Each microservice and the gateway can be started independently:
```bash
# In separate terminal tabs:
cd gateway && npm install && npm run dev
cd services/auth-service && npm install && npm run dev
cd services/vendor-service && npm install && npm run dev
cd services/catalog-service && npm install && npm run dev
cd services/order-service && npm install && npm run dev
cd services/payment-service && npm install && npm run dev
cd services/review-service && npm install && npm run dev
cd services/realtime-service && npm install && npm run dev
cd services/notification-service && npm install && npm run dev
```

### 5. Launch React Frontend Client
```bash
cd client
npm install
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### Default Super Admin Account
- **Email**: `admin@nearmart.com`
- **Password**: `AdminPassword123!`
- **Role**: `admin`
