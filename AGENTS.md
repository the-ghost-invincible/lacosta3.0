# AGENTS.md — Lacosta 3.0

## Project Overview

Lacosta 3.0 is a **multi-tenant e-commerce marketplace** for Kenyan university campuses. Each university gets its own isolated storefront (products, orders, site content, admin panel, payment till). Production: `lacostamarket.shop`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Vite 8, vanilla CSS |
| Backend | Node.js 22, Express 5 |
| Database | PostgreSQL (via `pg` driver) |
| Payments | **Lipana SDK** (`@lipana/sdk`) — per-university M-Pesa till accounts |
| Email | Resend API (per-university sending address) |
| Auth | scrypt password hashing, HTTP-only session cookies |
| CDN/DNS | Cloudflare (proxied, free plan) |
| Server | Hostinger VPS (Ubuntu), Nginx, PM2, Certbot (SSL) |
| Tunnel | `cloudflared` quick tunnel (backup access when ISP routing fails) |
| Testing | Vitest |
| Linting | Oxlint |

## Architecture

```
src/           → React SPA (Vite)
server/        → Express API (port 4000)
public/        → Static assets (images, uploads)
deploy/        → Deployment scripts (Nginx, PM2, Certbot)
scripts/       → Seed script (seed.js) and DB setup (setup-db.sql)
dist/          → Vite build output (production)
```

## Key Files

### Backend (`server/`)
- `index.js` — Express app, route mounting, admin sessions, middleware, rate limiters with custom `keyGenerator`
- `db.js` — PostgreSQL pool, schema init, auto-migrations
- `auth.js` — User registration, login, email verification, password reset
- `helpers.js` — Shared utilities: `hashPassword`, `verifyPassword`, `requireUser`, `getNotifyEmail`
- `payments.js` — Lipana SDK wrapper (per-university), phone normalization, webhook signature verification
- `payment-routes.js` — Payment HTTP routes (STK push, webhook, admin config)
- `orders.js` — Order placement, status updates, stock deduction/restore helpers, admin/customer email + Telegram notifications
- `cart.js` — Per-user cart CRUD
- `email.js` — Resend email service (auto display name, plain text fallback, auto reply-to)
- `telegram.js` — Telegram bot notifications per university
- `config.js` — Centralized env var config
- `seo.js` — Dynamic sitemap.xml + robots.txt
- `error-tracker.js` — Sentry error reporting

### Frontend (`src/`)
- `App.jsx` — Root component, route definitions
- `AuthContext.jsx` — Auth state + API calls context provider
- `CartContext.jsx` — Cart state + server sync context provider (user-scoped localStorage)
- `Cart.jsx` — Shopping cart + checkout + M-Pesa payment flow
- `History.jsx` — Purchase history page (user-scoped localStorage)
- `Home.jsx` — Landing page (hero, deals, catalog, trending)
- `Category.jsx` — Category browsing with subcategory menus
- `Header.jsx` — Topbar, search, category strip, mobile nav
- `admin/Admin.jsx` — Full admin dashboard (~2459 lines, tabs: Products, Customers, Orders, Payments, Featured, Categories, Subcategories, Site Content, Daily Sales)

## Payment System (Lipana)

### Per-University Architecture
Each university has its own Lipana till account. Credentials are stored in the `universities` database table:
- `lipana_api_key` — `lip_sk_live_...` or `lip_sk_test_...`
- `lipana_webhook_secret` — for HMAC signature verification
- `lipana_environment` — `sandbox` or `production`
- `lipana_till_number` — display-only for university admins

### Payment Flow
1. Customer places order → `POST /api/orders` → order created (pending)
2. Customer clicks "Pay with M-Pesa" → `POST /api/payments/mpesa/stkpush`
3. Server looks up university's Lipana API key → initializes SDK → sends STK push
4. Customer enters PIN on phone
5. Lipana fires webhook → `POST /api/payments/webhook/:universitySlug`
6. Webhook verifies signature → finds order → updates `payment_status` to `paid` → deducts stock → sends emails

### Key Routes
- `GET /api/payments/config/:university` — public payment status
- `GET /api/payments/config/:university/admin` — admin config (requires auth)
- `PUT /api/payments/config/:university` — save admin config (requires auth)
- `POST /api/payments/mpesa/stkpush` — initiate payment (requires user auth)
- `GET /api/payments/status/:checkoutRequestId` — poll payment status
- `POST /api/payments/webhook/:universitySlug` — Lipana webhook (public, signature-verified)

### Phone Format
Lipana requires `+254712345678` format. The `normalizePhone()` function in `payments.js` converts `07xx` and `254xx` formats.

## Email System

Emails are sent via Resend API. Two types:

1. **Customer emails** — order confirmations, status updates, password reset, email verification
2. **Admin notifications** — new order alerts, cancellation alerts, status change alerts (sent to `universities.notify_email`)

Email sender address: per-university `email` column in `universities` table, falls back to `EMAIL_FROM` env var.

Email deliverability features (in `email.js`):
- Auto display name: bare emails like `noreply@domain.com` get wrapped as `Lacosta <noreply@domain.com>`
- Plain text fallback: `stripHtml()` generates a text version alongside HTML
- Auto reply-to: all emails include `Reply-To` header from `ADMIN_EMAIL` env var

## Notifications

### Email Notifications
- Order placed → customer + admin
- Order status changed (confirmed/canceled/delivered) → customer + admin
- Payment confirmed → customer + admin
- Email verification, password reset → user

