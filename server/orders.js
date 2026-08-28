import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'
import { sendEmail } from './email.js'
import { config } from './config.js'

const STATUSES = ['pending', 'confirmed', 'canceled', 'delivered']

// ---------- Stock helpers (shared with payment-routes.js) ----------

export async function deductStock(order) {
  const items = order.items ?? []
  for (const item of items) {
    if (!item.id) continue
    const qty = item.qty ?? 1
    await pool.query(
      `UPDATE products SET quantity = GREATEST(quantity - $1, 0),
       out_of_stock = CASE WHEN quantity - $1 <= 0 THEN true ELSE out_of_stock END
       WHERE id = $2 AND active = true`,
      [qty, item.id]
    )
  }
  process.emit('invalidate-data-cache')
}

export async function restoreStock(order) {
  const items = order.items ?? []
  for (const item of items) {
    if (!item.id) continue
    const qty = item.qty ?? 1
    await pool.query(
      `UPDATE products SET quantity = quantity + $1, out_of_stock = false
       WHERE id = $2 AND active = true`,
      [qty, item.id]
    )
  }
  process.emit('invalidate-data-cache')
}

// ---------- Daily sales tracking ----------

function parsePriceNum(price) {
  return Number(String(price ?? '').replace(/[^\d.]/g, '')) || 0
}

export async function trackDailySale(order, paid) {
  const totalNum = parsePriceNum(order.total)
  const university = order.university || 'default'
  const saleDate = new Date(order.created_at).toISOString().slice(0, 10)
  if (paid) {
    await pool.query(
      `INSERT INTO daily_sales (university, sale_date, total_orders, total_revenue, paid_orders, paid_revenue)
       VALUES ($1, $2, 1, $3, 1, $3)
       ON CONFLICT (university, sale_date) DO UPDATE SET
         total_orders = daily_sales.total_orders + 1,
         total_revenue = daily_sales.total_revenue + $3,
         paid_orders = daily_sales.paid_orders + 1,
         paid_revenue = daily_sales.paid_revenue + $3,
         updated_at = now()`,
      [university, saleDate, totalNum]
    )
  } else {
    await pool.query(
      `INSERT INTO daily_sales (university, sale_date, total_orders, total_revenue, paid_orders, paid_revenue)
       VALUES ($1, $2, 1, $3, 0, 0)
       ON CONFLICT (university, sale_date) DO UPDATE SET
         total_orders = daily_sales.total_orders + 1,
         total_revenue = daily_sales.total_revenue + $3,
         updated_at = now()`,
      [university, saleDate, totalNum]
    )
  }
}

export async function reverseDailySale(order) {
  const totalNum = parsePriceNum(order.total)
  const university = order.university || 'default'
  const saleDate = new Date(order.created_at).toISOString().slice(0, 10)
  await pool.query(
    `UPDATE daily_sales SET
       total_orders = GREATEST(total_orders - 1, 0),
       total_revenue = GREATEST(total_revenue - $3, 0),
       paid_orders = GREATEST(paid_orders - 1, 0),
       paid_revenue = GREATEST(paid_revenue - $3, 0),
       updated_at = now()
     WHERE university = $1 AND sale_date = $2`,
    [university, saleDate, totalNum]
  )
}

