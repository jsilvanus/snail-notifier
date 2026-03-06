/**
 * Notification dispatcher.
 *
 * Reads pending rows from notification_queue and dispatches them via the
 * appropriate channel adapter (sms, whatsapp, telegram, slack, teams).
 *
 * Channel adapters live in src/channels/ — one file per channel — so adding
 * a new channel only requires dropping a new file there and registering it in
 * the ADAPTERS map below.
 */

import { v4 as uuidv4 } from 'uuid';
import db from './db/index.js';
import * as sms from './channels/sms.js';
import * as whatsapp from './channels/whatsapp.js';
import * as telegram from './channels/telegram.js';
import * as slack from './channels/slack.js';
import * as teams from './channels/teams.js';

/** Map channel name → adapter module */
const ADAPTERS = {
  sms,
  whatsapp,
  telegram,
  slack,
  teams,
};

/**
 * Process all pending notifications from the queue.
 * Called on a regular interval from index.js (when running as main module).
 */
export async function flushNotificationQueue() {
  const pending = db.prepare(
    "SELECT * FROM notification_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50",
  ).all();

  for (const row of pending) {
    const adapter = ADAPTERS[row.channel];
    if (!adapter) {
      db.prepare("UPDATE notification_queue SET status = 'error', sent_at = datetime('now') WHERE id = ?")
        .run(row.id);
      console.warn(`[dispatcher] Unknown channel "${row.channel}" for queue entry ${row.id}`);
      continue;
    }

    try {
      const payload = row.payload ? JSON.parse(row.payload) : {};
      await adapter.send(row.target, payload.message ?? '', payload.title);
      db.prepare("UPDATE notification_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?")
        .run(row.id);
    } catch (err) {
      db.prepare("UPDATE notification_queue SET status = 'error', sent_at = datetime('now') WHERE id = ?")
        .run(row.id);
      console.error(`[dispatcher] Failed to send via ${row.channel} for entry ${row.id}:`, err.message);
    }
  }
}

/**
 * Enqueue a notification to be dispatched via the given channel.
 * @param {string} codeId     – ID of the triggering code
 * @param {string} channel    – 'sms' | 'whatsapp' | 'telegram' | 'slack' | 'teams'
 * @param {string} target     – Phone number, chat ID, or webhook URL
 * @param {object} payload    – { message, title? }
 * @param {number} [layoutId] – Optional FK to notification_layouts
 * @returns {string}          – Queue entry ID (UUID)
 */
export function enqueue(codeId, channel, target, payload, layoutId = null) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO notification_queue (id, code_id, channel, target, layout_id, status, payload) VALUES (?,?,?,?,?,?,?)',
  ).run(id, codeId, channel, target, layoutId, 'pending', JSON.stringify(payload));
  return id;
}
