'use strict';

/**
 * Public scan endpoint used when a mail carrier scans a QR / NFC code.
 * GET /api/scan/:token  – no authentication required
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { sendPushNotification } = require('./notifications');

router.get('/:token', async (req, res) => {
  const code = db.prepare('SELECT * FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });

  const notifId = uuidv4();
  let status = 'no_subscribers';

  if (code.contact_email) {
    const endUser = db.prepare('SELECT * FROM end_users WHERE email = ?').get(code.contact_email);
    if (endUser && endUser.push_subscription) {
      try {
        await sendPushNotification(JSON.parse(endUser.push_subscription), {
          title: 'You have physical mail! 📬',
          body: `${code.mailbox_label || 'Your mailbox'} has mail waiting for you. Please collect it.`,
          url: process.env.USER_PWA_URL || 'http://localhost:5174',
        });
        db.prepare('INSERT INTO notifications (id, code_id, end_user_id, method, status) VALUES (?,?,?,?,?)')
          .run(notifId, code.id, endUser.id, 'push', 'sent');
        status = 'push_sent';
      } catch {
        db.prepare('INSERT INTO notifications (id, code_id, end_user_id, method, status) VALUES (?,?,?,?,?)')
          .run(notifId, code.id, endUser.id, 'push', 'failed');
        status = 'push_failed';
      }
    } else if (endUser) {
      db.prepare('INSERT INTO notifications (id, code_id, end_user_id, method, status) VALUES (?,?,?,?,?)')
        .run(notifId, code.id, endUser.id, 'push', 'no_subscription');
      status = 'no_subscription';
    }
  }

  return res.json({
    message: 'Scan recorded',
    mailbox: code.mailbox_label,
    status,
  });
});

module.exports = router;
