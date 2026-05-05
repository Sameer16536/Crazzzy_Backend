# Changelog

## [2026-05-05] - Admin Login and Production Email Fixes

### Fixed
- **Admin Login Failing:** Admin accounts are often seeded manually into the database and may bypass the traditional email verification flow, defaulting to `isVerified: false`. Added an exception in `src/controllers/authController.ts` within the `login` function to allow users with `Role.ADMIN` to log in successfully even if their account is not verified.
- **Email Service Failing in Production:** Fixed an issue where the production email service (`src/config/mail.ts`) was aggressively stripping spaces from the SMTP password (`.replace(/\s/g, '')`) which could break valid passwords (like Gmail App Passwords with spaces), and failed to trim whitespace from other variables like `SMTP_SECURE`. Replaced the replace logic with a safe `.trim()`. Additionally, removed the aggressive `pool` and rate-limiting options from the Nodemailer configuration, as these settings frequently cause timeouts and connection drops in containerized and cloud environments (like Railway) when communicating with strict SMTP providers.
