import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://lacosta:lacosta@localhost:5432/lacosta',
})

const USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )
`

const CARTS_TABLE = `
  CREATE TABLE IF NOT EXISTS carts (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT DEFAULT 'cod',
    payment_status TEXT DEFAULT 'pending',
    payment_ref TEXT,
    payment_receipt TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('verify', 'reset')),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const PRODUCTS_TABLE = `
  CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    subcategory TEXT,
    price TEXT NOT NULL,
    old_price TEXT,
    seller TEXT,
    rating NUMERIC(2,1) DEFAULT 4.5,
    image TEXT,
    description TEXT,
    specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    badge TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const SITE_DATA_TABLE = `
  CREATE TABLE IF NOT EXISTS site_data (
    section TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

export async function initDb() {
  await pool.query(USERS_TABLE)
  await pool.query(SESSIONS_TABLE)
  await pool.query(CARTS_TABLE)
  await pool.query(ORDERS_TABLE)
  await pool.query(PRODUCTS_TABLE)
  await pool.query(SITE_DATA_TABLE)
  // Migration for databases created before email/password auth:
  // add password_hash if missing and drop the obsolete google_id column.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"
  )
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT true")
  await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS google_id")
  // Payment columns migration
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod'")
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'")
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT")
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt TEXT")
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()")
  await pool.query(TOKENS_TABLE)
  // Out-of-stock migration
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS out_of_stock BOOLEAN NOT NULL DEFAULT false")
}