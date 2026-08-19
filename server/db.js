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
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar TEXT,
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

export async function initDb() {
  await pool.query(USERS_TABLE)
  await pool.query(SESSIONS_TABLE)
}
