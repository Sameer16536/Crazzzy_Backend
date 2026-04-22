# Comprehensive Codebase Features Directory

This document comprehensively outlines every core feature logic present in the `src/` directory. For every function, it details its primary operation, its arguments/requirements, and its return values.

## 1. Authentication & Users (`authController.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `signup` | Creates a new user, hashes password, saves as unverified, and sends an OTP email. | `201` + Success message. |
| `verifyOtp` | Validates a 6-digit OTP. Marks the user `isVerified: true`, revokes OTP, and issues standard JWT tokens. | `200` + Access Token, Refresh Token, User object. |
| `resendOtp` | Checks for an unverified user, generates a new OTP, and transmits an email. | `200` + Success message. |
| `login` | Validates email/password via bcrypt, enforces `isVerified` and `!isBanned` checks, creates a refresh token row. | `200` + Access Token, Refresh Token, User object. |
| `refreshTokens` | Cross-checks provided Refresh Token hash in the database, checks expiry/revocation, revokes old one, issues new pair. | `200` + Access Token, Refresh Token, User object. |
| `logout` / `logoutAll` | Hashes and marks current Refresh Token(s) as `revokedAt = Date.Now()`. | `200` + Success message. |
| `forgotPassword` | Creates a `PASSWORD_RESET` OTP and transmits recovery email strictly if the user is verified. | `200` + Secure ambiguity message (against scanning). |
| `resetPassword` | Takes an OTP and hashes a new overriding password. Invalidates all active login sessions. | `200` + Success message. |
| `changePassword` | Authenticated route to update password given `currentPassword`. Also invalidates other sessions. | `200` + Success message. |
| `getProfile` | Authenticated route fetching the user's `id, name, email, phone, role`. | `200` + User object. |
| `updateProfile` | Updates user's `name` or `phone`. | `200` + Updated User object. |

---

## 2. E-Commerce Core (`productController.ts` & `categoryController.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `listProducts` | Publicly fetches active products. Filters by `category`, `search` text, `isFeatured`, paginates and sorts by `price_asc`, `popularity`, etc. | `200` + `data` array of products, `meta` pagination stats. |
| `getProductBySlug` | Public fetch by string slug. Returns relations like images, variants, and resolved username reviews. | `200` + Deeply nested Product object. |
| `listCategories` | Retrieves all categories sorted alphabetically, including deep counts of products matching each category. | `200` + Categories array with `product_count`. |

---

## 3. Order Management (`orderController.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `createOrder` | Calculates realtime subtotal from product DB (stock validation), applies coupon logic limit tracking, initializes Razorpay intent matching calculated INRs. | `201` + Pending `orderId` and Razorpay parameters. |
| `verifyPayment` | Authenticates Razorpay webhook/HMAC SHA-256 signature, updates `OrderStatus` to `PAID`, decrements product physical stock, and triggers confirmation email. | `200` + Success message and confirmed `orderId`. |
| `getUserOrders` | Lists all personal orders nested with product image/title summaries. | `200` + Array of Orders. |
| `getOrderById` | Single fetch for an order, guarded by `userId` auth. | `200` + Highly nested Order object. |

---

## 4. User Meta (`addressController.ts`, `wishlistController.ts`, `reviewController.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `getAddresses` | Fetches address rows tied to user. | `200` + Address array. |
| `createAddress` | Builds address and intelligently unchecks other Defaults if `isDefault: true` is passed. | `201` + Address object. |
| `toggleWishlist`| Checks if product ID is connected for the user. If yes, disconnects; if no, connects. | `200` + "Added/Removed" msg string. |
| `addReview` | Explicitly guards that the user **purchased & received** the product (`DELIVERED` status) before allowing rating. Updates `ratingAvg` aggregations on the product table. | `200` + Created Review object. |

---

## 5. Security & Middlewares (`authMiddleware.ts` & `uploadMiddleware.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `authenticate` | Parses `Authorization: Bearer`, verifies cryptosignature against `JWT_SECRET`, checks `user.isBanned` at runtime, appends to `req.user`. | Continues via `next()`, or returns `401`/`403`. |
| `requireAdmin` | Guards routes. Asserts `req.user.role === Role.ADMIN`. | Continues via `next()`, or `403`. |
| `uploadMiddleware` | An instance of Multer equipped with `multer-storage-cloudinary`, piping multipart form-data buffers dynamically over to Cloudinary host endpoints. | Injects `req.file` or `req.files`. |

---

## 6. Admin Panel Functions (`adminController.ts` & `couponController.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `getDashboardStats`| Uses `Promise.all` aggregators to deeply sum `totalAmount` across all `PAID`/`DELIVERED` orders simultaneously with total User counts. | JSON with `totalRevenue`, `totalOrders`, `totalUsers`, `recentOrders`. |
| `updateUserBanStatus` | Flips `isBanned` boolean. Crucially, if banned, revokes absolutely all their refresh tokens instantly, severing active login sessions across all devices. | `200` + Success string. |
| `createCoupon` | Generates global promo codes dictating `PERCENTAGE` or `FIXED` discounts, enforces usage limits and specific expiry horizons. | `201` + Coupon object. |
| `deleteUser` | Permanent algorithmic hard-delete of an account. Preventative wrapper implemented limiting admins from deleting themselves. | `200` + Success message. |

---

## 7. Utilities (`tokenUtils.ts` & `otpGenerator.ts` & `fileRemover.ts`)

| Function | What it Does | Returns |
| :--- | :--- | :--- |
| `generateOTP` | Discards `Math.random` algorithm in favor of `crypto.randomInt` for unguessable, CSPRNG OTP generation. | Native 6-char `String`. |
| `generateRefreshToken`| Yields a true 64-byte Hex payload. Sent Raw to the user. | `128-char String`. |
| `hashToken` | Uses `sha256` digest mapping so only hash is kept in database. | `64-char Hex String`. |
| `removeFile` | Takes absolute Cloudinary HTTP URL format, reverse-engineers the local `publicId`, and sends strict CLI destruction flags to Cloudinary backend. | Asynchronous `Void`. |
