'use strict';

/**
 * Code management routes (QR / NFC codes per organisation).
 * GET    /api/codes                    – List org codes
 * POST   /api/codes                    – Create a new code (generates QR image)
 * DELETE /api/codes/:id                – Delete a code
 * GET    /api/codes/:id/qr             – Return QR PNG image
 * GET    /api/codes/:id/members        – List token memberships for a code
 * GET    /api/codes/:id/fields         – List input fields for a data_input code
 * POST   /api/codes/:id/fields         – Add an input field
 * DELETE /api/codes/:id/fields/:fid   – Remove an input field
 */

const router = require('express').Router();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');

// ── Authenticated org-user routes ─────────────────────────────────────────

router.get('/', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const codes = db.prepare(`
    SELECT c.id, c.name, c.type, c.behavior, c.mailbox_label, c.contact_email, c.contact_phone,
           c.scan_token, c.created_at,
           COUNT(tm.id) FILTER (WHERE tm.status = 'accepted') AS member_count,
           COUNT(tm.id) FILTER (WHERE tm.status = 'pending')  AS pending_invites
    FROM codes c
    LEFT JOIN token_memberships tm ON tm.token_id = c.id
    WHERE c.org_id = ?
    GROUP BY c.id
  `).all(req.user.orgId);
  return res.json(codes);
});

router.post('/', auth, async (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const { name, type, behavior, mailbox_label, contact_email, contact_phone } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!['QR', 'NFC'].includes(type)) return res.status(400).json({ error: 'type must be QR or NFC' });
  const codeBehavior = behavior || 'simple';
  if (!['simple', 'data_input'].includes(codeBehavior)) return res.status(400).json({ error: 'behavior must be simple or data_input' });

  const id = uuidv4();
  const scanToken = uuidv4();
  const scanUrl = `${process.env.PUBLIC_URL || 'http://localhost:3001'}/api/scan/${scanToken}`;

  let qrDataUrl = null;
  if (type === 'QR') {
    qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300 });
  }

  db.prepare(`INSERT INTO codes (id, org_id, name, type, behavior, mailbox_label, contact_email, contact_phone, qr_data_url, scan_token)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.orgId, name, type, codeBehavior, mailbox_label || null, contact_email || null, contact_phone || null, qrDataUrl, scanToken);

  return res.status(201).json({ id, name, type, behavior: codeBehavior, mailbox_label, contact_email, contact_phone, scan_token: scanToken, scan_url: scanUrl, qr_data_url: qrDataUrl });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const result = db.prepare('DELETE FROM codes WHERE id = ? AND org_id = ?').run(req.params.id, req.user.orgId);
  if (result.changes === 0) return res.status(404).json({ error: 'Code not found' });
  return res.json({ success: true });
});

// Return QR as PNG image
router.get('/:id/qr', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const code = db.prepare('SELECT * FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Code not found' });
  if (code.type !== 'QR' || !code.qr_data_url) return res.status(400).json({ error: 'Not a QR code' });

  const base64Data = code.qr_data_url.replace(/^data:image\/png;base64,/, '');
  const imgBuffer = Buffer.from(base64Data, 'base64');
  res.setHeader('Content-Type', 'image/png');
  return res.send(imgBuffer);
});

// ── Members for a code ────────────────────────────────────────────────────────

router.get('/:id/members', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const code = db.prepare('SELECT id FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Code not found' });

  const members = db.prepare(`
    SELECT tm.id, tm.status, tm.paused, tm.vacation_until, tm.invited_at, tm.responded_at,
           eu.email
    FROM token_memberships tm
    JOIN end_users eu ON eu.id = tm.end_user_id
    WHERE tm.token_id = ?
    ORDER BY tm.invited_at DESC
  `).all(code.id);

  return res.json(members);
});

// ── Input fields for data_input codes ────────────────────────────────────────

router.get('/:id/fields', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const code = db.prepare('SELECT id FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Code not found' });

  const fields = db.prepare('SELECT * FROM token_input_fields WHERE token_id = ? ORDER BY sort_order').all(code.id);
  return res.json(fields.map(f => ({ ...f, options: f.options_json ? JSON.parse(f.options_json) : null })));
});

router.post('/:id/fields', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const code = db.prepare('SELECT * FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Code not found' });
  if (code.behavior !== 'data_input') return res.status(400).json({ error: 'Code is not a data_input type' });

  const { label, placeholder, field_type, options, required, sort_order } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const ft = field_type || 'text';
  if (!['text', 'number', 'select'].includes(ft)) return res.status(400).json({ error: 'field_type must be text, number, or select' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO token_input_fields (id, token_id, label, placeholder, field_type, options_json, required, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code.id, label, placeholder || null, ft, options ? JSON.stringify(options) : null, required !== false ? 1 : 0, sort_order || 0);

  return res.status(201).json({ id, label, placeholder, field_type: ft, options: options || null, required: required !== false, sort_order: sort_order || 0 });
});

router.delete('/:id/fields/:fid', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const code = db.prepare('SELECT id FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Code not found' });

  const result = db.prepare('DELETE FROM token_input_fields WHERE id = ? AND token_id = ?').run(req.params.fid, code.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Field not found' });
  return res.json({ success: true });
});

module.exports = router;