async function getNotifyEmail(university) {
  if (!university) return config.adminEmail || null
  try {
    const result = await pool.query('SELECT notify_email FROM universities WHERE slug = $1', [university])
    return result.rows[0]?.notify_email || config.adminEmail || null
  } catch {
    return config.adminEmail || null
  }
}

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

  // Check stock availability for each item (skip if DB is unavailable)
  try {
    for (const item of items) {
      if (!item.id) continue
      const qty = item.qty ?? 1
      const stock = await pool.query('SELECT quantity, out_of_stock, name FROM products WHERE id = $1 AND active = true', [item.id])
      if (stock.rowCount === 0) {
        return res.status(400).json({ error: `"${item.name}" is no longer available` })
      }
      const product = stock.rows[0]
      if (product.out_of_stock || product.quantity < qty) {
        return res.status(400).json({ error: `"${product.name}" has insufficient stock (available: ${product.quantity})` })
      }
    }
  } catch (err) {
    console.error('Stock check skipped (DB unavailable):', err.message)
  }

  const total = items.reduce((sum, i) => sum + parsePrice(i.price) * (i.qty ?? 1), 0)

  const result = await pool.query(
    `INSERT INTO orders (user_id, name, phone, email, items, total, status, university)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
    [req.user.id, name, phone, req.user.email, JSON.stringify(items), `KSh ${total.toLocaleString()}`, req.user.university]
  )

  const order = result.rows[0]

  await trackDailySale(order, false)

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
    university: req.user.university,
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
  const notifyTo = await getNotifyEmail(req.user.university)
  console.log(`[order-notify] Order #${order.id} | Uni: ${req.user.university} | Notify to: ${notifyTo}`)
  if (notifyTo) {
    sendEmail({
      to: notifyTo,
      subject: `🛒 New Order #${order.id} — KSh ${total.toLocaleString()}`,
      university: req.user.university,
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

// Get current user's order history
orderRouter.get('/mine', requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
      [req.user.id]
    )
    res.json({ orders: result.rows })
  } catch (err) {
    console.error('Failed to fetch user orders:', err.message)
    res.json({ orders: [] })
  }
})

// Cancel own order (user)
orderRouter.put('/:id/status', requireUser, async (req, res) => {
  const { status } = req.body ?? {}
  if (status !== 'canceled') {
    return res.status(400).json({ error: 'Users can only cancel orders' })
  }
  const result = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 AND user_id = $3 AND status = $4 RETURNING *',
    [status, req.params.id, req.user.id, 'pending']
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found or cannot be canceled' })

  const canceledOrder = result.rows[0]

  // Notify university admin of cancellation
  const cancelNotifyTo = await getNotifyEmail(canceledOrder.university)
  if (cancelNotifyTo) {
    sendEmail({
      to: cancelNotifyTo,
      subject: `❌ Order #${canceledOrder.id} canceled by customer`,
      university: canceledOrder.university,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Order #${canceledOrder.id} canceled</h2>
          <p><strong>Customer:</strong> ${canceledOrder.name} (${canceledOrder.email})</p>
          <p><strong>Items:</strong> ${(canceledOrder.items ?? []).map(i => `${i.name} x${i.qty ?? 1}`).join(', ')}</p>
          <p><strong>Total:</strong> ${canceledOrder.total}</p>
        </div>
      `,
    }).catch(() => {})
  }

  res.json({ ok: true, order: canceledOrder })
})

export const orderAdminRouter = Router()

// Every registered user exactly once, with their live cart (admin).
// Supports ?university=<slug> filtering.
export async function getCustomers(req, res) {
  const university = req.query.university || null
  let query = `
    SELECT u.id, u.email, u.username, u.display_name AS "displayName", u.phone,
            u.university, u.created_at AS "registeredAt",
            c.items, c.updated_at AS "cartUpdatedAt",
            COALESCE(c.updated_at, u.created_at) AS "lastActive"
     FROM users u
     LEFT JOIN carts c ON c.user_id = u.id`
  const params = []
  if (university) {
    query += ' WHERE u.university = $1'
    params.push(university)
  }
  query += ' ORDER BY "lastActive" DESC'
  const result = await pool.query(query, params)
  res.json({ customers: result.rows })
}

// List all orders, newest first (admin). Supports ?university=<slug> filtering.
orderAdminRouter.get('/', async (req, res) => {
  const university = req.query.university || null
  let query = 'SELECT * FROM orders'
  const params = []
  if (university) {
    query += ' WHERE university = $1'
    params.push(university)
  }
  query += ' ORDER BY created_at DESC, id DESC'
  const result = await pool.query(query, params)
  res.json({ orders: result.rows })
})

// Daily sales summary (admin, superuser only)
orderAdminRouter.get('/daily-sales', async (req, res) => {
  const university = req.query.university || null
  const days = parseInt(req.query.days) || 30
  let query = `
    SELECT university, sale_date, total_orders, total_revenue, paid_orders, paid_revenue
    FROM daily_sales
    WHERE sale_date >= CURRENT_DATE - INTERVAL '1 day' * $1`
  const params = [days]
  if (university) {
    query += ' AND university = $2'
    params.push(university)
  }
  query += ' ORDER BY sale_date DESC, university'
  const result = await pool.query(query, params)
  res.json({ sales: result.rows })
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
      university: order.university,
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

  // Send status update notification to university admin
  const statusNotifyTo = await getNotifyEmail(order.university)
  if (statusNotifyTo && statusMessages[status]) {
    const statusEmoji = { confirmed: '✅', canceled: '❌', delivered: '📦' }
    sendEmail({
      to: statusNotifyTo,
      subject: `${statusEmoji[status] ?? '📋'} Order #${order.id} ${statusMessages[status].title}`,
      university: order.university,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Order #${order.id} ${statusMessages[status].title}</h2>
          <p><strong>Customer:</strong> ${order.name} (${order.email})</p>
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

  // Fetch current order to check previous payment status
  const existing = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
  if (existing.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  const order = existing.rows[0]

  // Subtract stock when marking as paid (only if not already paid)
  if (payment_status === 'paid' && order.payment_status !== 'paid') {
    await deductStock(order)
    await trackDailySale(order, true)
  }

  // Restore stock if un-marking as paid (revert the deduction)
  if (payment_status !== 'paid' && order.payment_status === 'paid') {
    await restoreStock(order)
    await reverseDailySale(order)
  }

  const result = await pool.query(
    'UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *',
    [payment_status, req.params.id]
  )
  res.json({ ok: true, order: result.rows[0] })
})

// Delete a user permanently (admin, requires password confirmation)
orderAdminRouter.delete('/user/:id', async (req, res) => {
  const password = String(req.body?.password ?? '')
  if (!password) return res.status(400).json({ error: 'Password required' })

  const { config } = await import('./config.js')
  if (password !== config.superUserPassword) {
    return res.status(403).json({ error: 'Incorrect password' })
  }

  const userId = req.params.id
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [userId])
  if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' })

  res.json({ ok: true, deleted: result.rows[0] })
})

// Delete an order permanently (admin, requires superuser password)
orderAdminRouter.delete('/:id', async (req, res) => {
  const password = String(req.body?.password ?? '')
  if (!password) return res.status(400).json({ error: 'Super user password required' })

  const { config } = await import('./config.js')
  if (password !== config.superUserPassword) {
    return res.status(403).json({ error: 'Wrong super user password' })
  }

  const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [
    req.params.id,
  ])
  if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' })
  res.json({ ok: true })
})