/**
 * Notification layout routes (org-admin only).
 *
 * Layouts are reusable message templates identified by a human-readable
 * share_code. Consumers (e.g. the notifier PWA) reference layouts by
 * share_code, while the database stores an integer FK (layout_id).
 * This route resolves the share_code → id before inserting so the schema
 * constraint is always satisfied.
 *
 * GET    /api/layouts          – List all layouts for this org
 * POST   /api/layouts          – Create a new layout
 * PUT    /api/layouts/:id      – Update a layout
 * DELETE /api/layouts/:id      – Delete a layout
 * POST   /api/layouts/resolve  – Resolve share_code → layout record (used by notifier)
 */

import { Router } from 'express';
import db from '../db/index.js';
import auth from '../middleware/auth.js';

const router = Router();

// All layout routes require an authenticated org user
router.use(auth);

// ── List layouts ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const layouts = db.prepare(
    'SELECT id, share_code, name, template, created_at FROM notification_layouts ORDER BY created_at DESC',
  ).all();
  return res.json(layouts);
});

// ── Create layout ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const { share_code, name, template } = req.body;
  if (!share_code || !name || !template) {
    return res.status(400).json({ error: 'share_code, name and template are required' });
  }

  const existing = db.prepare('SELECT id FROM notification_layouts WHERE share_code = ?').get(share_code);
  if (existing) return res.status(409).json({ error: 'share_code already exists' });

  const info = db.prepare(
    'INSERT INTO notification_layouts (share_code, name, template) VALUES (?,?,?)',
  ).run(share_code, name, template);

  return res.status(201).json({ id: info.lastInsertRowid, share_code, name, template });
});

// ── Update layout ─────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const { name, template } = req.body;
  if (!name && !template) {
    return res.status(400).json({ error: 'At least one of name or template is required' });
  }

  const layout = db.prepare('SELECT id FROM notification_layouts WHERE id = ?').get(req.params.id);
  if (!layout) return res.status(404).json({ error: 'Layout not found' });

  if (name) db.prepare('UPDATE notification_layouts SET name = ? WHERE id = ?').run(name, req.params.id);
  if (template) db.prepare('UPDATE notification_layouts SET template = ? WHERE id = ?').run(template, req.params.id);

  const updated = db.prepare('SELECT id, share_code, name, template, created_at FROM notification_layouts WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

// ── Delete layout ─────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const result = db.prepare('DELETE FROM notification_layouts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Layout not found' });
  return res.json({ success: true });
});

// ── Resolve share_code → layout record ───────────────────────────────────
// Used by the notifier API client to get the integer layout_id before
// inserting a notification_queue row, so the FK constraint is satisfied.
// The request body uses `target_share_code` to match the field name that the
// notifier client sends when referencing a layout by its human-readable code.
router.post('/resolve', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const { target_share_code } = req.body;
  if (!target_share_code) {
    return res.status(400).json({ error: 'target_share_code is required' });
  }

  const layout = db.prepare(
    'SELECT id, share_code, name, template FROM notification_layouts WHERE share_code = ?',
  ).get(target_share_code);

  if (!layout) return res.status(404).json({ error: 'Layout not found for given share_code' });

  return res.json({ layout_id: layout.id, share_code: layout.share_code, name: layout.name });
});

export default router;
