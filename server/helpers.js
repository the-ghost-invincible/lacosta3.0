import crypto from 'node:crypto'
import { pool } from './db.js'
import { userFromSession } from './auth.js'
import { config } from './config.js'

const keylen = 64

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, keylen).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, keylen)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

export async function requireUser(req, res, next) {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

export async function getNotifyEmail(university) {
  if (!university) return config.adminEmail || null
  try {
    const result = await pool.query('SELECT notify_email FROM universities WHERE slug = $1', [university])
    return result.rows[0]?.notify_email || config.adminEmail || null
  } catch {
    return config.adminEmail || null
  }
}
