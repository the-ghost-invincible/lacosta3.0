import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'

const STATUSES = ['pending', 'confirmed', 'canceled', 'delivered']

export const orderRouter = Router()

async function requireUser(req, res, next) {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

const parsePrice = (price) => Number(String(price ?? '').replace(/[^\d]/g, '')) || 0

// Place an order (signed-in customer)
orderRouter.post('/', requireUser, async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  const items = Array.isArray(req.body?.items) ? req.body.items : []

  if (!name) return res.status(400).json({ error: 'Enter a valid name' })
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number' })
  if (items.length === 0) return res.status(400).json({ error: 'Your cart is empty' })

  const total = items.reduce((sum, i) => sum + parsePrice(i.price) * (i.qty ?? 1), 0)

  const result = await pool.query(
    `INSERT INTO orders (user_id, name, phone, email, items, total, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
    [req.user.id, name, phone, req.user.email, JSON.stringify(items), `KSh ${total.toLocaleString()}`]
  )
  res.json({ ok: true, order: result.rows[0] })
})

export const orderAdminRouter = Router()

// Every registered user exactly once, with their live cart (admin).
// The cart comes from the carts table, so product additions/removals by
// the customer show up here on the next refresh. Orders are NOT created
// here — this is a read-only view.
export async function getCustomers(_req, res) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.username, u.display_name AS "displayName", u.phone,
            u.created_at AS "registeredAt",
            c.items, c.updated_at AS "cartUpdatedAt",
            COALESCE(c.updated_at, u.created_at) AS "lastActive"
     FROM users u
     LEFT JOIN carts c ON c.user_id = u.id
     ORDER BY "lastActive" DESC`
  )
  res.json({ customers: result.rows })
}

// List all orders, newest first (admin)
orderAdminRouter.get('/', async (_req, res) => {
  const result = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC, id DESC'
  )
  res.json({ orders: result.rows })
})

// Set an order's status: confirmed / canceled / delivered (admin)
orderAdminRouter.put('/:id/status', async (req, res) => {
  const { status } = req.body ?? {}
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const result = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  res.json({ ok: true, order: result.rows[0] })
})

// Delete an order permanently (admin)
orderAdminRouter.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [
    req.params.id,
  ])
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  res.json({ ok: true })
})