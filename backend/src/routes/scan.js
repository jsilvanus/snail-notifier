/**
 * Public scan endpoint.
 *
 * GET  /api/scan/:token        — info + immediate dispatch for simple tokens
 * POST /api/scan/:token        — submit form responses for data_input tokens
 * GET  /api/scan/:token/info   — lightweight token info (for notifier app)
 */

import express from 'express';
import db from '../db/index.js';
import { dispatchToMembership } from '../services/dispatcher.js';

const router = express.Router();

router.get('/:token/info', (req, res) => {
  const code = db.prepare('SELECT id, name, title, description, behavior, mailbox_label, scan_token, type FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });
  return res.json(code);
});

router.get('/:token', async (req, res) => {
  const code = db.prepare('SELECT * FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });

  if (code.behavior === 'data_input') {
    const fields = db.prepare('SELECT id, label, placeholder, field_type, options_json, required, sort_order FROM token_input_fields WHERE token_id = ? ORDER BY sort_order')
      .all(code.id);
    return res.json({
      behavior: 'data_input',
      tokenName: code.title || code.name,
      description: code.description,
      mailboxLabel: code.mailbox_label,
      fields: fields.map(f => ({ ...f, options: f.options_json ? JSON.parse(f.options_json) : null })),
    });
  }

  const results = await notifyMembers(code, null);
  return res.json({ message: 'Scan recorded', mailbox: code.mailbox_label, results });
});

router.post('/:token', async (req, res) => {
  const code = db.prepare('SELECT * FROM codes WHERE scan_token = ?').get(req.params.token);
  if (!code) return res.status(404).json({ error: 'Invalid scan token' });
  if (code.behavior !== 'data_input') return res.status(400).json({ error: 'This token does not accept form submissions' });

  const { responses } = req.body;
  if (!responses || typeof responses !== 'object') return res.status(400).json({ error: 'responses object is required' });

  const results = await notifyMembers(code, responses);
  return res.json({ message: 'Notification sent', results });
});

async function notifyMembers(code, responses) {
  const memberships = db.prepare("SELECT * FROM token_memberships WHERE token_id = ? AND status = 'accepted'").all(code.id);
  if (memberships.length === 0) return [{ status: 'no_accepted_members' }];

  const results = [];
  for (const membership of memberships) {
    const dispatched = await dispatchToMembership(membership, null, code, responses);
    results.push({ membershipId: membership.id, dispatched });
  }
  return results;
}

export default router;
