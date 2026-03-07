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
import consentRouter from './routes/consent.js';
import layoutsRouter from './routes/layouts.js';
import { flushNotificationQueue } from './services/dispatcher.js';

const app = express();

app.use(cors());
app.use(express.json());

// ── Rate limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
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
// Consent + membership routes — mounted at /api for clean paths like /api/tokens/:id/invite
app.use('/api', apiLimiter, consentRouter);
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

// Start server only when run directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Snail-Notifier backend listening on port ${PORT}`));
  // Background worker: flush queued notifications every 60 seconds
  setInterval(() => flushNotificationQueue().catch(console.error), 60_000);
}

export default app;
