import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'

const router = Router()

async function requireUser(req, res, next) {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

// The signed-in user's saved cart
router.get('/', requireUser, async (req, res) => {
  const result = await pool.query(
    'SELECT items FROM carts WHERE user_id = $1',
    [req.user.id]
  )
  res.json({ items: result.rows[0]?.items ?? [] })
})

// Replace the signed-in user's cart
router.put('/', requireUser, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  await pool.query(
    `INSERT INTO carts (user_id, items, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE
       SET items = EXCLUDED.items, updated_at = now()`,
    [req.user.id, JSON.stringify(items)]
  )
  res.json({ ok: true })
})

export const cartRouter = router