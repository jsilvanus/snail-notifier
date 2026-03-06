/**
 * Auth routes for organizations and their users.
 * POST /api/auth/org/register  – Register a new organization (first admin user)
 * POST /api/auth/org/login     – Login as an org user
 * POST /api/auth/user/register – Register a new end-user (mailbox owner)
 * POST /api/auth/user/login    – Login as an end-user
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const SALT_ROUNDS = 10;

// ── Organisation registration ──────────────────────────────────────────────
router.post('/org/register', (req, res) => {
  const { orgName, name, email, password } = req.body;
  if (!orgName || !name || !email || !password) {
    return res.status(400).json({ error: 'orgName, name, email and password are required' });
  }

  // Check org email not taken
  const existing = db.prepare('SELECT id FROM organizations WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const orgId = uuidv4();
  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  db.prepare(`INSERT INTO organizations (id, name, email, password_hash) VALUES (?,?,?,?)`)
    .run(orgId, orgName, email, passwordHash);

  db.prepare(`INSERT INTO org_users (id, org_id, name, email, password_hash, role) VALUES (?,?,?,?,?,'admin')`)
    .run(userId, orgId, name, email, passwordHash);

  const token = jwt.sign({ sub: userId, orgId, role: 'admin', type: 'org_user' }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, orgId, userId, role: 'admin' });
});

// ── Organisation user login ────────────────────────────────────────────────
router.post('/org/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM org_users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, orgId: user.org_id, role: user.role, type: 'org_user' }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, orgId: user.org_id, userId: user.id, role: user.role });
});

// ── End-user registration (mailbox owners) ────────────────────────────────
router.post('/user/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const existing = db.prepare('SELECT id FROM end_users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  db.prepare('INSERT INTO end_users (id, email, password_hash) VALUES (?,?,?)').run(id, email, passwordHash);

  const token = jwt.sign({ sub: id, type: 'end_user' }, JWT_SECRET, { expiresIn: '30d' });
  return res.status(201).json({ token, userId: id });
});

// ── End-user login ────────────────────────────────────────────────────────
router.post('/user/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM end_users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, type: 'end_user' }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({ token, userId: user.id });
});

export default router;
