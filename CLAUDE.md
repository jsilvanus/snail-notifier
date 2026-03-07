# Snail-Notifier — CLAUDE.md

This file documents the project for AI-assisted development. It describes the architecture, the current state, and planned features.

---

## Project Overview

Snail-Notifier is a multi-tenant postal/event notification system. Organizations create **tokens** (QR/NFC codes) that, when scanned, trigger notifications to end users (e.g. a mailbox owner receives a push notification when their mail arrives).

Three components:
- **backend** — Express + SQLite REST API (port 3001)
- **admin-frontend** — React/Vite org management portal (port 5173)
- **user-pwa** — React/Vite end-user PWA (port 5174)

---

## Repository Layout

```
snail-notifier/
├── backend/
│   ├── src/
│   │   ├── index.js                  Express app, rate limiting, route mounting
│   │   ├── db/index.js               SQLite schema + initialization
│   │   ├── middleware/auth.js        JWT verification middleware
│   │   └── routes/
│   │       ├── auth.js               POST /api/auth/org/register|login, user/register|login
│   │       ├── codes.js              GET|POST|DELETE /api/codes (org-scoped)
│   │       ├── scan.js               GET /api/scan/:token (public)
│   │       ├── users.js              GET|POST|DELETE /api/users (admin only)
│   │       └── notifications.js      GET /api/notifications/vapid-key, POST|DELETE /subscribe, GET /
│   └── __tests__/api.test.js
├── admin-frontend/src/
│   └── pages/  Login, Dashboard, Codes, CreateCode, Users
├── user-pwa/src/
│   └── pages/  Login, Notifications
└── package.json  (npm workspaces root)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| API | Express.js |
| Database | SQLite 3 via better-sqlite3 (synchronous) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Push | web-push (VAPID) |
| QR | qrcode |
| Frontend | React 18 + Vite |
| PWA | vite-plugin-pwa + Workbox |
| Tests | Jest + Supertest |

---

## Current Database Schema

```sql
organizations  (id, name, email, password_hash, created_at)
org_users      (id, org_id, name, email, password_hash, role [admin|member], created_at)
codes          (id, org_id, name, type [QR|NFC], mailbox_label, contact_email,
                contact_phone, qr_data_url, scan_token, created_at)
