import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'
import { initiateSTKPush, querySTKStatus, parseCallback, isConfigured, getConfig } from './payments.js'
import { sendEmail } from './email.js'

const router = Router()

async function requireUser(req, res, next) {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

// ---------- Payment config (public) ----------
router.get('/config', (_req, res) => {
  res.json(getConfig())
})

// ---------- Initiate M-Pesa payment ----------
router.post('/mpesa/stkpush', requireUser, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'M-Pesa payments not configured yet' })
  }

  const { orderId, phone } = req.body ?? {}
  if (!orderId || !phone) {
    return res.status(400).json({ error: 'orderId and phone are required' })
  }

  try {
    // Fetch the order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    )
    const order = orderResult.rows[0]
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Parse the total amount
    const amount = Number(String(order.total ?? '').replace(/[^\d]/g, '')) || 0
    if (amount <= 0) return res.status(400).json({ error: 'Invalid order amount' })

    // Initiate STK push
    const stkResult = await initiateSTKPush({
      phone,
      amount,
      accountRef: `ORD-${order.id}`,
      description: `Payment for order #${order.id}`,
    })

    // Update order with payment reference
    await pool.query(
      `UPDATE orders
       SET payment_ref = $1, payment_method = 'mpesa', payment_status = 'pending'
       WHERE id = $2`,
      [stkResult.checkoutRequestId, order.id]
    )

    res.json({
      ok: true,
      checkoutRequestId: stkResult.checkoutRequestId,
      message: stkResult.customerMessage,
    })
  } catch (err) {
    console.error('STK push error:', err.message)
    res.status(500).json({ error: err.message || 'Payment initiation failed' })
  }
})

// ---------- Check payment status ----------
router.get('/status/:checkoutRequestId', requireUser, async (req, res) => {
  try {
    const result = await querySTKStatus(req.params.checkoutRequestId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- M-Pesa callback (called by Safaricom) ----------
router.post('/mpesa/callback', async (req, res) => {
  try {
    const callback = parseCallback(req.body)
    if (!callback) {
      console.warn('Invalid M-Pesa callback received')
      return res.status(200).json({ ok: true }) // always 200 for Safaricom
    }

    console.log('M-Pesa callback:', callback)

    const paymentStatus = callback.resultCode === 0 ? 'paid' : 'failed'

    // Update order payment status
    const result = await pool.query(
      `UPDATE orders
       SET payment_status = $1, payment_receipt = $2, updated_at = now()
       WHERE payment_ref = $3
       RETURNING *`,
      [paymentStatus, callback.mpesaReceiptNumber, callback.checkoutRequestId]
    )

    const order = result.rows[0]
    if (order && paymentStatus === 'paid') {
      // Send confirmation email
      sendEmail({
        to: order.email,
        subject: `Order #${order.id} confirmed - Payment received`,
        html: `
          <h2>Payment confirmed!</h2>
          <p>Your order <strong>#${order.id}</strong> has been paid successfully.</p>
          <p><strong>M-Pesa receipt:</strong> ${callback.mpesaReceiptNumber}</p>
          <p><strong>Amount:</strong> KSh ${Number(callback.amount).toLocaleString()}</p>
          <p>We'll process your order shortly.</p>
        `,
      }).catch(() => {})
    }
  } catch (err) {
    console.error('M-Pesa callback error:', err)
  }

  // Always return 200 to Safaricom
  res.status(200).json({ ok: true })
})

// ---------- Validate prompt (Safaramic sometimes sends this) ----------
router.post('/mpesa/validation', (_req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

export const paymentRouter = router
