# Crazzzy.in Backend Features Directory

This document outlines the core logic and features of the Crazzzy.in backend, bifurcated into User-facing features and Administrative controls.

---

## 🛍️ 1. User & Customer Features

These features are accessible to regular users and focus on the shopping experience, account security, and personalization.

### A. Authentication & Security
| Feature | Description |
| :--- | :--- |
| **Secure Signup** | OTP-based email verification using cryptographically secure random integers (CSPRNG). |
| **Robust Login** | JWT-based authentication with high-entropy Access Tokens and 64-byte Refresh Token rotation. |
| **Session Management** | Support for logging out of current session or "Logout All Devices" for compromised accounts. |
| **Account Recovery** | Secure "Forgot Password" flow with OTP verification and session invalidation on reset. |
| **Ban Protection** | Immediate session termination across all devices if an account is flagged as banned. |

### B. Shopping Experience
| Feature | Description |
| :--- | :--- |
| **Advanced Search** | Cross-entity search covering Product Titles, Descriptions, Categories, and Tags. |
| **Smart Filtering** | Filter by parent category, sub-category, price, popularity, and special flags (Featured, Deal of the Day). |
| **Product Variants** | Dynamic pricing based on product options (e.g., Poster size: 13x19 vs A4). |
| **Tagging System** | Navigate and discover products via an optimized many-to-many tag relationship. |
| **Wishlist** | One-click toggle system to save products for later. |
| **Product Reviews** | Purchase-gated reviews (only buyers who received the item can rate) with automated rating averages. |

### C. Checkout & Orders
| Feature | Description |
| :--- | :--- |
| **Razorpay Integration** | Secure Standard Checkout flow with server-side HMAC-SHA256 signature verification. |
| **Address Book** | Manage multiple shipping addresses with "Default Address" intelligence. |
| **Coupon Engine** | Real-time validation of promo codes (percentage or fixed discounts) with usage limit tracking. |
| **Order Tracking** | Detailed personal order history with nested product summaries and status updates. |
| **Email Receipts** | Automated professional HTML email receipts sent upon successful payment verification. |

---

## 🛡️ 2. Administrative & Management Features

These features are restricted to users with the `ADMIN` role and focus on store operations and user moderation.

### A. Catalog Management
| Feature | Description |
| :--- | :--- |
| **Product CRUD** | Complete management of products, including multiple image uploads (Cloudinary) and variant configuration. |
| **Bulk Updates** | High-efficiency `PATCH` endpoint to update prices, stock, and titles for multiple products in one request. |
| **Category System** | Hierarchical category management (Parent/Child) with branding image support. |
| **Automated Cleanup** | "Smart Delete" logic that automatically removes orphaned images from Cloudinary when a product or category is deleted. |
| **Standalone Upload** | Dedicated utility endpoint to fetch Cloudinary URLs for banners or descriptions before saving data. |

### B. Operations & Analytics
| Feature | Description |
| :--- | :--- |
| **Sales Dashboard** | Real-time stats for Total Revenue, Total Orders, Total Users, and Recent Activity using concurrent database aggregators. |
| **Order Fulfillment** | Admin-only status updates (`SHIPPED`, `DELIVERED`, `CANCELLED`) to keep customers informed. |
| **Coupon Creation** | Full control over promo codes, including expiry dates, discount types, and specific usage caps. |

### C. User Moderation
| Feature | Description |
| :--- | :--- |
| **User Directory** | Searchable list of all registered users and their account statuses. |
| **Role Management** | Capability to promote users to `ADMIN` or demote them. |
| **Account Banning** | Instantly block access and revoke all active sessions for problematic users. |
| **User Deletion** | Permanent removal of user accounts (restricted to preventing self-deletion). |

---

## ⚙️ 3. Technical Foundation (Under the Hood)
*   **Database**: Prisma 7 with PostgreSQL (Driver Adapters for optimized pooling).
*   **Media**: Cloudinary for performant, on-the-fly image optimization and WebP delivery.
*   **Payments**: Razorpay Standard Web Integration.
*   **Architecture**: Modular Express.js with TypeScript for strict type-safety and scalability.
*   **Email**: SMTP-based mailing with professional templates for OTPs and Order Receipts.
