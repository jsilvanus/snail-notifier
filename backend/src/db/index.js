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
    mailbox_label   TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    qr_data_url     TEXT,
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
    sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_layouts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    share_code  TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    template    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_queue (
    id          TEXT PRIMARY KEY,
    code_id     TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
    channel     TEXT NOT NULL,
    target      TEXT NOT NULL,
    layout_id   INTEGER REFERENCES notification_layouts(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    payload     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at     TEXT
  );
`);

export default db;
