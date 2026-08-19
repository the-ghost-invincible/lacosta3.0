import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from './db.js'

const router = Router()

const SESSION_COOKIE = 'lacostaSession'
const SESSION_DAYS = 30
const STATE_COOKIE = 'oauth_state'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

const clientId = () => process.env.GOOGLE_CLIENT_ID
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET

const redirectUri = (req) =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}/api/auth/google/callback`

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
})

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/i

// Start "Sign in with Google": bounce to Google with a CSRF state cookie
router.get('/google', (req, res) => {
  if (!clientId()) {
    return res.status(503).json({ error: 'Google sign-in is not configured yet' })
  }
  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
  })
  res.cookie(STATE_COOKIE, state, cookieOptions(req, 10 * 60 * 1000))
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`)
})

// Google redirects back here with ?code=...&state=...
router.get('/google/callback', async (req, res) => {
  const fail = () => res.redirect('/?login=failed')
  try {
    if (req.query.error) return fail()
    if (req.query.state !== req.cookies[STATE_COOKIE]) return fail()
    res.clearCookie(STATE_COOKIE)

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: clientId(),
        client_secret: clientSecret(),
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return fail()
    const { access_token } = await tokenRes.json()

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!infoRes.ok) return fail()
    const info = await infoRes.json()
    if (!info.email) return fail()

    const user = await upsertUser(info)
    await createSession(res, user.id, req)

    res.redirect('/')
  } catch {
    fail()
  }
})

async function upsertUser(info) {
  const result = await pool.query(
    `INSERT INTO users (google_id, email, display_name, avatar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET display_name = EXCLUDED.display_name, avatar = EXCLUDED.avatar
     RETURNING *`,
    [String(info.id), info.email, info.name ?? null, info.picture ?? null]
  )
  return result.rows[0]
}

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

async function userFromSession(req) {
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
    // Kill every session for this user, not just the current cookie's —
    // otherwise a sign-in on another origin (e.g. ngrok vs localhost)
    // leaves a session alive that can't be logged out from here.
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

// Choose a username (required once after the first Google sign-in)
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

export const authRouter = router
