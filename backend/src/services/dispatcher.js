'use strict';

/**
 * Notification dispatcher.
 * Channels: push | email | sms | whatsapp | telegram | slack | teams
 * Per-channel message templates stored in token_channel_messages.
 * Template syntax: use {FIELDLABEL} to interpolate form responses, e.g. "{name} wants to contact you."
 */

const db = require('../db');
const { sendPushNotification } = require('../routes/notifications');
const { sendNotificationEmail } = require('./email');
const { sendSms } = require('../channels/sms');
const { sendWhatsApp } = require('../channels/whatsapp');
const { sendTelegram } = require('../channels/telegram');
const { sendSlack } = require('../channels/slack');
const { sendTeams } = require('../channels/teams');
const { v4: uuidv4 } = require('uuid');

/**
 * Resolve the notification message for a channel, using:
 * 1. token_channel_messages override for that channel
 * 2. code.notification_message default
 * 3. Built-in fallback
 * Interpolates {fieldLabel} tokens with responses values.
 */
function resolveMessage(code, channel, responses) {
  const override = db.prepare('SELECT message_template FROM token_channel_messages WHERE token_id = ? AND channel = ?')
    .get(code.id, channel);
  const general = db.prepare('SELECT message_template FROM token_channel_messages WHERE token_id = ? AND channel = ?')
    .get(code.id, 'general');

  let template = override?.message_template
    || general?.message_template
    || code.notification_message
    || null;

  if (!template) {
    if (responses && Object.keys(responses).length > 0) {
      const parts = Object.values(responses).filter(Boolean).join(', ');
      return parts ? `${parts} wanted to notify you.` : `You have a notification from ${code.mailbox_label || code.name}.`;
    }
    return `${code.mailbox_label || 'Your mailbox'} has mail waiting for you. Please collect it.`;
  }

  // Interpolate {key} placeholders from responses
  if (responses) {
    for (const [key, value] of Object.entries(responses)) {
      // responses keyed by fieldId — try to find label for user-friendly substitution
      const field = db.prepare('SELECT label FROM token_input_fields WHERE id = ?').get(key);
      const placeholder = field ? field.label.toUpperCase() : key.toUpperCase();
      template = template.replace(new RegExp(`\\{${placeholder}\\}`, 'gi'), value || '');
      // Also allow raw key substitution
      template = template.replace(new RegExp(`\\{${key}\\}`, 'gi'), value || '');
    }
  }

  return template;
}

function buildPayload(code, channel, responses) {
  const title = code.title || `Notification from ${code.mailbox_label || code.name}`;
  const body = resolveMessage(code, channel, responses);
  const url = process.env.USER_PWA_URL || 'http://localhost:5174';
  return { title, body, url };
}

/**
 * Dispatch a notification to one membership, respecting paused/vacation state.
 */
