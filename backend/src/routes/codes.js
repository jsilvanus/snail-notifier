'use strict';

/**
 * Code management routes (QR / NFC codes per organisation).
 * GET    /api/codes             – List org codes
 * POST   /api/codes             – Create a new code (generates QR image)
 * DELETE /api/codes/:id         – Delete a code
 * GET    /api/codes/:id/qr      – Return QR PNG image
 */

const router = require('express').Router();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../middleware/auth');

// ── Authenticated org-user routes ─────────────────────────────────────────

router.get('/', auth, (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const codes = db.prepare('SELECT id, name, type, mailbox_label, contact_email, contact_phone, scan_token, created_at FROM codes WHERE org_id = ?')
    .all(req.user.orgId);
  return res.json(codes);
});

router.post('/', auth, async (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const { name, type, mailbox_label, contact_email, contact_phone } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!['QR', 'NFC'].includes(type)) return res.status(400).json({ error: 'type must be QR or NFC' });

  const id = uuidv4();
  const scanToken = uuidv4();
  const scanUrl = `${process.env.PUBLIC_URL || 'http://localhost:3001'}/api/scan/${scanToken}`;

  let qrDataUrl = null;
  if (type === 'QR') {
    qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300 });
  }

  db.prepare(`INSERT INTO codes (id, org_id, name, type, mailbox_label, contact_email, contact_phone, qr_data_url, scan_token)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.orgId, name, type, mailbox_label || null, contact_email || null, contact_phone || null, qrDataUrl, scanToken);

  return res.status(201).json({ id, name, type, mailbox_label, contact_email, contact_phone, scan_token: scanToken, scan_url: scanUrl, qr_data_url: qrDataUrl });
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

  // Strip data URL prefix and send raw PNG
  const base64Data = code.qr_data_url.replace(/^data:image\/png;base64,/, '');
  const imgBuffer = Buffer.from(base64Data, 'base64');
  res.setHeader('Content-Type', 'image/png');
  return res.send(imgBuffer);
});

module.exports = router;
