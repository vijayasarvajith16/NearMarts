# NearMart — Hyperlocal E-Commerce Platform
### Distributed Microservices Architecture · Event-Driven Pipelines · Real-Time Tracking · Shopify Design Language

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20-10b981.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-v19-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-v8-646cff.svg)](https://vitejs.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Geospatial_2dsphere-47A248.svg)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Pub%2FSub_%26_Cache-DC382D.svg)](https://redis.io)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-AMQP_Broker-FF6600.svg)](https://www.rabbitmq.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-Redis_Adapter-010101.svg)](https://socket.io)

NearMart is an enterprise-grade, distributed hyperlocal commerce platform engineered to connect neighborhood artisans, bakeries, indie roasters, urban growers, and specialty makers directly with nearby consumers for rapid local delivery.

For the full technical breakdown, see **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**.

---

## 1. System Architecture

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

## 2. Technology Stack & Tech Utilization

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

## 3. Entity-Relationship (ER) Diagram

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

## 4. End-to-End System Workflows

1. **Buyer Flow**:
   - Geolocation auto-detection or manual city selection (`bengaluru`, `mumbai`, `delhi`, `chennai`, etc.).
   - Nearby approved merchant discovery via MongoDB `2dsphere` spatial index and Redis query caching.
   - Merchant store menu browsing, instant cart addition with single-vendor validation.
   - Address checkout with payment choice: Razorpay online payments (with HMAC signature verification) or COD.
   - Real-time interactive order timeline tracking over direct WebSocket connections (`ws://localhost:4007`) with embedded live vendor chat.

2. **Vendor Flow**:
   - Seller Hub registration with address, GeoJSON location coordinates, and category.
   - Product catalog management with image URLs, stock controls, and pricing in paise.
   - Live 4-column Kanban order inbox (`PLACED` → `PREPARING` → `OUT_FOR_DELIVERY` → `DELIVERED`).
   - Pure CSS toggle controls for store active status and self-delivery options.
   - Review management and public merchant replies.

3. **Admin Flow**:
   - City-scoped and super-admin moderation dashboards.
   - Real-time pending merchant verification queue with approve and reject actions.
   - Platform analytics tracking gross merchandise value (GMV), active stores, and pipeline distributions.

---

## 5. Quickstart & Local Setup

```bash
# 1. Clone repository
git clone https://github.com/vijayasarvajith16/NearMarts.git
cd NearMarts

# 2. Setup environment variables
cp .env.example .env

# 3. Spin up Docker databases & message broker
docker-compose -f infra/docker-compose.yml up -d

# 4. Start Gateway and Microservices
# (Run in respective folders or via orchestrator)
cd gateway && npm install && npm run dev
cd services/auth-service && npm install && npm run dev
cd services/vendor-service && npm install && npm run dev
cd services/catalog-service && npm install && npm run dev
cd services/order-service && npm install && npm run dev
cd services/payment-service && npm install && npm run dev
cd services/review-service && npm install && npm run dev
cd services/realtime-service && npm install && npm run dev
cd services/notification-service && npm install && npm run dev

# 5. Start Client Web Application
cd client && npm install && npm run dev
```

Visit **[http://localhost:5173/](http://localhost:5173/)** to access the live platform.

### Default Super Admin Credentials
- **Email**: `admin@nearmart.com`
- **Password**: `AdminPassword123!`
- **Role**: `admin`