async function dispatchToMembership(membership, _legacyPayload, code, responses) {
  if (membership.status !== 'accepted') return;
  if (membership.paused) return;

  // Vacation mode: queue for later
  if (membership.vacation_until && new Date(membership.vacation_until) > new Date()) {
    db.prepare(`
      INSERT INTO notification_queue (id, membership_id, payload_json, scheduled_for)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), membership.id, JSON.stringify({ responses, codeId: code.id }), membership.vacation_until);
    return;
  }

  const endUser = db.prepare('SELECT * FROM end_users WHERE id = ?').get(membership.end_user_id);
  if (!endUser) return;

  const prefs = db.prepare('SELECT channel, enabled FROM member_channel_prefs WHERE membership_id = ?')
    .all(membership.id);
  const enabledChannels = prefs.length > 0
    ? prefs.filter(p => p.enabled).map(p => p.channel)
    : ['push', 'email'];

  const results = [];

  for (const channel of enabledChannels) {
    const payload = buildPayload(code, channel, responses);
    const notifId = uuidv4();
    let status = 'sent';
    try {
      await dispatchChannel(channel, endUser, payload, code);
    } catch {
      status = 'failed';
    }
    db.prepare(`
      INSERT INTO notifications (id, code_id, end_user_id, method, status, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(notifId, code.id, endUser.id, channel, status, JSON.stringify(payload));
    results.push({ channel, status });
  }

  return results;
}

async function dispatchChannel(channel, endUser, payload, _code) {
  switch (channel) {
    case 'push': {
      if (!endUser.push_subscription) throw new Error('no_subscription');
      await sendPushNotification(JSON.parse(endUser.push_subscription), payload);
      break;
    }
    case 'email': {
      await sendNotificationEmail({ toEmail: endUser.email, subject: payload.title, body: payload.body });
      break;
    }
    case 'sms': {
      const ch = db.prepare("SELECT value FROM end_user_channels WHERE end_user_id = ? AND channel = 'sms' AND verified = 1").get(endUser.id);
      if (!ch) throw new Error('no_sms');
      await sendSms(ch.value, payload.body);
      break;
    }
    case 'whatsapp': {
      const ch = db.prepare("SELECT value FROM end_user_channels WHERE end_user_id = ? AND channel = 'whatsapp' AND verified = 1").get(endUser.id);
      if (!ch) throw new Error('no_whatsapp');
      await sendWhatsApp(ch.value, payload.body);
      break;
    }
    case 'telegram': {
      const ch = db.prepare("SELECT value FROM end_user_channels WHERE end_user_id = ? AND channel = 'telegram' AND verified = 1").get(endUser.id);
      if (!ch) throw new Error('no_telegram');
      await sendTelegram(ch.value, payload.body);
      break;
    }
    case 'slack': {
      const ch = db.prepare("SELECT value FROM end_user_channels WHERE end_user_id = ? AND channel = 'slack' AND verified = 1").get(endUser.id);
      if (!ch) throw new Error('no_slack');
      await sendSlack(ch.value, payload.body);
      break;
    }
    case 'teams': {
      const ch = db.prepare("SELECT value FROM end_user_channels WHERE end_user_id = ? AND channel = 'teams' AND verified = 1").get(endUser.id);
      if (!ch) throw new Error('no_teams');
      await sendTeams(ch.value, payload.title, payload.body);
      break;
    }
    default:
      throw new Error(`unknown channel: ${channel}`);
  }
}

// ── Background queue worker ──────────────────────────────────────────────────

async function flushNotificationQueue() {
  const due = db.prepare(`
    SELECT nq.*, tm.end_user_id, tm.status AS membership_status,
           tm.paused, tm.vacation_until, tm.id AS membership_id
    FROM notification_queue nq
    JOIN token_memberships tm ON tm.id = nq.membership_id
    WHERE nq.dispatched_at IS NULL AND nq.scheduled_for <= datetime('now')
  `).all();

  for (const row of due) {
    const { responses, codeId } = JSON.parse(row.payload_json);
    const code = db.prepare('SELECT * FROM codes WHERE id = ?').get(codeId);
    if (!code) continue;
    const endUser = db.prepare('SELECT * FROM end_users WHERE id = ?').get(row.end_user_id);
    if (!endUser) continue;

    const prefs = db.prepare('SELECT channel, enabled FROM member_channel_prefs WHERE membership_id = ?').all(row.membership_id);
    const enabledChannels = prefs.length > 0 ? prefs.filter(p => p.enabled).map(p => p.channel) : ['push', 'email'];

    for (const channel of enabledChannels) {
      const payload = buildPayload(code, channel, responses);
      const notifId = uuidv4();
      let status = 'sent';
      try { await dispatchChannel(channel, endUser, payload, code); } catch { status = 'failed'; }
      db.prepare('INSERT INTO notifications (id, code_id, end_user_id, method, status, payload_json) VALUES (?,?,?,?,?,?)')
        .run(notifId, code.id, endUser.id, channel, status, JSON.stringify(payload));
    }
    db.prepare("UPDATE notification_queue SET dispatched_at = datetime('now') WHERE id = ?").run(row.id);
  }
}

module.exports = { dispatchToMembership, flushNotificationQueue };
