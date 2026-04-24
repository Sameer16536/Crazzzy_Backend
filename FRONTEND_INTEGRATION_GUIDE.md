# Crazzzy.in - Frontend Integration Guide

This document is designed for an AI developer to integrate the newly refactored TypeScript/Prisma backend into the Crazzzy.in frontend.

## 1. Core Integration Details
- **Base URL**: `http://localhost:3000/api` (or your production domain)
- **Authentication**: JWT Bearer Token.
- **Header**: `Authorization: Bearer <access_token>`
- **Content-Type**: `application/json`

---

## 2. Global Data Models (Data Shapes)

### Product Object
```json
{
  "id": 1,
  "title": "Nike Air Max",
  "slug": "nike-air-max",
  "price": "1200.00",
  "originalPrice": "1500.00",
  "stock": 45,
  "imageUrl": "https://...",
  "isFeatured": true,
  "isDealOfTheDay": false,
  "ratingAvg": 4.5,
  "reviewCount": 12,
  "category": { "name": "Footwear", "slug": "footwear" },
  "images": [{ "imageUrl": "..." }],
  "variants": [{ "name": "Size", "value": "10", "price": "0.00" }]
}
```

### Order Object
```json
{
  "id": 1,
  "status": "PAID | SHIPPED | DELIVERED",
  "totalAmount": "3600.00",
  "discountApplied": "150.00",
  "trackingNumber": "TRK12345",
  "courierName": "Delhivery",
  "estimatedDelivery": "ISO_DATE",
  "deliveredAt": "ISO_DATE",
  "items": [{ "quantity": 2, "price": "1800.00", "product": { "title": "..." } }]
}
```

---

## 3. Key Frontend Use Cases

### A. Home Page (Marketing Sections)
- **Featured Products**: `GET /api/products?isFeatured=true`
- **Deal of the Day**: `GET /api/products?isDealOfTheDay=true`
- **Category Sliders**: `GET /api/categories` (Returns name, slug, and product count).

### B. Product Listing (Shop Page)
- **Filtering**: `GET /api/products?category=electronics&search=sony`
- **Sorting**: Supports `sortBy=price_asc`, `sortBy=price_desc`, and `sortBy=popularity` (most reviews).
- **Pagination**: Uses `page` and `limit`. Metadata is returned in the `meta` object.

### C. Checkout Flow (Razorpay + Coupons)
1.  **Validate Coupon**: `POST /api/orders/apply-coupon` (Send `code` and `cartTotal`). Returns `discountAmount`.
2.  **Initialize Order**: `POST /api/orders`.
    - **Input**: `items: [{productId, quantity}]`, `addressId`, `couponCode`.
    - **Output**: Returns `razorpay_order_id` and `amount` (in paise).
3.  **Razorpay Modal**: Use `response.razorpay` to trigger the JS SDK.
4.  **Confirm Payment**: `POST /api/orders/verify-payment`.
    - **Input**: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `orderId`.

### D. User Account & Engagement
- **Wishlist**: `POST /api/users/wishlist/:productId` (Toggle logic: adds if missing, removes if present).
- **Addresses**: `GET/POST/PUT/DELETE /api/users/addresses`.
- **Order History**: `GET /api/orders` returns list with tracking info.
- **Reviews**: `POST /api/products/:productId/reviews`. Enforces that only users with a `DELIVERED` order for that product can post.

---

## 4. Integration Gotchas
- **Decimals**: Currency values are returned as **Strings** (e.g., `"1200.00"`) to prevent float precision errors. Convert to Number in the UI only for display.
- **Images**: If `imageUrl` is relative, prefix it with the backend host.
- **Error Handling**: The API returns a consistent error format:
  `{ "success": false, "message": "Error Description" }` (HTTP status codes 400, 401, 403, 422, etc.).
