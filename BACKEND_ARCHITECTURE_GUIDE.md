# Crazzzy.in Backend Architecture & Codebase Reference Guide

Welcome to the definitive backend engineering documentation for the **Crazzzy.in** REST API. This codebase is designed as a production-ready, highly-scalable, type-safe, and secure Node.js service, built on Express, TypeScript, and Prisma ORM.

---

## 🛠️ 1. Technology Stack

The backend uses a modern, high-performance technology stack:

*   **Runtime**: [Node.js (>=v22.12.0)](https://nodejs.org/) with [TypeScript](https://www.typescriptlang.org/) for strict compile-time checks and auto-documentation.
*   **Web Framework**: [Express.js](https://expressjs.com/) configured with modular routing, centralized middleware validation, and global error management.
*   **Database ORM**: [Prisma ORM (v7)](https://www.prisma.io/) with a PostgreSQL datasource layer. It uses native database pooling adapters for efficient connection scaling.
*   **Caching Layer**: Custom tag-based, in-memory caching singleton for sub-millisecond lookups on public GET reads.
*   **Media Hosting & Processing**: [Multer](https://github.com/expressjs/multer) (in-memory storage buffer) + [Sharp](https://sharp.pixelplumbing.com/) for local WebP format conversion + [Cloudinary Stream Uploads](https://cloudinary.com/) for cloud delivery.
*   **Payment Gateway**: [Razorpay Standard Checkout SDK](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/) with automated webhook triggers.
*   **Email Engine**: [Resend SDK](https://resend.com/) with responsive HTML transactional template routing.
*   **Security & Controls**: [Helmet](https://helmetjs.github.io/) for secure HTTP headers, [Compression](https://github.com/expressjs/compression) for low payload latency, [Express-Validator](https://express-validator.github.io/) for strict schemas, and standard [Express Rate Limiters](https://github.com/express-rate-limit/express-rate-limit).

---

## 📂 2. Directory & File Layout

The codebase follows a modular architecture separating concern by layer (Router $\rightarrow$ Validator/Middleware $\rightarrow$ Controller $\rightarrow$ Database/Utility). Below is the directory map of the [src](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src) folder:

```text
Crazzzy_Backend/
├── prisma/
│   ├── schema.prisma           # Prisma database schema definition file
│   └── seed.ts                 # Database seeding script for mock categories/deals
├── src/
│   ├── app.ts                  # Application entry point, server configuration & global middleware
│   ├── config/                 # External service configurations
│   │   ├── db.ts               # Prisma Client initialization & pooling connection exports
│   │   ├── mail.ts             # Resend SDK configuration & HTML email template bindings
│   │   └── razorpay.ts         # Razorpay client instance setup
│   ├── controllers/            # Request handlers implementing business logic
│   │   ├── addressController.ts
│   │   ├── adminController.ts
│   │   ├── adminSettingsController.ts
│   │   ├── authController.ts
│   │   ├── cartController.ts
│   │   ├── categoryController.ts
│   │   ├── couponController.ts
│   │   ├── orderController.ts
│   │   ├── reviewController.ts
│   │   ├── webhookController.ts
│   │   └── wishlistController.ts
│   ├── middlewares/            # Interceptor pipelines matching requests
│   │   ├── authMiddleware.ts   # JWT Verification, user bans, and admin role validation
│   │   ├── errorMiddleware.ts  # Route not found (404) and global error parser (500)
│   │   ├── sharpMiddleware.ts  # Local Sharp image processing and Cloudinary streaming
│   │   └── uploadMiddleware.ts # Multer memory-storage configuration
│   ├── routes/                 # Express route definitions prefixed under '/api'
│   │   ├── adminRoutes.ts      # Administrative controls (Stats, user bans, catalog CRUD)
│   │   ├── authRoutes.ts       # Auth actions, credentials, OTP verifications
│   │   ├── cartRoutes.ts       # DB-synced cart and merge endpoints
│   │   ├── categoryRoutes.ts   # Public taxonomy list
│   │   ├── orderRoutes.ts      # Checkout and payment callbacks
│   │   ├── productRoutes.ts    # Product queries, sorting, and reviews
│   │   ├── settingsRoutes.ts   # Deals, filters, category offers
│   │   ├── userRoutes.ts       # Customer preferences, addresses, and wishlist
│   │   └── webhookRoutes.ts    # Razorpay asynchronous events
│   └── utils/                  # Reusable helper functions
│       ├── cache.ts            # Tag-based In-Memory Cache with instant invalidations
│       ├── fileRemover.ts      # Helper for Cloudinary asset deletion cleanup
│       ├── otpGenerator.ts     # CSPRNG-based OTP and timestamp calculations
│       ├── pricing.ts          # Order pricing (Category BOGO, Combo Deals, Product Offers)
│       └── tokenUtils.ts       # Token generation, rotation hashing, and expiration offsets
```

---

## 🗄️ 3. Database Schema & Data Relationships

The backend uses Prisma's relational schema modeling located in [schema.prisma](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/prisma/schema.prisma). Below is the database relationship diagram mapping the data shapes:

```mermaid
erDiagram
  User ||--o{ Order : places
  User ||--o{ RefreshToken : has
  User ||--o{ Review : writes
  User ||--o{ Address : manages
  User ||--o{ Product : wishlists
  User ||--|{ Cart : owns
  
  Cart ||--o{ CartItem : contains
  Product ||--o{ CartItem : added_in
  ProductVariant ||--o{ CartItem : variant_in
  
  Order ||--|{ OrderItem : details
  Product ||--o{ OrderItem : ordered_in
  ProductVariant ||--o{ OrderItem : variant_ordered_in
  
  Category ||--o{ Product : classifies
  Category ||--o{ Category : child_categories
  
  Product ||--o{ ProductImage : gallery
  Product ||--o{ ProductVariant : variations
  Product ||--o{ Tag : tagged_with
  Product ||--o| ProductOffer : qualifies_for
  
  Coupon ||--o{ Order : applied_on
```

### Core Entity Explanations:
1.  **User**: Holds demographic information, flags for verification (`isVerified`) and moderation (`isBanned`), and references to profiles/tokens.
2.  **Address**: Customer address book featuring an `isDefault` flag. Creating a default address automatically demotes other addresses for the user in the database.
3.  **RefreshToken**: Tracks active user sessions. Stores high-entropy SHA-256 hashes rather than raw tokens. Supports single-device revokes or total session invalidation.
4.  **OtpCode**: Stores verification, login, or password reset keys. Designed with one-time use logic (`isUsed`) and brief expiration window constraints (10 minutes).
5.  **Category**: A tree structure containing hierarchical subcategories (using a parent-child self-reference pattern `parentId -> Category.id`).
6.  **Product**: Represents store items. Tracks core specs, deal identifiers (deal timings, featured status), review aggregations, and relates to tags, variants, and galleries.
7.  **ProductVariant**: Options (size, style, dimensions) which dynamically append additional pricing (`additionalPrice`) and keep individual stock tracks.
8.  **Order & OrderItem**: Snapshot records recording purchased goods, final paid totals, discount amounts, delivery logistics, tracking numbers, and payment IDs.
9.  **Offers & Discounts**:
    *   `Coupon`: Fixed or percentage discounts applied during checkout. Supports expiration timestamps and maximum usage capacity limits.
    *   `ComboDeal`: Multi-buy bundle packages (e.g., "Any 3 items for ₹500"). Supports global or product-restricted conditions.
    *   `CategoryOffer`: "Buy X Get Y Free" deals applied categorially across items (e.g., Buy 2 Get 1 Free on posters). Includes ancestor inheritance (rules inherit from parents down to subcategories).
    *   `ProductOffer`: Targeted item incentives (e.g., "Buy Product A, get Product B and C free").
10. **Cart & CartItem**: Synchronized persistent cart states. Merges guest local storage items seamlessly upon user authentication.

---

## 🎨 4. Core Design Patterns

### A. Modular REST API MVC Architecture
The system decouples core responsibilities using a classic pipeline structure:
1.  **Route Mapping** ([routes](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/routes)): Defines route pathways, applies CORS configurations, security policies, and rate limiters.
2.  **Schema Validators & Middlewares** ([middlewares](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/middlewares)): Uses `express-validator` array rules. If a validator catches invalid shapes (e.g. invalid emails, short passwords), it passes execution directly to the error handler.
3.  **Controller Core** ([controllers](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/controllers)): Intercepts validated payloads, initiates database communication, and sends standard JSON envelopes.
4.  **ORM Layer** ([db.ts](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/config/db.ts)): Uses Prisma client to execute database operations.

---

### B. High-Security Token Lifecycle & Rotation
The API uses a dual-token authentication model to optimize security and scaling:
*   **Access Token**: A short-lived JSON Web Token (JWT) expiring in 15 minutes. It embeds user identity data along with a unique `jti` (JWT ID) to enable session validation checks.
*   **Refresh Token**: A long-lived, high-entropy 64-byte random hex string. Only the SHA-256 hash of this string is stored in the database to prevent database leakage exploits.
*   **Refresh Rotation**: Each time a client requests a new access token via `/auth/refresh`, the old refresh token is revoked immediately, and a new refresh token is issued. This pattern is implemented in `refreshTokens` in [authController.ts](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/controllers/authController.ts#L306-L351):

```typescript
// Revoke old token
await prisma.refreshToken.update({
  where: { id: record.id },
  data: { revokedAt: new Date() },
});

// Issue new token pair
const { rawToken } = await storeRefreshToken(record.user.id);
```

*   **Security Actions**:
    *   **Banning Protection**: The authentication middleware check validates the user status in the database on every request. If `isBanned` is true, the server returns `403 Forbidden` and terminates the session immediately.
    *   **Revoke All Devices**: Modifying user credentials (e.g. changing passwords, resetting passwords, or banning) immediately revokes all refresh tokens linked to that user by updating `revokedAt = new Date()`.

---

### C. Atomic Database Transactions & Inventory Controls
To prevent race conditions, such as double-coupon redemptions or negative inventory counts, the server processes critical operations inside atomic database transactions (`prisma.$transaction`).

For example, when confirming a payment inside `confirmOrderPayment` in [orderController.ts](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/controllers/orderController.ts#L314-L356), the code updates the order status and performs atomic stock decrements. It checks if the item stock is greater than or equal to the requested quantity before decrementing:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Mark Order as PAID
  await tx.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paymentId: razorpayPaymentId }
  });

  // 2. Atomic Stock Decrement with check
  for (const item of order.items) {
    if (item.productVariantId) {
      const update = await tx.productVariant.updateMany({
        where: { id: item.productVariantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (update.count === 0) {
        throw createError(400, `Insufficient stock for product variant in order #${order.id}`);
      }
    } else {
      const update = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (update.count === 0) {
        throw createError(400, `Insufficient stock for "${item.product.title}" in order #${order.id}`);
      }
    }
  }
});
```

Using `updateMany` with a conditional `where` clause guarantees that if multiple concurrent requests process at once, only the one that executes while stock is sufficient succeeds. The other transactions fail the inventory check, triggering a rollback.

---

### D. Smart In-Memory Caching
To maintain high responsiveness without external dependencies, the system uses a custom tag-based, in-memory caching singleton:
*   **Pattern**: Public GET endpoints (e.g. listing products or fetching categories) generate unique cache keys based on search, filter, and sorting query parameters.
*   **Tagging**: Cache entries are saved with tag identifiers, such as `products` or `categories`.
*   **Busting**: When a mutation occurs (POST/PUT/PATCH/DELETE) in product or category controllers, the server invalidates all cache entries carrying the corresponding tag:

```typescript
// In productController.ts after product update
appCache.invalidateTag(CACHE_TAGS.PRODUCTS);
```

This pattern ensures that readers query an in-memory map for sub-millisecond response times, while writers instantly bust outdated cache entries globally.

---

### E. Image Processing & Optimization Pipeline
The application handles image uploads efficiently using a memory-to-cloud streaming pipeline:
1.  **Multer Buffering**: File uploads are captured directly into server memory as raw buffers, preventing disk write overhead.
2.  **Local WebP Compression**: The [sharpMiddleware.ts](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/middlewares/sharpMiddleware.ts) processes the memory buffer locally, resizing and converting the image to WebP format at 80% quality. This reduces file sizes by up to 70% before uploading, saving Cloudinary usage credits.
3.  **Cloudinary Streaming**: The WebP buffer is piped directly into a Cloudinary upload stream using `cloudinary.uploader.upload_stream` and Node's `Readable.from(buffer)`.
4.  **Orphaned Asset Cleanup**: When products or categories are updated or deleted, the server calls [fileRemover.ts](file:///c:/Users/SAMEER/Desktop/Crazzzy_Backend/src/utils/fileRemover.ts) to automatically delete the old public IDs from Cloudinary, keeping cloud storage clean.

---

### F. Decimal & Monetary Precision Strategy
To prevent floating-point precision drift during currency calculations (e.g., `0.1 + 0.2 === 0.30000000000000004`), the backend implements a strict decimal strategy:
*   **Database**: Monetary values are stored using the Prisma `Decimal` type with fixed scale (e.g., `@db.Decimal(10, 2)`).
*   **API Payloads**: Currency numbers are serialized as **Strings** (e.g., `"199.99"`) in JSON responses.
*   **Calculations**: The backend converts decimal strings to JavaScript numbers immediately before calculations, rounds the final total, and stores it back using fixed decimals.

---

## 🔄 5. Key Functional Workflows

### A. User Sign-up & Verification Flow

The registration workflow requires email verification using a temporary One-Time Password (OTP) before granting account access:

```mermaid
sequenceDiagram
    actor Client
    participant AuthController
    participant DB as Prisma/Database
    participant Mail as Resend Engine

    Client->>AuthController: POST /api/auth/signup {name, email, password}
    alt Email already verified
        AuthController-->>Client: 409 Conflict (Email already registered)
    else Email exists but unverified
        AuthController->>DB: Hash password & update credentials
    else New registration
        AuthController->>DB: Create user record (isVerified: false)
    end
    
    AuthController->>DB: Invalidate active OTPs & generate new 6-digit OTP
    AuthController->>Mail: Trigger sendVerificationEmail(email, otp)
    Mail-->>Client: Send verification email
    AuthController-->>Client: 201 Created (OTP sent to your email)
    
    Client->>AuthController: POST /api/auth/verify-otp {email, otp, type: "VERIFICATION"}
    AuthController->>DB: Validate OTP, check expiration, mark isUsed: true
    AuthController->>DB: Update user (isVerified: true)
    AuthController->>DB: Generate Refresh Token & hash in DB
    AuthController->>Mail: Trigger sendWelcomeEmail(email, name)
    AuthController-->>Client: 200 OK (User Profile + AccessToken + RefreshToken)
```

---

### B. Checkout Flow & Payment Verification

The purchase flow relies on client-side Razorpay checkout and server-side HMAC-SHA256 verification:

```mermaid
sequenceDiagram
    actor Client
    participant OrderController
    participant Pricing as utils/pricing
    participant DB as Prisma/Database
    participant Razorpay as Razorpay API
    participant Webhook as WebhookController
    participant Mail as Resend Engine

    Client->>OrderController: POST /api/create-order {items, addressId, phoneNumber, couponCode}
    OrderController->>DB: Query products, check variant stock & fetch category/product offers
    OrderController->>Pricing: Calculate BOGO offers, Combo Deals, and shipping
    OrderController->>DB: Apply coupon (if provided) & increment coupon usage
    OrderController->>Razorpay: Initiate Razorpay Order (amount in paise)
    Razorpay-->>OrderController: Return Razorpay Order ID
    OrderController->>DB: Write Pending Order (status: PENDING, paymentId: razorpay_order_id)
    OrderController-->>Client: 201 Created (Order metadata + Razorpay config)

    Client->>Client: Open Razorpay modal & capture payment
    Client->>OrderController: POST /api/verify-payment {razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId}
    
    rect rgb(240, 248, 255)
        note right of OrderController: Verification Signature Match Check
        OrderController->>OrderController: HMAC-SHA256("razorpay_order_id|razorpay_payment_id", KeySecret)
        OrderController->>OrderController: Compare signature via crypto.timingSafeEqual()
    end

    alt Signature Matches
        OrderController->>DB: Confirm Payment Transaction
        DB->>DB: Update status to PAID & decrement variant/product stock
        OrderController->>Mail: Trigger sendOrderReceiptEmail(email, order, items)
        OrderController-->>Client: 200 OK (Payment verified, order confirmed)
    else Signature Fails
        OrderController-->>Client: 400 Bad Request
    end

    note over Razorpay, Webhook: Redundancy Fallback
    Razorpay->>Webhook: Event: order.paid / payment.captured
    Webhook->>DB: Check if order status is still PENDING
    alt Still PENDING (Tab closed early)
        Webhook->>DB: Confirm Payment Transaction (PAID, decrement stock)
        Webhook->>Mail: Trigger sendOrderReceiptEmail()
    end
```

---

## ⚙️ 6. Environment Variables Reference

Create a `.env` file in the project root. Below is a comprehensive template detailing the purpose of each variable:

| Environment Variable | Description | Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | Local server port | `3000` |
| `DATABASE_URL` | Prisma PostgreSQL database connection string | `postgresql://user:password@localhost:5432/dbname` |
| `JWT_SECRET` | Secret key used to sign Access Tokens | `super_secret_jwt_sign_key_change_in_production` |
| `JWT_ACCESS_EXPIRES_IN` | Validity window of Access Tokens | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Validity window of Refresh Tokens | `30d` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS whitelist clients | `http://localhost:5173,https://crazzzy.in` |
| `MAX_FILE_SIZE_MB` | Maximum file size for image uploads | `5` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Account Cloud Name | `crazzzy-cloudinary-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key credential | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret credential | `abcdefghijklmnopqrstuvwxyz` |
| `RESEND_API_KEY` | Resend API Key for sending transactional emails | `re_123456789` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_test_12345` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Key Secret | `secret_12345` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret set in Razorpay | `webhook_secret_key` |

---

## 🚀 7. Step-by-Step Developer Setup

Follow these steps to set up and run the backend codebase locally:

### 1. Prerequisite Installations
Ensure you have the following installed on your system:
*   [Node.js](https://nodejs.org/) (Version `>= 22.12.0`)
*   [Git](https://git-scm.com/)
*   A running PostgreSQL database instance (local instance or managed instance on Supabase/Neon)

### 2. Project Installation
Clone the repository and install the dependencies:
```bash
# Clone the repository
git clone https://github.com/your-username/crazzzy-backend.git
cd crazzzy-backend

# Install package dependencies
npm install
```

### 3. Database Setup & Prisma Migration
Map the database schema to your database instance:
```bash
# Apply schema migrations to your database
npx prisma migrate dev --name init

# Generate the type-safe Prisma client
npx prisma generate
```

### 4. Seed Initial Store Data
Run the database seed script to populate default categories, products, coupons, and combo deals:
```bash
# Run the database seeder
npx prisma db seed
```

### 5. Running the Application
Start the application in development mode with hot-reloading:
```bash
# Run development server
npm run dev
```
The server will start on the port specified in your `.env` file (defaults to `http://localhost:3000`). You can verify that it is active by visiting:
`http://localhost:3000/api/health`

### 6. Building for Production
To package the TypeScript code into production-ready JavaScript:
```bash
# Compile TS to JS
npm run build

# Start production server
npm start
```
The compiled files will be written to the `dist` directory.
