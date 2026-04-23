# Crazzzy.in API Documentation (Postman Ready)

Base URL: `http://localhost:3000/api` (Local) or `https://crazzzy.in/api` (Production)

> **Important Setup for Postman**
> For endpoints that require authentication, you must pass the JWT token in the Headers:
> `Authorization: Bearer <your_access_token>`

---

## 1. Authentication (`/api/auth`)

### Register User
- **Method:** `POST`
- **Endpoint:** `/auth/signup`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```

### Verify OTP
- **Method:** `POST`
- **Endpoint:** `/auth/verify-otp`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com",
  "otp": "123456",
  "type": "VERIFICATION"
}
```

### Verify Email OTP (After Signup)
- **Method:** `POST`
- **Endpoint:** `/auth/verify-email-otp`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com",
  "otp": "123456"
}
```

### Resend OTP
- **Endpoint:** `/auth/resend-otp`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com",
  "type": "VERIFICATION"
}
```

### Login
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
*Note: This will return an `accessToken` (JWT) and a `refreshToken`.*

### Refresh Token
- **Method:** `POST`
- **Endpoint:** `/auth/refresh`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "refreshToken": "<your-refresh-token>"
}
```

### Logout
- **Method:** `POST`
- **Endpoint:** `/auth/logout`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Logout All Devices
- **Method:** `POST`
- **Endpoint:** `/auth/logout-all`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Forgot Password
- **Method:** `POST`
- **Endpoint:** `/auth/forgot-password`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com"
}
```

### Reset.Password
- **Method:** `POST`
- **Endpoint:** `/auth/reset-password`
- **Headers:** `Content-Type: application/json`
- **Body Example:**
```json
{
  "email": "jane@example.com",
  "otp": "654321",
  "newPassword": "NewStrongPassword123!"
}
```

### Change Password (Auth Required)
- **Method:** `PATCH`
- **Endpoint:** `/auth/change-password`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "oldPassword": "SecurePassword123!",
  "newPassword": "EvenMoreSecure456!"
}
```

### Get Current User Profile (Auth Required)
- **Method:** `GET`
- **Endpoint:** `/auth/me`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Update Current User Profile (Auth Required)
- **Method:** `PATCH`
- **Endpoint:** `/auth/me`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "name": "Jane Smith",
  "phone": "9876543210"
}
```

---

## 2. User Profile & Preferences (`/api/users`)

### List My Addresses
- **Method:** `GET`
- **Endpoint:** `/users/addresses`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Add New Address
- **Method:** `POST`
- **Endpoint:** `/users/addresses`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "street": "123 MG Road",
  "city": "Pune",
  "state": "Maharashtra",
  "postalCode": "411001",
  "country": "India",
  "isDefault": true
}
```

### Update Address
- **Method:** `PUT`
- **Endpoint:** `/users/addresses/:id`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Delete Address
- **Method:** `DELETE`
- **Endpoint:** `/users/addresses/:id`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Get My Wishlist
- **Method:** `GET`
- **Endpoint:** `/users/wishlist`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Toggle Wishlist Item
- **Method:** `POST`
- **Endpoint:** `/users/wishlist/:productId`
- **Headers:** `Authorization: Bearer <your_access_token>`
- *Note: Adds to wishlist if not present, removes if already present.*

---

## 3. Products (`/api/products`)

### List Products
- **Method:** `GET`
- **Endpoint:** `/products`
- **Query Params:**
  - `page=1`
  - `limit=20`
  - `category=wall-posters` (Matches exact slug OR products in this sub-category)
  - `search=anime` (Searches in Title, Description, and Category Name)
  - `sortBy=price_asc` (or `price_desc`, `popularity`)
  - `isFeatured=true` (Filter for featured items)
  - `isDealOfTheDay=true` (Filter for daily deals)
- **Headers:** No auth needed.

### Get Product By Slug
- **Method:** `GET`
- **Endpoint:** `/products/:slug`
- **Example URL:** `/products/macbook-pro-m3`
- **Headers:** No auth needed.

### Get Product Reviews
- **Method:** `GET`
- **Endpoint:** `/products/:productId/reviews`

### Add Product Review (Auth Required)
- **Method:** `POST`
- **Endpoint:** `/products/:productId/reviews`
- **Headers:** `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "rating": 5,
  "comment": "Amazing quality!"
}
```

---

## 3. Categories (`/api/categories`)

### List Categories
- **Method:** `GET`
- **Endpoint:** `/categories`
- **Headers:** No auth needed.

---
---

## 4. Orders (`/api/orders`)

### Create Order (Razorpay Alias)
- **Method:** `POST`
- **Endpoint:** `/create-order`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "items": [{ "productId": 5, "quantity": 2 }],
  "addressId": 1,
  "phoneNumber": "9876543210"
}
```

### Verify Payment (Razorpay Alias)
- **Method:** `POST`
- **Endpoint:** `/verify-payment`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "razorpay_order_id": "order_H2g13x...",
  "razorpay_payment_id": "pay_M1x...",
  "razorpay_signature": "signature_hash...",
  "orderId": 1
}
```

### Create Pending Order (Full Details)
- **Method:** `POST`
- **Endpoint:** `/orders`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "items": [
    {
      "productId": 5,
      "quantity": 2
    }
  ],
  "addressId": 1,
  "phoneNumber": "9876543210",
  "couponCode": "DISCOUNT10"
}
```

