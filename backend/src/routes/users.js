/**
 * Org-user management routes (admin only).
 * GET  /api/users          – List org users
 * POST /api/users          – Invite / create a new org user
 * DELETE /api/users/:id    – Remove an org user
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// All routes require an authenticated org user
router.use(auth);

router.get('/', (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare('SELECT id, name, email, role, created_at FROM org_users WHERE org_id = ?')
    .all(req.user.orgId);
  return res.json(users);
});

router.post('/', (req, res) => {
  if (req.user.type !== 'org_user' || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { name, email, password, role = 'member' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });

  const existing = db.prepare('SELECT id FROM org_users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  db.prepare('INSERT INTO org_users (id, org_id, name, email, password_hash, role) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.orgId, name, email, passwordHash, role === 'admin' ? 'admin' : 'member');

  return res.status(201).json({ id, name, email, role });
});

router.delete('/:id', (req, res) => {
  if (req.user.type !== 'org_user' || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const result = db.prepare('DELETE FROM org_users WHERE id = ? AND org_id = ?')
    .run(req.params.id, req.user.orgId);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ success: true });
});

export default router;
