'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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

  -- Many-to-many join: which end_users are members of which tokens, with consent status
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

  -- Input fields for data_input tokens
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

  -- Per-membership channel preferences (which channels are enabled for a user on a token)
  CREATE TABLE IF NOT EXISTS member_channel_prefs (
    id            TEXT PRIMARY KEY,
    membership_id TEXT NOT NULL REFERENCES token_memberships(id) ON DELETE CASCADE,
    channel       TEXT NOT NULL CHECK(channel IN ('push','email','sms','whatsapp','telegram','slack','teams')),
    enabled       INTEGER NOT NULL DEFAULT 1,
    UNIQUE(membership_id, channel)
  );

  -- Per-user channel contact info (e.g. phone number for SMS, telegram chat_id)
  CREATE TABLE IF NOT EXISTS end_user_channels (
    id          TEXT PRIMARY KEY,
    end_user_id TEXT NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL CHECK(channel IN ('sms','whatsapp','telegram','slack','teams')),
    value       TEXT NOT NULL,
    verified    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(end_user_id, channel)
  );


  -- Per-channel message templates for a token (overrides default notification_message)
  CREATE TABLE IF NOT EXISTS token_channel_messages (
    id           TEXT PRIMARY KEY,
    token_id     TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    channel      TEXT NOT NULL,
    message_template TEXT NOT NULL,
    UNIQUE(token_id, channel)
  );
  -- Delayed/queued notifications (for vacation mode)
  CREATE TABLE IF NOT EXISTS notification_queue (
    id             TEXT PRIMARY KEY,
    membership_id  TEXT NOT NULL REFERENCES token_memberships(id) ON DELETE CASCADE,
    payload_json   TEXT NOT NULL,
    scheduled_for  TEXT NOT NULL,
    dispatched_at  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
