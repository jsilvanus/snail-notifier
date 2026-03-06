'use strict';

/**
 * Public scan endpoint used when a mail carrier scans a QR / NFC code.
 *
 * Simple tokens:
 *   GET  /api/scan/:token  — triggers notifications to all accepted members
 *
 * Data-input tokens:
 *   GET  /api/scan/:token  — returns { behavior: 'data_input', fields: [...] }
 *   POST /api/scan/:token  — accepts { responses: { fieldId: value } } and triggers notifications
 */

const router = require('express').Router();
const db = require('../db');
const { dispatchToMembership } = require('../services/dispatcher');

function buildPayload(code, responses) {
  if (responses) {
    // Build personalised message from field responses
    const parts = Object.values(responses).filter(Boolean).join(', ');
    return {
      title: `Notification from ${code.mailbox_label || code.name}`,
      body: parts ? `${parts} wanted to notify you.` : `You have a notification from ${code.mailbox_label || code.name}.`,
      url: process.env.USER_PWA_URL || 'http://localhost:5174',
    };
  }
  return {
    title: 'You have physical mail! 📬',
    body: `${code.mailbox_label || 'Your mailbox'} has mail waiting for you. Please collect it.`,
    url: process.env.USER_PWA_URL || 'http://localhost:5174',
  };
}

router.get('/:token', async (req, res) => {
  const code = db.prepare('SELECT * FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });

  if (code.behavior === 'data_input') {
    const fields = db.prepare('SELECT id, label, placeholder, field_type, options_json, required, sort_order FROM token_input_fields WHERE token_id = ? ORDER BY sort_order')
      .all(code.id);
    return res.json({
      behavior: 'data_input',
      tokenName: code.name,
      mailboxLabel: code.mailbox_label,
      fields: fields.map(f => ({ ...f, options: f.options_json ? JSON.parse(f.options_json) : null })),
    });
  }

  // Simple token: dispatch immediately
  const results = await notifyMembers(code, null);
  return res.json({ message: 'Scan recorded', mailbox: code.mailbox_label, results });
});

router.post('/:token', async (req, res) => {
  const code = db.prepare('SELECT * FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });

  if (code.behavior !== 'data_input') {
    return res.status(400).json({ error: 'This token does not accept form submissions' });
  }

  const { responses } = req.body;
  if (!responses || typeof responses !== 'object') {
    return res.status(400).json({ error: 'responses object is required' });
  }

  const results = await notifyMembers(code, responses);
  return res.json({ message: 'Notification sent', results });
});

async function notifyMembers(code, responses) {
  const memberships = db.prepare(`
    SELECT * FROM token_memberships WHERE token_id = ? AND status = 'accepted'
  `).all(code.id);

  if (memberships.length === 0) return [{ status: 'no_accepted_members' }];

  const payload = buildPayload(code, responses);
  const results = [];

  for (const membership of memberships) {
    const dispatched = await dispatchToMembership(membership, payload, code);
    results.push({ membershipId: membership.id, dispatched });
  }

  return results;
}

module.exports = router;
