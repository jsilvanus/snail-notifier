# Snail Notifier 📬

A multi-tenant postal mail notification system. When a mail carrier scans a QR or NFC code attached to a physical mailbox, the mailbox owner is instantly notified on their phone via a Progressive Web App.

## Architecture

```
snail-notifier/
├── backend/          Express + SQLite REST API
├── admin-frontend/   Vite + React – Organisation admin portal
└── user-pwa/         Vite + React PWA – End-user notification app
```

## How It Works

1. **Organisation registers** on the admin portal and creates QR / NFC codes for each mailbox they manage.
2. Each code stores the **mailbox owner's contact email** and generates a unique **scan URL**.
3. A **mail carrier scans** the QR code (phone camera) or NFC tag — this hits `GET /api/scan/:token`.
4. The backend looks up the mailbox owner's **push subscription** and sends a **Web Push notification**.
5. The **mailbox owner** receives an instant notification on their phone: *"You have physical mail! 📬"*

## Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 8

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# Fill in VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
# Set PUBLIC_URL to your server's base URL (e.g. https://api.yourdomain.com)
# Set USER_PWA_URL to your PWA's URL (e.g. https://notify.yourdomain.com)
```

### 3. Install and run

```bash
# From repo root
npm install            # installs all workspace deps

# In three terminals:
npm run dev:backend    # http://localhost:3001
npm run dev:admin      # http://localhost:5173  (admin portal)
npm run dev:pwa        # http://localhost:5174  (user PWA)
```

### 4. Build for production

```bash
npm run build          # builds admin-frontend and user-pwa
```

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/org/register` | — | Register organisation + first admin |
| POST | `/api/auth/org/login` | — | Login as org user |
| POST | `/api/auth/user/register` | — | Register end-user (mailbox owner) |
| POST | `/api/auth/user/login` | — | Login as end-user |
| GET | `/api/codes` | org JWT | List org codes |
| POST | `/api/codes` | org JWT | Create QR/NFC code |
| DELETE | `/api/codes/:id` | org JWT | Delete code |
| GET | `/api/codes/:id/qr` | org JWT | Download QR PNG |
| GET | `/api/users` | org JWT | List org team members |
| POST | `/api/users` | org JWT (admin) | Add team member |
| DELETE | `/api/users/:id` | org JWT (admin) | Remove team member |
| GET | `/api/scan/:token` | — | Scan endpoint (mail carrier) |
| GET | `/api/notifications/vapid-key` | — | VAPID public key |
| POST | `/api/notifications/subscribe` | user JWT | Save push subscription |
| DELETE | `/api/notifications/subscribe` | user JWT | Remove push subscription |
| GET | `/api/notifications` | user JWT | List notifications (polling) |

## Running Tests

```bash
npm test
```

## Data Model

- **organizations** – multi-tenant root
- **org_users** – admin/member users belonging to an org
- **codes** – QR or NFC codes per org, each with a unique scan token and mailbox owner contact info
- **end_users** – mailbox owners who register on the PWA to receive notifications
- **notifications** – log of every scan and push notification sent

## PWA Features

- **Install to home screen** (standalone display mode)
- **Web Push Notifications** via service worker (when VAPID keys are configured)
- **Polling fallback** – the app polls `/api/notifications` every 30 seconds as a fallback
- Fully offline-capable for previously loaded pages (Workbox precache)
