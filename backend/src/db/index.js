import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/snail.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS org_users (
    id          TEXT PRIMARY KEY,
    org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS codes (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('QR','NFC')),
    behavior        TEXT NOT NULL DEFAULT 'simple' CHECK(behavior IN ('simple','data_input')),
    mailbox_label   TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    qr_data_url     TEXT,
    title           TEXT,
    description     TEXT,
    notification_message TEXT,
    scan_token      TEXT UNIQUE NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS end_users (
    id                TEXT PRIMARY KEY,
    email             TEXT UNIQUE NOT NULL,
    password_hash     TEXT NOT NULL,
    push_subscription TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    code_id     TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    end_user_id TEXT REFERENCES end_users(id) ON DELETE SET NULL,
    method      TEXT NOT NULL DEFAULT 'push',
    status      TEXT NOT NULL DEFAULT 'sent',
    payload_json TEXT,
    sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS token_memberships (
    id            TEXT PRIMARY KEY,
    token_id      TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    end_user_id   TEXT NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
    paused        INTEGER NOT NULL DEFAULT 0,
    vacation_until TEXT,
    invited_at    TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at  TEXT,
    consent_token TEXT UNIQUE NOT NULL,
    UNIQUE(token_id, end_user_id)
  );

  CREATE TABLE IF NOT EXISTS token_input_fields (
    id           TEXT PRIMARY KEY,
    token_id     TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    placeholder  TEXT,
    field_type   TEXT NOT NULL DEFAULT 'text' CHECK(field_type IN ('text','number','select')),
    options_json TEXT,
    required     INTEGER NOT NULL DEFAULT 1,
    sort_order   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS member_channel_prefs (
    id            TEXT PRIMARY KEY,
    membership_id TEXT NOT NULL REFERENCES token_memberships(id) ON DELETE CASCADE,
    channel       TEXT NOT NULL CHECK(channel IN ('push','email','sms','whatsapp','telegram','slack','teams')),
    enabled       INTEGER NOT NULL DEFAULT 1,
    UNIQUE(membership_id, channel)
  );

  CREATE TABLE IF NOT EXISTS end_user_channels (
    id          TEXT PRIMARY KEY,
    end_user_id TEXT NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL CHECK(channel IN ('sms','whatsapp','telegram','slack','teams')),
    value       TEXT NOT NULL,
    verified    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(end_user_id, channel)
  );

  CREATE TABLE IF NOT EXISTS token_channel_messages (
    id           TEXT PRIMARY KEY,
    token_id     TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    channel      TEXT NOT NULL,
    message_template TEXT NOT NULL,
    UNIQUE(token_id, channel)
  );

  CREATE TABLE IF NOT EXISTS notifier_layouts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    share_code  TEXT UNIQUE NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS layout_buttons (
    id                TEXT PRIMARY KEY,
    layout_id         TEXT NOT NULL REFERENCES notifier_layouts(id) ON DELETE CASCADE,
    button_type       TEXT NOT NULL DEFAULT 'token' CHECK(button_type IN ('token','layout')),
    label             TEXT,
    color             TEXT DEFAULT '#dbeafe',
    scan_token        TEXT,
    target_layout_id  TEXT REFERENCES notifier_layouts(id) ON DELETE SET NULL,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_queue (
    id             TEXT PRIMARY KEY,
    membership_id  TEXT NOT NULL REFERENCES token_memberships(id) ON DELETE CASCADE,
    payload_json   TEXT NOT NULL,
    scheduled_for  TEXT NOT NULL,
    dispatched_at  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
