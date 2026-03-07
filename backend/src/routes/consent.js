/**
 * Token consent / membership routes.
 *
 * POST   /api/tokens/:id/invite             — Org user invites an email to a token
 * GET    /api/consent/:consentToken/accept  — Public: user accepts invitation
 * GET    /api/consent/:consentToken/decline — Public: user declines invitation
 * GET    /api/memberships                   — End-user lists their token memberships
 * PATCH  /api/memberships/:id              — End-user updates paused / vacation_until
 * DELETE /api/memberships/:id              — End-user removes themselves from a token
 * GET    /api/memberships/:id/channels     — Get channel prefs for a membership
 * PUT    /api/memberships/:id/channels     — Set channel prefs for a membership
 * GET    /api/users/me/channels            — Get end-user's contact details per channel
 * PUT    /api/users/me/channels            — Upsert a contact detail
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import auth from '../middleware/auth.js';
import { sendConsentEmail } from '../services/email.js';

const router = express.Router();
const CONSENT_SECRET = process.env.CONSENT_JWT_SECRET || process.env.JWT_SECRET || 'dev_secret';
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:3001';
const USER_PWA_URL = process.env.USER_PWA_URL || 'http://localhost:5174';

// ── Org: invite an email to a token ─────────────────────────────────────────

router.post('/tokens/:id/invite', auth, async (req, res) => {
  if (req.user.type !== 'org_user') return res.status(403).json({ error: 'Forbidden' });

  const code = db.prepare('SELECT * FROM codes WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (!code) return res.status(404).json({ error: 'Token not found' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  // Find or auto-create end_user row (they may not have registered yet)
  let endUser = db.prepare('SELECT * FROM end_users WHERE email = ?').get(email);
  if (!endUser) {
    const newId = uuidv4();
    db.prepare(`INSERT INTO end_users (id, email, password_hash) VALUES (?, ?, ?)`)
      .run(newId, email, '');  // empty password_hash; user must register to log in
    endUser = db.prepare('SELECT * FROM end_users WHERE id = ?').get(newId);
  }

  // Check for existing membership
  const existing = db.prepare('SELECT * FROM token_memberships WHERE token_id = ? AND end_user_id = ?')
    .get(code.id, endUser.id);
  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'User is already a member of this token' });
    if (existing.status === 'pending') return res.status(409).json({ error: 'Invitation already pending for this user' });
    // declined: allow re-invite by deleting old record
    db.prepare('DELETE FROM token_memberships WHERE id = ?').run(existing.id);
  }

  const membershipId = uuidv4();
  const consentToken = jwt.sign(
    { membershipId, tokenId: code.id, endUserId: endUser.id },
    CONSENT_SECRET,
    { expiresIn: '7d' },
  );

  db.prepare(`
    INSERT INTO token_memberships (id, token_id, end_user_id, status, consent_token)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(membershipId, code.id, endUser.id, consentToken);

  const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(req.user.orgId);
  const acceptUrl = `${PUBLIC_URL}/api/consent/${consentToken}/accept`;
  const declineUrl = `${PUBLIC_URL}/api/consent/${consentToken}/decline`;

  try {
    await sendConsentEmail({
      toEmail: email,
      orgName: org.name,
      tokenName: code.name,
      acceptUrl,
      declineUrl,
    });
  } catch (err) {
    console.error('Failed to send consent email:', err.message);
    // Don't fail the request — the membership record is created
  }

  return res.status(201).json({ membershipId, status: 'pending', email });
});

// ── Public: accept consent ───────────────────────────────────────────────────

router.get('/consent/:consentToken/accept', (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.consentToken, CONSENT_SECRET);
  } catch {
    return res.status(400).send('<h2>This link has expired or is invalid.</h2>');
  }

  const membership = db.prepare('SELECT * FROM token_memberships WHERE id = ?').get(payload.membershipId);
  if (!membership) return res.status(404).send('<h2>Invitation not found.</h2>');

  db.prepare(`
    UPDATE token_memberships
    SET status = 'accepted', responded_at = datetime('now')
    WHERE id = ?
  `).run(membership.id);

  // Seed default channel prefs (push + email enabled by default)
  for (const channel of ['push', 'email']) {
    db.prepare(`
      INSERT OR IGNORE INTO member_channel_prefs (id, membership_id, channel, enabled)
      VALUES (?, ?, ?, 1)
    `).run(uuidv4(), membership.id, channel);
  }

  return res.send(`
    <html><body style="font-family:sans-serif;max-width:500px;margin:4rem auto;text-align:center">
      <h2 style="color:#16a34a">✅ Notifications activated</h2>
      <p>You will now receive notifications when your mail arrives.</p>
      <p><a href="${USER_PWA_URL}/tokens">Manage your tokens</a></p>
    </body></html>
  `);
});

// ── Public: decline consent ──────────────────────────────────────────────────

router.get('/consent/:consentToken/decline', (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.consentToken, CONSENT_SECRET);
  } catch {
    return res.status(400).send('<h2>This link has expired or is invalid.</h2>');
  }

  const membership = db.prepare('SELECT * FROM token_memberships WHERE id = ?').get(payload.membershipId);
  if (!membership) return res.status(404).send('<h2>Invitation not found.</h2>');

  db.prepare(`
    UPDATE token_memberships
    SET status = 'declined', responded_at = datetime('now')
    WHERE id = ?
  `).run(membership.id);

  return res.send(`
    <html><body style="font-family:sans-serif;max-width:500px;margin:4rem auto;text-align:center">
      <h2>Invitation declined</h2>
      <p>Your email address has been removed from this notification list.</p>
    </body></html>
  `);
});

// ── End-user: list memberships ───────────────────────────────────────────────

router.get('/memberships', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const rows = db.prepare(`
    SELECT tm.id, tm.status, tm.paused, tm.vacation_until, tm.invited_at, tm.responded_at,
           c.id AS token_id, c.name AS token_name, c.mailbox_label, c.type AS token_type,
           c.behavior,
           o.name AS org_name
    FROM token_memberships tm
    JOIN codes c ON c.id = tm.token_id
    JOIN organizations o ON o.id = c.org_id
    WHERE tm.end_user_id = ?
      AND tm.status IN ('pending', 'accepted')
    ORDER BY tm.invited_at DESC
  `).all(req.user.sub);

  return res.json(rows);
});

// ── End-user: update pause / vacation ────────────────────────────────────────

router.patch('/memberships/:id', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const membership = db.prepare('SELECT * FROM token_memberships WHERE id = ? AND end_user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const { paused, vacation_until } = req.body;
  const updates = [];
  const params = [];

  if (typeof paused === 'boolean') { updates.push('paused = ?'); params.push(paused ? 1 : 0); }
  if (vacation_until !== undefined) { updates.push('vacation_until = ?'); params.push(vacation_until || null); }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  params.push(membership.id);
  db.prepare(`UPDATE token_memberships SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return res.json({ success: true });
});

// ── End-user: remove themselves from a token ─────────────────────────────────

router.delete('/memberships/:id', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const result = db.prepare('DELETE FROM token_memberships WHERE id = ? AND end_user_id = ?')
    .run(req.params.id, req.user.sub);
  if (result.changes === 0) return res.status(404).json({ error: 'Membership not found' });

  return res.json({ success: true });
});

// ── End-user: channel prefs for a membership ─────────────────────────────────

router.get('/memberships/:id/channels', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const membership = db.prepare('SELECT * FROM token_memberships WHERE id = ? AND end_user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const prefs = db.prepare('SELECT channel, enabled FROM member_channel_prefs WHERE membership_id = ?')
    .all(membership.id);

  return res.json(prefs);
});

router.put('/memberships/:id/channels', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const membership = db.prepare('SELECT * FROM token_memberships WHERE id = ? AND end_user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!membership) return res.status(404).json({ error: 'Membership not found' });

  const { channels } = req.body; // [{ channel: 'push', enabled: true }, ...]
  if (!Array.isArray(channels)) return res.status(400).json({ error: 'channels must be an array' });

  const allowed = ['push', 'email', 'sms', 'whatsapp', 'telegram', 'slack'];

  for (const pref of channels) {
    if (!allowed.includes(pref.channel)) continue;
    db.prepare(`
      INSERT INTO member_channel_prefs (id, membership_id, channel, enabled)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(membership_id, channel) DO UPDATE SET enabled = excluded.enabled
    `).run(uuidv4(), membership.id, pref.channel, pref.enabled ? 1 : 0);
  }

  return res.json({ success: true });
});

// ── End-user: contact info per channel ───────────────────────────────────────

router.get('/users/me/channels', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const rows = db.prepare('SELECT channel, value, verified FROM end_user_channels WHERE end_user_id = ?')
    .all(req.user.sub);
  return res.json(rows);
});

router.put('/users/me/channels', auth, (req, res) => {
  if (req.user.type !== 'end_user') return res.status(403).json({ error: 'Forbidden' });

  const { channel, value } = req.body;
  const allowed = ['sms', 'whatsapp', 'telegram', 'slack'];
  if (!allowed.includes(channel)) return res.status(400).json({ error: `channel must be one of: ${allowed.join(', ')}` });
  if (!value) return res.status(400).json({ error: 'value is required' });

  db.prepare(`
    INSERT INTO end_user_channels (id, end_user_id, channel, value, verified)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(end_user_id, channel) DO UPDATE SET value = excluded.value, verified = 0
  `).run(uuidv4(), req.user.sub, channel, value);

  // TODO: trigger OTP verification flow here before marking verified
  return res.json({ success: true, verified: false, note: 'Verification pending — OTP flow not yet implemented' });
});

export default router;
