# AGENTS.md — Lacosta 3.0

## Project Overview

Lacosta 3.0 is a **multi-tenant e-commerce marketplace** for Kenyan university campuses. Each university gets its own isolated storefront (products, orders, site content, admin panel, payment till). Production: `lacostamarkets.site`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Vite 8, vanilla CSS |
| Backend | Node.js 22, Express 5 |
| Database | PostgreSQL (via `pg` driver) |
| Payments | **Lipana SDK** (`@lipana/sdk`) — per-university M-Pesa till accounts |
| Email | Resend API (per-university sending address) |
| Auth | scrypt password hashing, HTTP-only session cookies |
| Testing | Vitest |
| Linting | Oxlint |

## Architecture

```
src/           → React SPA (Vite)
server/        → Express API (port 4000)
public/        → Static assets (images, uploads)
deploy/        → Deployment scripts (Nginx, PM2, Certbot)
dist/          → Vite build output (production)
```

## Key Files

### Backend (`server/`)
- `index.js` — Express app, route mounting, admin sessions, middleware
- `db.js` — PostgreSQL pool, schema init, auto-migrations
- `auth.js` — User registration, login, email verification, password reset
- `payments.js` — Lipana SDK wrapper (per-university), phone normalization, webhook signature verification
- `payment-routes.js` — Payment HTTP routes (STK push, webhook, admin config)
- `orders.js` — Order placement, status updates, stock deduction/restore helpers
- `cart.js` — Per-user cart CRUD
- `email.js` — Resend email service (per-university sender)
- `config.js` — Centralized env var config
- `seo.js` — Dynamic sitemap.xml + robots.txt
- `error-tracker.js` — Sentry error reporting

### Frontend (`src/`)
- `App.jsx` — Root component, route definitions
- `AuthContext.jsx` — Auth state + API calls context provider
- `CartContext.jsx` — Cart state + server sync context provider
- `Cart.jsx` — Shopping cart + checkout + M-Pesa payment flow
- `Home.jsx` — Landing page (hero, deals, catalog, trending)
- `Category.jsx` — Category browsing with subcategory menus
- `Header.jsx` — Topbar, search, category strip, mobile nav
- `admin/Admin.jsx` — Full admin dashboard (~2100 lines, tabs: Products, Customers, Orders, **Payments**, Featured, Categories, Subcategories, Site Content)

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

## Database Schema

8 tables: `users`, `sessions`, `carts`, `orders`, `products`, `universities`, `site_data`, `tokens`

Migrations run automatically via `ALTER TABLE ADD COLUMN IF NOT EXISTS` in `db.js`.

## Admin Panel

Located at secret URL (`/admin-7f3k9`). Two roles:
- **Superuser** — full access to all universities, can configure payment keys
- **Sub-user** (university admin) — scoped to their university, can see till number but NOT API keys

## Environment Variables

```
DATABASE_URL, PORT, BASE_URL, ADMIN_PASSWORD, ADMIN_PATH, ADMIN_EMAIL
RESEND_API_KEY, EMAIL_FROM
SENTRY_DSN (optional)
```

M-Pesa/Lipana credentials are per-university in the database, NOT in `.env`.

## Commands

```bash
npm run dev      # Vite + Express concurrently
npm run build    # Production build
npm start        # Production (Express only)
npm run seed     # Seed DB + data.json
npm test         # Run Vitest
npm run lint     # Run Oxlint
```

## Code Conventions

- No comments unless asked
- CSS in `App.css` (~2555 lines) with CSS custom properties for theming
- Dark mode via `data-theme` attribute on `<html>`
- State managed via React Context (`AuthContext`, `CartContext`)
- Server uses Express 5 (not 4) — `app.use()` returns promises
- University scoping: most queries filter by `university` column
- Real-time sync: frontend polls `/api/data` every 5s, stock every 10s
