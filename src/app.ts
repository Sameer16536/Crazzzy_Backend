import dotenv from 'dotenv';
dotenv.config();

// ── Force IPv4 DNS resolution (MUST be before any network calls) ──────────────
// Railway's network blocks IPv6 outbound. Without this, Node.js DNS resolver
// picks IPv6 addresses (e.g. Gmail SMTP returns 2607:f8b0:...) and all
// TCP connections to external services fail with ENETUNREACH.
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import path from 'path';

import { errorHandler, notFound } from './middlewares/errorMiddleware';

// ── Routes ────────────────────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import userRoutes from './routes/userRoutes';
import { createOrder, verifyPayment, createOrderValidation, verifyPaymentValidation } from './controllers/orderController';
import { authenticate } from './middlewares/authMiddleware';

const app = express();

// ── Trust Proxy (Required for Railway / any reverse-proxy deployment) ──────────
// Railway sits behind a load balancer that injects X-Forwarded-For headers.
// Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// and req.ip returns the proxy IP instead of the real client IP.
app.set('trust proxy', 1);

// ── Security & Performance Middleware ─────────────────────────────────────────
app.use(helmet());
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Static Files (Uploaded Images) ───────────────────────────────────────────
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// ── Smart Cache Headers ───────────────────────────────────────────────────────
// GET  → short public cache (30s) so pages load fast from CDN/browser cache.
// Mutations (POST/PUT/PATCH/DELETE) → no-store so changes go live immediately.
// This is the correct pattern: cache reads, bust on writes.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    // 30s CDN cache, serve stale while revalidating for up to 60s more.
    // After any mutation the next GET re-fetches from origin within 30s.
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  } else {
    // Never cache mutation responses
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

import settingsRoutes from './routes/settingsRoutes';
import cartRoutes from './routes/cartRoutes';
import webhookRoutes from './routes/webhookRoutes';
import rateLimit from 'express-rate-limit';

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 order creations per window
  message: { success: false, message: 'Too many orders created from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── API Routes (prefixed at /api) ─────────────────────────────────────────────
// Webhooks (Registered BEFORE body parser if they need raw body, but Razorpay works with JSON)
app.use('/api/webhooks', webhookRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cart', cartRoutes);

// Razorpay specific aliases (Applying rate limiter here too)
app.post('/api/create-order', orderLimiter, authenticate, createOrderValidation, createOrder);
app.post('/api/verify-payment', authenticate, verifyPaymentValidation, verifyPayment);

// ── 404 & Centralised Error Handler ──────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Crazzzy API] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

export default app;