### Telegram Notifications
Per-university Telegram bot sends alerts for:
- New orders placed
- Payments received
- Orders canceled (by customer or admin)
- Order status changes (confirmed/delivered)

Configured via admin panel (requires super user password to save).

## Database Schema

9 tables: `users`, `sessions`, `carts`, `orders`, `products`, `universities`, `site_data`, `tokens`, `daily_sales`

Universities table columns include: `name`, `slug`, `email` (sender address), `notify_email` (admin alerts), `lipana_*` (payment), `telegram_*` (notifications).

Migrations run automatically via `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `db.js`.

## Admin Panel

Located at secret URL (`/admin-7f3k9`). Two roles:
- **Superuser** — full access to all universities, can configure payment keys
- **Sub-user** (university admin) — scoped to their university, can see till number but NOT API keys

Sensitive config (Telegram bot token, chat ID) requires super user password to save.

## Environment Variables

```
DATABASE_URL=postgres://lacosta:CHANGE_ME@localhost:5432/lacosta
PORT=4000
BASE_URL=https://lacostamarket.shop
ADMIN_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD
ADMIN_PATH=/admin-7f3k9
ADMIN_EMAIL=your@email.com
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Lacosta <noreply@yourdomain.com>
SENTRY_DSN=
```

M-Pesa/Lipana credentials are per-university in the database, NOT in `.env`.

## Deployment

### Server
- **VPS**: Hostinger (Ubuntu), IP: `72.62.132.86`
- **Process manager**: PM2 (`pm2 restart lacosta-api`)
- **Reverse proxy**: Nginx (rate limiting, SSL, gzip, static asset caching)
- **SSL**: Let's Encrypt via Certbot (auto-renew cron)
- **DNS**: Cloudflare (proxied, free plan) → Hostinger VPS

### Deploy Commands (on VPS)
```bash
cd /var/www/lacosta
git pull
npm install
npm run build
pm2 restart lacosta-api
```

### SSL Renewal
Certbot auto-renews via cron. Manual: `sudo certbot renew`

### Nginx Config
Located at `/etc/nginx/sites-available/lacosta`. Key features:
- HTTP → HTTPS redirect
- Rate limiting: 100 req/min general, 10 req/min auth
- Proxy to Node.js on port 4000
- Static asset caching (`/assets/` 1 year, `/uploads/` 30 days)

### Cloudflare Tunnel (backup)
If ISP routing fails (common with some Kenyan ISPs), `cloudflared` provides direct tunnel access:
```bash
# Install (one-time)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Start quick tunnel (temporary URL)
cloudflared tunnel --url http://localhost:4000

# Start as background service (persistent)
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```
Quick tunnel gives a temporary `*.trycloudflare.com` URL. For production, use a named tunnel with a Cloudflare account.

## Commands

```bash
npm run dev      # Vite + Express concurrently
npm run build    # Production build
npm start        # Production (Express only)
npm run seed     # Seed DB + data.json
npm test         # Run Vitest
npm run lint     # Run Oxlint
```

### PM2 Commands (production)
```bash
pm2 status              # Check process status
pm2 logs lacosta-api    # View logs
pm2 restart lacosta-api # Restart app
pm2 stop lacosta-api    # Stop app
```

## Code Conventions

- No comments unless asked
- CSS in `App.css` (~2637 lines) with CSS custom properties for theming
- Admin CSS in `admin/admin.css` (~692 lines) with `--adm-*` scoped variables
- Dark mode via `data-theme` attribute on `<html>`
- State managed via React Context (`AuthContext`, `CartContext`)
- Server uses Express 5 (not 4) — `app.use()` returns promises
- University scoping: most queries filter by `university` column
- Real-time sync: frontend polls `/api/data` every 5s, stock every 10s
- Rate limiters use custom `keyGenerator` to handle proxied IPs (Cloudflare/Nginx)
- User data isolation: localStorage keys are scoped by user ID (`lacosta-cart-{userId}`, `lacosta_history-{userId}`) to prevent cross-user data leakage when switching accounts

## Universities (in database)

- `seku` — SEKU University (notify: lacostamarkets@gmail.com)
- `mama-ngina-university` — Mama Ngina University (notify: lacostamarketsmnuc@gmail.com)
- `ku` — KU (notify: lacostamarkets@gmail.com)

## Known Issues

- **Kenyan ISP routing**: Some ISPs cannot route directly to Hostinger VPS IP `72.62.132.86`. Cloudflare proxy is configured but may require DNS flush on client devices. Cloudflare tunnel (`cloudflared`) works as fallback.
- **Admin panel at 2,459 lines**: Single file (`Admin.jsx`) with 16 components — should be split into separate files.
- **No 404 route**: Missing catch-all route in `App.jsx`.
- **No pagination**: Products, orders, customers all load as flat lists.
- **Hardcoded default passwords**: `config.js` defaults `adminPassword` to `'lacosta-admin'` and `superUserPassword` to `'qazwsxedc'` — must be overridden via env vars in production.
- **Code duplication**: `hashPassword`/`verifyPassword` duplicated in `index.js` and `auth.js`; `requireUser` middleware triplicated across `cart.js`, `orders.js`, `payment-routes.js`; `getNotifyEmail` duplicated in `orders.js` and `payment-routes.js`; `categorySlug()` hardcoded in `Header.jsx`, `Category.jsx`, `Admin.jsx`.
- **In-memory sessions**: Admin sessions (`Set`) are lost on server restart and have no expiration.
- **Webhook idempotency**: Stock deduction in the payment webhook has no guard against duplicate deliveries — retries could deduct stock twice.
