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

### Resend OTP
- **Method:** `POST`
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

## 2. Products (`/api/products`)

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

---

## 3. Categories (`/api/categories`)

### List Categories
- **Method:** `GET`
- **Endpoint:** `/categories`
- **Headers:** No auth needed.

---

## 4. Orders (`/api/orders`)

### Create Pending Order (Init Razorpay)
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
  "shippingAddress": "123 Awesome Street, City, Country",
  "phoneNumber": "9876543210"
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

---

## 5. Admin (`/api/admin`) - (Requires Admin Auth)

> All admin routes require a valid JWT with `role === 'ADMIN'`.

### Get Dashboard Stats
- **Method:** `GET`
- **Endpoint:** `/admin/stats`
- **Headers:** `Authorization: Bearer <admin_access_token>`

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
