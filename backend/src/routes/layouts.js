'use strict';

/**
 * Notifier layout routes — no auth required (share-code is the secret).
 *
 * POST   /api/layouts                            – Create a layout
 * GET    /api/layouts/:shareCode                 – Get layout + buttons
 * PATCH  /api/layouts/:shareCode                 – Rename
 * DELETE /api/layouts/:shareCode                 – Delete
 * POST   /api/layouts/:shareCode/buttons         – Add a button (token or layout)
 * PATCH  /api/layouts/:shareCode/buttons/:id     – Update button (label, color, sort_order)
 * DELETE /api/layouts/:shareCode/buttons/:id     – Remove button
 * PUT    /api/layouts/:shareCode/buttons/order   – Reorder (body: { order: [id, id, …] })
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getLayout(shareCode) {
  return db.prepare('SELECT * FROM notifier_layouts WHERE share_code = ?').get(shareCode);
}

function formatButtons(buttons) {
  return buttons.map(b => ({
    id: b.id,
    button_type: b.button_type,
    label: b.label,
    color: b.color,
    scan_token: b.scan_token,
    target_layout_id: b.target_layout_id,
    target_share_code: b.target_share_code || null,
    target_name: b.target_name || null,
    sort_order: b.sort_order,
  }));
}

// ── Create ────────────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Retry to avoid rare collisions
  let shareCode;
  for (let i = 0; i < 5; i++) {
    const candidate = generateShareCode();
    if (!db.prepare('SELECT id FROM notifier_layouts WHERE share_code = ?').get(candidate)) {
      shareCode = candidate; break;
    }
  }
  if (!shareCode) return res.status(500).json({ error: 'Could not generate unique share code' });

  const id = uuidv4();
  db.prepare('INSERT INTO notifier_layouts (id, name, share_code) VALUES (?, ?, ?)').run(id, name, shareCode);
  return res.status(201).json({ id, name, share_code: shareCode });
});

// ── Get ───────────────────────────────────────────────────────────────────────

router.get('/:shareCode', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  const buttons = db.prepare(`
    SELECT lb.*,
           nl.share_code AS target_share_code,
           nl.name       AS target_name
    FROM layout_buttons lb
    LEFT JOIN notifier_layouts nl ON nl.id = lb.target_layout_id
    WHERE lb.layout_id = ?
    ORDER BY lb.sort_order, lb.created_at
  `).all(layout.id);

  return res.json({ ...layout, buttons: formatButtons(buttons) });
});

// ── Rename ────────────────────────────────────────────────────────────────────

router.patch('/:shareCode', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.prepare('UPDATE notifier_layouts SET name = ? WHERE id = ?').run(name, layout.id);
  return res.json({ success: true, name });
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete('/:shareCode', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });
  db.prepare('DELETE FROM notifier_layouts WHERE id = ?').run(layout.id);
  return res.json({ success: true });
});

// ── Add button ────────────────────────────────────────────────────────────────

router.post('/:shareCode/buttons', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  const { button_type, label, color, scan_token, target_share_code } = req.body;
  if (!['token', 'layout'].includes(button_type || 'token')) return res.status(400).json({ error: 'button_type must be token or layout' });

  let targetLayoutId = null;
  if (button_type === 'layout') {
    if (!target_share_code) return res.status(400).json({ error: 'target_share_code required for layout buttons' });
    const target = db.prepare('SELECT id FROM notifier_layouts WHERE share_code = ?').get(target_share_code.toUpperCase());
    if (!target) return res.status(404).json({ error: 'Target layout not found' });
    targetLayoutId = target.id;
  } else {
    if (!scan_token) return res.status(400).json({ error: 'scan_token required for token buttons' });
    // Validate scan_token exists
    const code = db.prepare('SELECT id FROM codes WHERE scan_token = ?').get(scan_token);
    if (!code) return res.status(404).json({ error: 'Scan token not found' });
  }

  // Append at end
  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM layout_buttons WHERE layout_id = ?').get(layout.id)?.m ?? -1;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO layout_buttons (id, layout_id, button_type, label, color, scan_token, target_layout_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, layout.id, button_type || 'token', label || null, color || '#dbeafe', scan_token || null, targetLayoutId, maxOrder + 1);

  return res.status(201).json({ id, button_type: button_type || 'token', label, color, scan_token, target_layout_id: targetLayoutId });
});

// ── Update button ─────────────────────────────────────────────────────────────

router.patch('/:shareCode/buttons/:id', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  const btn = db.prepare('SELECT * FROM layout_buttons WHERE id = ? AND layout_id = ?').get(req.params.id, layout.id);
  if (!btn) return res.status(404).json({ error: 'Button not found' });

  const allowed = ['label', 'color'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (key in req.body) { updates.push(`${key} = ?`); params.push(req.body[key] ?? null); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  params.push(btn.id);
  db.prepare(`UPDATE layout_buttons SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return res.json({ success: true });
});

// ── Remove button ─────────────────────────────────────────────────────────────

router.delete('/:shareCode/buttons/:id', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  const result = db.prepare('DELETE FROM layout_buttons WHERE id = ? AND layout_id = ?').run(req.params.id, layout.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Button not found' });
  return res.json({ success: true });
});

// ── Reorder buttons ───────────────────────────────────────────────────────────

router.put('/:shareCode/buttons/order', (req, res) => {
  const layout = getLayout(req.params.shareCode.toUpperCase());
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  const { order } = req.body; // array of button IDs in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of button IDs' });

  const update = db.prepare('UPDATE layout_buttons SET sort_order = ? WHERE id = ? AND layout_id = ?');
  const updateMany = db.transaction((ids) => {
    ids.forEach((id, i) => update.run(i, id, layout.id));
  });
  updateMany(order);
  return res.json({ success: true });
});

module.exports = router;
