import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'
import { sendEmail } from './email.js'
import { config } from './config.js'

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

  const order = result.rows[0]

  // Send order confirmation email
  const itemsList = items.map(i =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty ?? 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.price}</td>
    </tr>`
  ).join('')

  sendEmail({
    to: req.user.email,
    subject: `Order #${order.id} received — Lacosta`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#65a30d">Order confirmed!</h2>
        <p>Hi ${name},</p>
        <p>We've received your order <strong>#${order.id}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Item</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${itemsList}</tbody>
        </table>
        <p style="font-size:18px"><strong>Total: ${order.total}</strong></p>
        <p>We'll contact you at <strong>${phone}</strong> to confirm delivery details.</p>
        <p style="color:#666;font-size:14px">If you have any questions, reply to this email or call 0112974286.</p>
      </div>
    `,
  }).catch(() => {})

  // Send notification to admin
  if (config.adminEmail) {
    sendEmail({
      to: config.adminEmail,
      subject: `🛒 New Order #${order.id} — KSh ${total.toLocaleString()}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#65a30d">New order received!</h2>
          <p><strong>Order #${order.id}</strong></p>
          <p><strong>Customer:</strong> ${name} (${req.user.email})</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px;text-align:left">Item</th>
                <th style="padding:8px;text-align:center">Qty</th>
                <th style="padding:8px;text-align:right">Price</th>
              </tr>
            </thead>
            <tbody>${itemsList}</tbody>
          </table>
          <p style="font-size:18px"><strong>Total: ${order.total}</strong></p>
          <p><a href="${config.baseUrl}" style="color:#65a30d">View in admin panel →</a></p>
        </div>
      `,
    }).catch(() => {})
  }

  res.json({ ok: true, order })
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

  const order = result.rows[0]

  // Send status update email to customer
  const statusMessages = {
    confirmed: { title: 'Order confirmed', body: 'Your order has been confirmed and is being prepared for delivery.' },
    canceled: { title: 'Order canceled', body: 'Your order has been canceled. If you have questions, contact us.' },
    delivered: { title: 'Order delivered', body: 'Your order has been delivered. Thank you for shopping with Lacosta!' },
  }

  if (order.email && statusMessages[status]) {
    sendEmail({
      to: order.email,
      subject: `Order #${order.id} ${statusMessages[status].title} — Lacosta`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#65a30d">${statusMessages[status].title}</h2>
          <p>Hi ${order.name},</p>
          <p>${statusMessages[status].body}</p>
          <p><strong>Order #${order.id}</strong></p>
          <p><strong>Items:</strong> ${(order.items ?? []).map(i => `${i.name} x${i.qty ?? 1}`).join(', ')}</p>
          <p><strong>Total:</strong> ${order.total}</p>
        </div>
      `,
    }).catch(() => {})
  }

  res.json({ ok: true, order })
})

// Update an order's payment status (admin)
orderAdminRouter.put('/:id/payment', async (req, res) => {
  const { payment_status } = req.body ?? {}
  const allowed = ['pending', 'paid', 'failed']
  if (!allowed.includes(payment_status)) {
    return res.status(400).json({ error: 'Invalid payment_status' })
  }
  const result = await pool.query(
    'UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *',
    [payment_status, req.params.id]
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  res.json({ ok: true, order: result.rows[0] })
})

// Delete a user permanently (admin, requires password confirmation)
orderAdminRouter.delete('/user/:id', async (req, res) => {
  const password = String(req.body?.password ?? '')
  if (!password) return res.status(400).json({ error: 'Password required' })

  const { config } = await import('./config.js')
  if (password !== config.adminPassword) {
    return res.status(403).json({ error: 'Incorrect password' })
  }

  const userId = req.params.id
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [userId])
  if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' })

  res.json({ ok: true, deleted: result.rows[0] })
})

// Delete an order permanently (admin)
orderAdminRouter.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [
    req.params.id,
  ])
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  res.json({ ok: true })
})