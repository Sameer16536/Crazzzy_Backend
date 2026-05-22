# Changelog

## [2026-05-17] - Product Offers Feature Implementation

### Added
- **Database Schema Support:** Added `ProductOffer` model in `schema.prisma` representing trigger product and JSON string list of free product IDs. Pushed directly to VPS PostgreSQL database.
- **Backend Pricing & Order Validation Engine:** Upgraded `calculateOrderPricing` in `pricing.ts` to solve BOGO and Cross-Product Free promotions, securing payment amount calculations against Razorpay checks in `orderController.ts`. Added admin CRUD and public GET `/settings/product-offers` routes in backend.
- **Frontend Catalog Context Caching:** Added `ProductOffer` types, concurrently fetched product offers, and globally cached them in `catalog-context.tsx`.
- **Client-Side Redux Promotions Solver:** Implemented `calculateProductOffers` in `cart-slice.ts` to compute item discounts and dynamic cart upsells/free gift suggestions.
- **Product Page Badges:** Dynamically rendered live promotion tags (e.g. `🎁 BUY 1 GET 1 FREE`) under titles in `app/product/[id]/page.tsx`.
- **Cart Page suggestions:** Added visual tags on discounted items and thumbnail-based upsell suggestions (with "Add Freebie" CTA) in `app/cart/page.tsx`.
- **Checkout Total Consistency:** Updated `app/checkout/page.tsx` summary panel to run the promotions solver and display exact visual promo discounts, guaranteeing consistency with Razorpay charges.
- **Admin Console Overhaul:** Overhauled the `Product Offers` console at `app/admin/product-offers/page.tsx` with searchable selectors (mini square thumbnails, category filters, radio/checkbox controllers matching the Combo Deals panel). Simplified technical descriptions to plain-English, step-by-step instructions. Rendered rich visual flow timeline cards showing trigger/gift thumbnails and indicator arrows. Added full **Edit Option** support (with parsed parameters and smooth window scrolling to form) and comprehensive, descriptive **Toast Messages** (`toast.success` and `toast.error` via `sonner`) for every action (load, create, update, toggle, delete).

## [2026-05-05] - Admin Login and Production Email Fixes

### Fixed
- **Admin Login Failing:** Admin accounts are often seeded manually into the database and may bypass the traditional email verification flow, defaulting to `isVerified: false`. Added an exception in `src/controllers/authController.ts` within the `login` function to allow users with `Role.ADMIN` to log in successfully even if their account is not verified.
- **Email Service Failing in Production:** Fixed an issue where the production email service (`src/config/mail.ts`) was aggressively stripping spaces from the SMTP password (`.replace(/\s/g, '')`) which could break valid passwords (like Gmail App Passwords with spaces), and failed to trim whitespace from other variables like `SMTP_SECURE`. Replaced the replace logic with a safe `.trim()`. Additionally, removed the aggressive `pool` and rate-limiting options from the Nodemailer configuration, as these settings frequently cause timeouts and connection drops in containerized and cloud environments (like Railway) when communicating with strict SMTP providers.