### Verify Razorpay Payment 
- **Method:** `POST`
- **Endpoint:** `/orders/verify-payment`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "razorpay_order_id": "order_H2g13x...",
  "razorpay_payment_id": "pay_M1x...",
  "razorpay_signature": "signature_hash..."
}
```

### Get Order History
- **Method:** `GET`
- **Endpoint:** `/orders`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Get Order Details
- **Method:** `GET`
- **Endpoint:** `/orders/:id`
- **Headers:** `Authorization: Bearer <your_access_token>`

### Apply Coupon to Order
- **Method:** `POST`
- **Endpoint:** `/orders/apply-coupon`
- **Headers:** `Authorization: Bearer <your_access_token>`
- **Body Example:**
```json
{
  "couponCode": "WELCOME2026"
}
```

---

## 5. System (`/api/health`)

### Health Check
- **Method:** `GET`
- **Endpoint:** `/health`
- **Headers:** No auth needed.

---

## 6. Admin (`/api/admin`) - (Requires Admin Auth)

> All admin routes require a valid JWT with `role === 'ADMIN'`.

### Get Dashboard Stats
- **Method:** `GET`
- **Endpoint:** `/admin/stats`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### Standalone Image Upload
- **Method:** `POST`
- **Endpoint:** `/admin/upload`
- **Headers:** 
  - `Content-Type: multipart/form-data`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example (Form Data):**
  - `image`: `[File Upload]`
- **Response Example:**
```json
{
  "success": true,
  "imageUrl": "https://res.cloudinary.com/...",
  "publicId": "crazzzy/abcde"
}
```

### Create Product
- **Method:** `POST`
- **Endpoint:** `/admin/products`
- **Headers:** 
  - `Content-Type: multipart/form-data`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example (Form Data):**
  - `title`: `Wall Poster #1`
  - `description`: `Aesthetic poster for your room`
  - `price`: `180.00`
  - `stock`: `100`
  - `categoryId`: `2`
  - `tags`: `#anime #onepiece #wallart` (Supports hashtags, spaces, or commas)
  - `isFeatured`: `true`
  - `isDealOfTheDay`: `false`
  - `images`: `[Multiple Files Upload]` (Max 5)

### Bulk Update Products
- **Method:** `PATCH`
- **Endpoint:** `/admin/products/bulk-update`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example:**
```json
{
  "updates": [
    {
      "id": 1,
      "title": "Anime Poster v2",
      "price": 199.99,
      "tags": "#anime #newedition",
      "stock": 50
    },
    {
      "id": 2,
      "title": "One Piece Poster",
      "tags": "#luffy #pirate"
    }
  ]
}
```

### Update Product Status
- **Method:** `PUT`
- **Endpoint:** `/admin/products/:id`
- **Headers:** 
  - `Content-Type: multipart/form-data`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example (Form Data):**
  - `price`: `899.99`
  - `isActive`: `false`
  - `tags`: `#newtag #discount`
  - `images`: `[Multiple Files Upload]` (Optional: adds to existing gallery)

### Delete Product
- **Method:** `DELETE`
- **Endpoint:** `/admin/products/:id`
- **Headers:** `Authorization: Bearer <admin_access_token>`
- *Note: Deletes DB record and all Cloudinary images.*

### Create Category
- **Method:** `POST`
- **Endpoint:** `/admin/categories`
- **Headers:** 
  - `Content-Type: multipart/form-data`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example (Form Data):**
  - `name`: `Anime Posters`
  - `image`: `[File Upload]` (Category branding image)

### Update Category
- **Method:** `PUT`
- **Endpoint:** `/admin/categories/:id`
- **Headers:** 
  - `Content-Type: multipart/form-data`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example (Form Data):**
  - `name`: `Updated Name`
  - `image`: `[File Upload]` (Replaces old image on Cloudinary)

### Delete Category
- **Method:** `DELETE`
- **Endpoint:** `/admin/categories/:id`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### List All Orders (Admin)
- **Method:** `GET`
- **Endpoint:** `/admin/orders`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### Update Order Status
- **Method:** `PATCH`
- **Endpoint:** `/admin/orders/:id/status`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example:**
```json
{
  "status": "SHIPPED"
}
```

### List All Users (Admin)
- **Method:** `GET`
- **Endpoint:** `/admin/users`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### Update User Role
- **Method:** `PATCH`
- **Endpoint:** `/admin/users/:id/role`
- **Headers:** 
  - `Content-Type: application/json`
  - `Authorization: Bearer <admin_access_token>`
- **Body Example:**
```json
{
  "role": "ADMIN"
}
```

### Toggle User Ban Status
- **Method:** `PATCH`
- **Endpoint:** `/admin/users/:id/ban`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### Delete User
- **Method:** `DELETE`
- **Endpoint:** `/admin/users/:id`
- **Headers:** `Authorization: Bearer <admin_access_token>`

### Create Coupon
- **Method:** `POST`
- **Endpoint:** `/admin/coupons`
- **Headers:** `Authorization: Bearer <admin_access_token>`
- **Body Example:**
```json
{
  "code": "FREESHIP",
  "discountType": "FIXED",
  "discountValue": 100,
  "usageLimit": 50,
  "expiresAt": "2026-12-31"
}
```

### List All Coupons
- **Method:** `GET`
- **Endpoint:** `/admin/coupons`
- **Headers:** `Authorization: Bearer <admin_access_token>`

