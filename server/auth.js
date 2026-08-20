import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from './db.js'

const router = Router()

const SESSION_COOKIE = 'lacostaSession'
const SESSION_DAYS = 30

const isSecure = (req) =>
  req.secure || req.headers['x-forwarded-proto'] === 'https'

const cookieOptions = (req, maxAge) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecure(req),
  maxAge,
})

const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  displayName: row.display_name,
  avatar: row.avatar,
  phone: row.phone ?? null,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/i
const PHONE_RE = /^\+?[0-9][0-9\s\-]{8,14}$/

// ---------- Password hashing (scrypt, salted) ----------
const keylen = 64

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, keylen).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, keylen)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

// ---------- Register ----------
router.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email])
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: 'An account with that email already exists. Log in instead.' })
  }

  const result = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`,
    [email, hashPassword(password)]
  )
  res.json({ ok: true, user: publicUser(result.rows[0]) })
})

// ---------- Log in (email + password) ----------
router.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  const result = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  )
  const user = result.rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' })
  }

  await createSession(res, user.id, req)
  res.json({ user: publicUser(user) })
})

async function createSession(res, userId, req) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expires]
  )
  res.cookie(SESSION_COOKIE, token, cookieOptions(req, SESSION_DAYS * 24 * 60 * 60 * 1000))
}

// Current user, or { user: null }
router.get('/me', async (req, res) => {
  const user = await userFromSession(req)
  res.json({ user })
})

export async function userFromSession(req) {
  const token = req.cookies[SESSION_COOKIE]
  if (!token) return null
  const result = await pool.query(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  )
  return result.rows[0] ? publicUser(result.rows[0]) : null
}

router.post('/logout', async (req, res) => {
  const token = req.cookies[SESSION_COOKIE]
  if (token) {
    // Kill every session for this user, not just the current cookie's
    await pool.query(
      `DELETE FROM sessions
       WHERE token = $1
          OR user_id = (SELECT user_id FROM sessions WHERE token = $1)`,
      [token]
    )
  }
  res.clearCookie(SESSION_COOKIE)
  res.json({ ok: true })
})

// Choose a username (required once after the first sign-in)
router.post('/username', async (req, res) => {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const raw = String(req.body?.username ?? '').trim()
  if (!USERNAME_RE.test(raw)) {
    return res.status(400).json({
      error: 'Username must be 3–20 characters (letters, digits, _ or -)',
    })
  }

  const taken = await pool.query(
    'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2',
    [raw, user.id]
  )
  if (taken.rowCount > 0) {
    return res.status(409).json({ error: 'That username is already taken' })
  }

  const result = await pool.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING *',
    [raw, user.id]
  )
  res.json({ user: publicUser(result.rows[0]) })
})

// Save / update the signed-in user's phone number (used at checkout)
router.put('/phone', async (req, res) => {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const phone = String(req.body?.phone ?? '').trim()
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number' })
  }

  const result = await pool.query(
    'UPDATE users SET phone = $1 WHERE id = $2 RETURNING *',
    [phone, user.id]
  )
  res.json({ user: publicUser(result.rows[0]) })
})

// Save / update the signed-in user's name (used at checkout)
router.put('/name', async (req, res) => {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })

  const name = String(req.body?.name ?? '').trim()
  if (!name || name.length > 50) {
    return res.status(400).json({ error: 'Enter a valid name' })
  }

  const result = await pool.query(
    'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING *',
    [name, user.id]
  )
  res.json({ user: publicUser(result.rows[0]) })
})

export const authRouter = router