/**
 * Notification / push-subscription routes.
 * POST /api/notifications/subscribe    – End-user saves their push subscription
 * DELETE /api/notifications/subscribe  – End-user removes their push subscription
 * GET  /api/notifications              – End-user polls for their recent notifications
 * GET  /api/notifications/vapid-key    – Return VAPID public key (no auth)
 */

import express from 'express';
import webpush from 'web-push';
import db from '../db/index.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Configure VAPID if keys are provided
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Send a web-push notification.
 * @param {object} subscription  – PushSubscription JSON
 * @param {object} payload       – { title, body, url }
 */
async function sendPushNotification(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

// ── Public: VAPID public key ──────────────────────────────────────────────
router.get('/vapid-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// ── Authenticated end-user routes ─────────────────────────────────────────
router.post('/subscribe', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription is required' });

  db.prepare('UPDATE end_users SET push_subscription = ? WHERE id = ?')
    .run(JSON.stringify(subscription), req.user.sub);

  return res.json({ success: true });
});

router.delete('/subscribe', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE end_users SET push_subscription = NULL WHERE id = ?').run(req.user.sub);
  return res.json({ success: true });
});

// End-user polls for recent notifications sent to codes linked to their email
router.get('/', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const rows = db.prepare(`
    SELECT n.id, n.method, n.status, n.sent_at,
           c.name AS code_name, c.mailbox_label, c.type AS code_type
    FROM notifications n
    JOIN codes c ON c.id = n.code_id
    WHERE n.end_user_id = ?
    ORDER BY n.sent_at DESC
    LIMIT 50
  `).all(req.user.sub);

  return res.json(rows);
});

export default router;
export { sendPushNotification };
