'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const codesRouter = require('./routes/codes');
const scanRouter = require('./routes/scan');
const notificationsRouter = require('./routes/notifications');
const consentRouter = require('./routes/consent');
const layoutsRouter = require('./routes/layouts');
const { flushNotificationQueue } = require('./services/dispatcher');

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
if (require.main === module) {
  app.listen(PORT, () => console.log(`Snail-Notifier backend listening on port ${PORT}`));
  // Background worker: flush queued notifications every 60 seconds
  setInterval(() => flushNotificationQueue().catch(console.error), 60_000);
}

module.exports = app;
