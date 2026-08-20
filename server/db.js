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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

export async function initDb() {
  await pool.query(USERS_TABLE)
  await pool.query(SESSIONS_TABLE)
  await pool.query(CARTS_TABLE)
  await pool.query(ORDERS_TABLE)
  // Migration for databases created before email/password auth:
  // add password_hash if missing and drop the obsolete google_id column.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"
  )
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
  await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS google_id")
}