end_users      (id, email, password_hash, push_subscription, created_at)
notifications  (id, code_id, end_user_id, method, status, sent_at)
```

Terminology note: `codes` are the tokens in the domain language below. The terms are interchangeable.

---

## Development Commands

```bash
npm install             # install all workspaces
npm run dev:backend     # backend on :3001
npm run dev:admin       # admin frontend on :5173
npm run dev:pwa         # user PWA on :5174
npm run build           # build both frontends
npm test                # Jest (in-memory SQLite, no .env needed)
```

Backend environment variables: see `backend/.env.example`.

---

## Planned Features

The sections below describe features to be built. Each section can be converted into tickets/branches as work progresses.

---

### 1. Token Consent & Privacy (GDPR-style)

**Requirement**: Adding an end user's email to a token requires their explicit consent before the token becomes active for that user.

**Flow**:
1. Org admin/user creates or edits a token and enters a target email address.
2. Backend immediately sends a **consent email** to that address with:
   - The organization name and token name.
   - A description of what data is stored (email address, notification history).
   - Accept link (signed, time-limited URL, e.g. JWT with 7-day expiry).
   - Decline link (removes the association).
3. The `token_memberships` join record is created with `status = 'pending'`.
4. The token only fires notifications for that user once `status = 'accepted'`.
5. If the user declines, the record is removed (or set to `'declined'` for audit).
6. End users can see a list of all tokens they have joined (accepted) and can manage them from the PWA.

**Schema additions**:
```sql
-- Replaces the single contact_email column on codes with a many-to-many join
token_memberships (
  id, token_id [FK codes.id], end_user_id [FK end_users.id],
  status [pending|accepted|declined], invited_at, responded_at,
  consent_token   -- signed JWT used in accept/decline links
)
```

**New API endpoints**:
- `POST /api/tokens/:id/invite` — org user invites an email; creates membership + sends consent email
- `GET  /api/consent/:consentToken/accept` — public link; sets status=accepted
- `GET  /api/consent/:consentToken/decline` — public link; sets status=declined
- `GET  /api/memberships` — authenticated end-user lists their token memberships
- `DELETE /api/memberships/:id` — end-user removes themselves from a token

---

### 2. Token Types

Two distinct token types (extend the existing `type` column or add a `behavior` column).

#### 2a. Simple Notification Token (existing, keep as-is)
Scanning triggers a push/email/SMS to all accepted members. No user input required at scan time.

#### 2b. Data-Input Token
Scanning opens a web form that asks the scanner for one or more input fields (e.g. "What is your name?"). On submit the backend sends a **personalised** notification to the token's members, e.g.:

> "Alice wanted to notify you."

**Schema additions**:
```sql
token_input_fields (
  id, token_id, label, placeholder, field_type [text|number|select],
  options_json,   -- for select fields: JSON array of strings
  required, sort_order
)
```

Scan flow for data-input tokens:
1. `GET /api/scan/:scanToken` returns `{ type: 'data_input', fields: [...] }` instead of triggering immediately.
2. Frontend (a public scan page, not the PWA) renders the form.
3. `POST /api/scan/:scanToken` with `{ responses: { fieldId: value } }` triggers notifications with interpolated values.

---

### 3. Notification Channels

Each channel is implemented as a pluggable delivery adapter in the backend.

| Channel | Status | Notes |
|---|---|---|
| **PWA (Web Push)** | Existing | via VAPID / web-push |
| **Email** | To build | Use nodemailer + configurable SMTP or transactional provider (e.g. Resend, SendGrid). Required for consent emails (above). |
| **SMS** | To build | via Twilio or AWS SNS. Requires phone number on end-user profile. |
| **WhatsApp** | Consider | via Twilio WhatsApp API or Meta Cloud API. Same phone-number field as SMS. |
| **Telegram** | Consider | via Telegram Bot API. User links their Telegram chat_id. |
| **Slack** | Consider | via Slack incoming webhooks. Useful for org-internal tokens. |

**Per-token, per-user channel preferences**:

```sql
member_channel_prefs (
  id, membership_id [FK token_memberships.id],
  channel [push|email|sms|whatsapp|telegram|slack],
  enabled BOOLEAN DEFAULT true
)
```

End users configure their preferred channels per token in the PWA. The notification dispatcher iterates `member_channel_prefs` and dispatches to each enabled channel.

End users must also store contact details per channel:
```sql
end_user_channels (
  id, end_user_id, channel, value,  -- e.g. channel=sms, value=+15551234567
  verified BOOLEAN DEFAULT false
)
```
Phone numbers and other channels should be verified (OTP/link) before use.

---

### 4. End-User Token Controls

All controlled from the user PWA under "My Tokens":

| Control | Behaviour |
|---|---|
| **Disable token** | Set `token_memberships.paused = true`. No notifications sent while paused. |
| **Vacation / delay mode** | `token_memberships.vacation_until DATETIME`. Notifications are queued (stored but not dispatched) until the date passes. User can view the backlog on return. |
| **View notifications in-app** | Already partially built (polling endpoint). Extend to show per-token history and queued/delayed items. |
| **Remove from token** | `DELETE /api/memberships/:id`. Hard-removes the user from the token; org is notified. |

**Schema additions to `token_memberships`**:
```sql
paused          BOOLEAN DEFAULT false,
vacation_until  DATETIME NULL
```

**Notification queue** (for delayed delivery):
```sql
notification_queue (
  id, membership_id, payload_json, scheduled_for DATETIME, dispatched_at DATETIME NULL
)
```
A background worker (e.g. `setInterval` or a cron job) checks `notification_queue` for rows where `scheduled_for <= now AND dispatched_at IS NULL` and dispatches them.

---

## Implementation Order (Suggested)

1. **Email infrastructure** — required as a foundation for consent emails and as a notification channel.
2. **Token consent / membership model** — privacy-first, so this should ship before any new channel work.
3. **End-user channel management** — add phone/Telegram fields to end-user profile.
4. **SMS + WhatsApp adapters**.
5. **Per-token channel preferences UI** in the PWA.
6. **Data-input token type** — scan page + interpolated notifications.
7. **Vacation mode + notification queue** — background worker + PWA controls.
8. **Additional channels** (Telegram, Slack) as stretch goals.

---

## Code Conventions

- Backend routes follow the pattern in `backend/src/routes/`. Each new route group gets its own file.
- Database migrations: add new `CREATE TABLE IF NOT EXISTS` statements to `backend/src/db/index.js` alongside the existing schema. Use `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for additive changes.
- Tests live in `backend/src/__tests__/`. New routes should have corresponding test coverage.
- Frontend API calls go through the `api.js` helper in each frontend package.
- JWT secrets and external API keys go in `.env` (never committed). Add new keys to `.env.example` with placeholder values.

---

## Security Notes

- Consent tokens (accept/decline links) must be short-lived JWTs signed with a separate secret, or HMAC-signed URL parameters — not guessable IDs.
- Phone numbers and alternative channel addresses must be verified before notifications are sent to them (prevents using the system to spam third parties).
- Org users can only invite users to tokens belonging to their own organization.
- End users can only read/modify their own memberships.
