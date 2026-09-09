import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from './db.js'
import { sendEmail } from './email.js'
import { config } from './config.js'
import { hashPassword, verifyPassword } from './helpers.js'

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
  verified: row.verified ?? true,
  university: row.university ?? null,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/i
const PHONE_RE = /^\+?[0-9][0-9\s\-]{8,14}$/

// ---------- Register ----------
router.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const university = String(req.body?.university ?? '').trim()

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  if (!university) {
    return res.status(400).json({ error: 'Please select a university' })
  }

  // Verify university exists
  const uniCheck = await pool.query('SELECT 1 FROM universities WHERE slug = $1', [university])
  if (uniCheck.rowCount === 0) {
    return res.status(400).json({ error: 'Invalid university selection' })
  }

  const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email])
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: 'An account with that email already exists. Log in instead.' })
  }

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, verified, university) VALUES ($1, $2, false, $3) RETURNING *`,
    [email, hashPassword(password), university]
  )
  const user = result.rows[0]

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO tokens (user_id, type, token, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, 'verify', token, expires]
  )

  const verifyUrl = `${config.baseUrl}/verify?token=${token}`
  sendEmail({
    to: email,
    subject: 'Verify your Lacosta account',
    university,
    html: `
      <div style="padding:40px 32px;text-align:center;">
        <img src="${config.baseUrl}/logo.png" alt="Lacosta" width="48" height="48" style="border-radius:12px;margin-bottom:16px;">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Welcome to Lacosta!</h1>
        <p style="font-size:15px;color:#52525b;margin:0 0 24px;">Thanks for signing up. Verify your email to get started.</p>
        <a href="${verifyUrl}" style="display:inline-block;background-color:#65a30d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Verify email address</a>
        <p style="font-size:13px;color:#a1a1aa;margin:24px 0 0;">This link expires in 24 hours.</p>
        <p style="font-size:13px;color:#a1a1aa;margin:8px 0 0;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  }).catch(() => {})

  res.json({ ok: true, user: publicUser(user) })
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

  if (!user.verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' })
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

// ---------- Verify email ----------
router.get('/verify', async (req, res) => {
  const token = String(req.query?.token ?? '')
  if (!token) return res.status(400).json({ error: 'Invalid link' })

  const result = await pool.query(
    'SELECT * FROM tokens WHERE token = $1 AND type = $2 AND expires_at > now()',
    [token, 'verify']
  )
  const row = result.rows[0]
  if (!row) return res.status(400).json({ error: 'Invalid or expired verification link' })

  await pool.query('UPDATE users SET verified = true WHERE id = $1', [row.user_id])
  await pool.query('DELETE FROM tokens WHERE id = $1', [row.id])
  res.json({ ok: true })
})

// ---------- Resend verification email ----------
router.post('/verify/resend', async (req, res) => {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  if (user.verified) return res.json({ ok: true, message: 'Already verified' })

  await pool.query("DELETE FROM tokens WHERE user_id = $1 AND type = 'verify'", [user.id])

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO tokens (user_id, type, token, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, 'verify', token, expires]
  )

  const verifyUrl = `${config.baseUrl}/verify?token=${token}`
  sendEmail({
    to: user.email,
    subject: 'Verify your Lacosta account',
    university: user.university,
    html: `
      <div style="padding:40px 32px;text-align:center;">
        <img src="${config.baseUrl}/logo.png" alt="Lacosta" width="48" height="48" style="border-radius:12px;margin-bottom:16px;">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Verify your email</h1>
        <p style="font-size:15px;color:#52525b;margin:0 0 24px;">Click the button below to verify your email address.</p>
        <a href="${verifyUrl}" style="display:inline-block;background-color:#65a30d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Verify email address</a>
        <p style="font-size:13px;color:#a1a1aa;margin:24px 0 0;">This link expires in 24 hours.</p>
        <p style="font-size:13px;color:#a1a1aa;margin:8px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  }).catch(() => {})

  res.json({ ok: true })
})

// ---------- Resend verification (public, for unverified users) ----------
router.post('/verify/resend-public', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }

  const result = await pool.query('SELECT id, verified, university FROM users WHERE LOWER(email) = LOWER($1)', [email])
  const user = result.rows[0]

  // Always return success to prevent email enumeration
  if (!user || user.verified) return res.json({ ok: true })

  await pool.query("DELETE FROM tokens WHERE user_id = $1 AND type = 'verify'", [user.id])

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO tokens (user_id, type, token, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, 'verify', token, expires]
  )

  const verifyUrl = `${config.baseUrl}/verify?token=${token}`
  sendEmail({
    to: email,
    subject: 'Verify your Lacosta account',
    university: user.university,
    html: `
      <div style="padding:40px 32px;text-align:center;">
        <img src="${config.baseUrl}/logo.png" alt="Lacosta" width="48" height="48" style="border-radius:12px;margin-bottom:16px;">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Verify your email</h1>
        <p style="font-size:15px;color:#52525b;margin:0 0 24px;">Click the button below to verify your email address.</p>
        <a href="${verifyUrl}" style="display:inline-block;background-color:#65a30d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Verify email address</a>
        <p style="font-size:13px;color:#a1a1aa;margin:24px 0 0;">This link expires in 24 hours.</p>
        <p style="font-size:13px;color:#a1a1aa;margin:8px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  }).catch(() => {})

  res.json({ ok: true })
})

// ---------- Forgot password ----------
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }

  const result = await pool.query('SELECT id, university FROM users WHERE LOWER(email) = LOWER($1)', [email])
  const user = result.rows[0]

  // Always return success to prevent email enumeration
  if (!user) return res.json({ ok: true })

  await pool.query("DELETE FROM tokens WHERE user_id = $1 AND type = 'reset'", [user.id])

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  await pool.query(
    'INSERT INTO tokens (user_id, type, token, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, 'reset', token, expires]
  )

  const resetUrl = `${config.baseUrl}/reset-password?token=${token}`
  sendEmail({
    to: email,
    subject: 'Reset your Lacosta password',
    university: user.university,
    html: `
      <div style="padding:40px 32px;text-align:center;">
        <img src="${config.baseUrl}/logo.png" alt="Lacosta" width="48" height="48" style="border-radius:12px;margin-bottom:16px;">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Reset your password</h1>
        <p style="font-size:15px;color:#52525b;margin:0 0 24px;">Click the button below to set a new password.</p>
        <a href="${resetUrl}" style="display:inline-block;background-color:#65a30d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Reset password</a>
        <p style="font-size:13px;color:#a1a1aa;margin:24px 0 0;">This link expires in 1 hour.</p>
        <p style="font-size:13px;color:#a1a1aa;margin:8px 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  }).catch(() => {})

  res.json({ ok: true })
})

// ---------- Reset password ----------
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '')
  const password = String(req.body?.password ?? '')

  if (!token) return res.status(400).json({ error: 'Invalid link' })
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const result = await pool.query(
    'SELECT * FROM tokens WHERE token = $1 AND type = $2 AND expires_at > now()',
    [token, 'reset']
  )
  const row = result.rows[0]
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' })

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    hashPassword(password),
    row.user_id,
  ])
  await pool.query('DELETE FROM tokens WHERE id = $1', [row.id])
  // Kill all sessions for this user so they must re-login with the new password
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id])

  res.json({ ok: true })
})

export const authRouter = router