'use strict';

/**
 * Notification dispatcher.
 * Given a membership and a payload, dispatches to all enabled channels.
 * Channels: push | email | sms | whatsapp | telegram | slack
 */

const db = require('../db');
const { sendPushNotification } = require('../routes/notifications');
const { sendNotificationEmail } = require('./email');
const { v4: uuidv4 } = require('uuid');

/**
 * Dispatch a notification to one membership, respecting paused/vacation state.
 * If the membership is on vacation, queues the notification for later delivery.
 *
 * @param {object} membership   Row from token_memberships (with end_user joined)
 * @param {object} payload      { title, body, url }
 * @param {object} code         Row from codes
 */
async function dispatchToMembership(membership, payload, code) {
  if (membership.status !== 'accepted') return;
  if (membership.paused) return;

  // Vacation mode: queue for later
  if (membership.vacation_until && new Date(membership.vacation_until) > new Date()) {
    db.prepare(`
      INSERT INTO notification_queue (id, membership_id, payload_json, scheduled_for)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), membership.id, JSON.stringify({ payload, codeId: code.id }), membership.vacation_until);
    return;
  }

  const endUser = db.prepare('SELECT * FROM end_users WHERE id = ?').get(membership.end_user_id);
  if (!endUser) return;

  // Get enabled channels for this membership (default to push + email if no prefs set)
  const prefs = db.prepare('SELECT channel, enabled FROM member_channel_prefs WHERE membership_id = ?')
    .all(membership.id);

  const enabledChannels = prefs.length > 0
    ? prefs.filter(p => p.enabled).map(p => p.channel)
    : ['push', 'email']; // default channels before user configures prefs

  const results = [];

  for (const channel of enabledChannels) {
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
      await sendNotificationEmail({
        toEmail: endUser.email,
        subject: payload.title,
        body: payload.body,
      });
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
    default:
      throw new Error(`unknown channel: ${channel}`);
  }
}

// ── Channel adapters ─────────────────────────────────────────────────────────

async function sendSms(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[sms stub] To: ${to} | Body: ${body}`);
    return;
  }
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({ body, from: process.env.TWILIO_PHONE_FROM, to });
}

async function sendWhatsApp(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[whatsapp stub] To: ${to} | Body: ${body}`);
    return;
  }
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({ body, from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, to: `whatsapp:${to}` });
}

async function sendTelegram(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log(`[telegram stub] Chat: ${chatId} | Text: ${text}`);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`);
}

async function sendSlack(webhookUrl, text) {
  if (!webhookUrl) {
    console.log(`[slack stub] Text: ${text}`);
    return;
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
}

// ── Background queue worker ──────────────────────────────────────────────────

/**
 * Called on an interval. Dispatches any queued notifications whose scheduled_for has passed.
 */
async function flushNotificationQueue() {
  const due = db.prepare(`
    SELECT nq.*, tm.end_user_id, tm.status AS membership_status,
           tm.paused, tm.vacation_until, tm.id AS membership_id
    FROM notification_queue nq
    JOIN token_memberships tm ON tm.id = nq.membership_id
    WHERE nq.dispatched_at IS NULL
      AND nq.scheduled_for <= datetime('now')
  `).all();

  for (const row of due) {
    const { payload, codeId } = JSON.parse(row.payload_json);
    const code = db.prepare('SELECT * FROM codes WHERE id = ?').get(codeId);
    if (!code) continue;

    const endUser = db.prepare('SELECT * FROM end_users WHERE id = ?').get(row.end_user_id);
    if (!endUser) continue;

    const prefs = db.prepare('SELECT channel, enabled FROM member_channel_prefs WHERE membership_id = ?').all(row.membership_id);
    const enabledChannels = prefs.length > 0 ? prefs.filter(p => p.enabled).map(p => p.channel) : ['push', 'email'];

    for (const channel of enabledChannels) {
      const notifId = uuidv4();
      let status = 'sent';
      try { await dispatchChannel(channel, endUser, payload, code); } catch { status = 'failed'; }
      db.prepare(`INSERT INTO notifications (id, code_id, end_user_id, method, status, payload_json) VALUES (?,?,?,?,?,?)`)
        .run(notifId, code.id, endUser.id, channel, status, JSON.stringify(payload));
    }

    db.prepare("UPDATE notification_queue SET dispatched_at = datetime('now') WHERE id = ?").run(row.id);
  }
}

module.exports = { dispatchToMembership, flushNotificationQueue };
