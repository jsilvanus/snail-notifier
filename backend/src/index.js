import 'dotenv/config';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import codesRouter from './routes/codes.js';
import scanRouter from './routes/scan.js';
import notificationsRouter from './routes/notifications.js';
import layoutsRouter from './routes/layouts.js';
import { flushNotificationQueue } from './dispatcher.js';

const app = express();

app.use(cors());
app.use(express.json());

// ── Rate limiters ────────────────────────────────────────────────────────────

// Strict limiter for authentication endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Moderate limiter for scan endpoint (mail carriers may scan in bursts)
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests, please try again later' },
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/scan', scanLimiter, scanRouter);
app.use('/api/users', apiLimiter, usersRouter);
app.use('/api/codes', apiLimiter, codesRouter);
app.use('/api/notifications', apiLimiter, notificationsRouter);
app.use('/api/layouts', apiLimiter, layoutsRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

// Only start the server and background jobs when run directly (not imported by tests).
// The flushNotificationQueue interval is intentionally guarded here so it does
// not leak into test runs.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Snail-Notifier backend listening on port ${PORT}`));

  const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
  setInterval(flushNotificationQueue, FLUSH_INTERVAL_MS);
}

export default app;
