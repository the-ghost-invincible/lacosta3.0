import { Router } from 'express'
import { pool } from './db.js'
import { userFromSession } from './auth.js'
import {
  initiateSTKPush,
  queryTransactionStatus,
  parseWebhookPayload,
  verifyWebhookSignature,
  getConfig,
  getUniversityPaymentConfig,
  invalidateClientCache,
} from './payments.js'
import { deductStock } from './orders.js'
import { sendEmail } from './email.js'
import { config } from './config.js'

async function getNotifyEmail(university) {
  if (!university) return config.adminEmail || null
  try {
    const result = await pool.query('SELECT notify_email FROM universities WHERE slug = $1', [university])
    return result.rows[0]?.notify_email || config.adminEmail || null
  } catch {
    return config.adminEmail || null
  }
}

const router = Router()

async function requireUser(req, res, next) {
  const user = await userFromSession(req)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

// ---------- Payment config (per university, public) ----------
router.get('/config/:university', async (req, res) => {
  const cfg = await getConfig(req.params.university)
  res.json(cfg)
})

// ---------- Payment config (legacy, for backward compat) ----------
router.get('/config', (_req, res) => {
  res.json({ configured: false, environment: 'sandbox', tillNumber: null })
})

// ---------- Initiate M-Pesa payment ----------
router.post('/mpesa/stkpush', requireUser, async (req, res) => {
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

    const university = order.university || req.user.university

    // Check if M-Pesa is configured for this university
    const payConfig = await getUniversityPaymentConfig(university)
    if (!payConfig?.lipana_api_key) {
      return res.status(503).json({ error: 'M-Pesa payments not configured for this university' })
    }

    // Parse the total amount
    const amount = Number(String(order.total ?? '').replace(/[^\d]/g, '')) || 0
    if (amount <= 0) return res.status(400).json({ error: 'Invalid order amount' })
    if (amount < 10) return res.status(400).json({ error: 'Minimum payment amount is KSh 10' })

    // Initiate STK push via Lipana
    const stkResult = await initiateSTKPush({
      phone,
      amount,
      accountRef: `ORD-${order.id}`,
      description: `Payment for order #${order.id}`,
      university,
    })

    // Update order with payment reference
    await pool.query(
      `UPDATE orders
       SET payment_ref = $1, payment_method = 'mpesa', payment_status = 'pending'
       WHERE id = $2`,
      [stkResult.checkoutRequestId ?? stkResult.transactionId, order.id]
    )

    res.json({
      ok: true,
      checkoutRequestId: stkResult.checkoutRequestId ?? stkResult.transactionId,
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
    // Look up the order to get the university
    const orderResult = await pool.query(
      'SELECT university FROM orders WHERE payment_ref = $1',
      [req.params.checkoutRequestId]
    )
    const university = orderResult.rows[0]?.university || req.user?.university

    const result = await queryTransactionStatus(req.params.checkoutRequestId, university)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- M-Pesa webhook (called by Lipana) ----------
// URL format: /api/payments/webhook/:universitySlug
// This is the safest format — university slug is in the path, no query params to tamper with
router.post('/webhook/:universitySlug', async (req, res) => {
  const { universitySlug } = req.params

  try {
    // Look up university's webhook secret for signature verification
    const payConfig = await getUniversityPaymentConfig(universitySlug)
    if (!payConfig?.lipana_webhook_secret) {
      console.warn(`[webhook] No webhook secret for university: ${universitySlug}`)
      return res.status(200).json({ ok: true })
    }

    // Verify webhook signature
    const signature = req.headers['x-lipana-signature'] ?? req.headers['x-lipana-signature']
    if (signature) {
      const rawBody = JSON.stringify(req.body)
      const isValid = verifyWebhookSignature(rawBody, signature, payConfig.lipana_webhook_secret)
      if (!isValid) {
        console.warn(`[webhook] Invalid signature for university: ${universitySlug}`)
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    const callback = parseWebhookPayload(req.body)
    if (!callback) {
      console.warn(`[webhook] Invalid payload for university: ${universitySlug}`)
      return res.status(200).json({ ok: true })
    }

    console.log(`[webhook] University: ${universitySlug} | Transaction:`, callback.transactionId, callback.status)

    // Determine payment status from webhook
    const statusStr = String(callback.status ?? '').toLowerCase()
    const isPaid = statusStr === 'completed' || statusStr === 'success' || statusStr === '0' || statusStr === 'paid'
    const paymentStatus = isPaid ? 'paid' : 'failed'

    // Find the order by payment_ref (transaction ID) or account reference
    let order = null
    if (callback.transactionId) {
      const result = await pool.query(
        'SELECT * FROM orders WHERE payment_ref = $1',
        [callback.transactionId]
      )
      order = result.rows[0]
    }
    if (!order && callback.accountReference) {
      const orderIdMatch = String(callback.accountReference).match(/ORD-(\d+)/)
      if (orderIdMatch) {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderIdMatch[1]])
        order = result.rows[0]
      }
    }

    if (!order) {
      console.warn(`[webhook] No matching order found for transaction: ${callback.transactionId}`)
      return res.status(200).json({ ok: true })
    }

    // Update order payment status
    const result = await pool.query(
      `UPDATE orders
       SET payment_status = $1, payment_receipt = $2, updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [paymentStatus, callback.receipt, order.id]
    )

    const updatedOrder = result.rows[0]

    // On confirmed payment: deduct stock, send emails
    if (updatedOrder && paymentStatus === 'paid') {
      // Deduct stock
      await deductStock(updatedOrder)

      // Send confirmation email to customer
      sendEmail({
        to: updatedOrder.email,
        subject: `Order #${updatedOrder.id} confirmed - Payment received`,
        university: updatedOrder.university,
        html: `
          <h2>Payment confirmed!</h2>
          <p>Your order <strong>#${updatedOrder.id}</strong> has been paid successfully.</p>
          <p><strong>M-Pesa receipt:</strong> ${callback.receipt ?? 'N/A'}</p>
          <p><strong>Amount:</strong> KSh ${Number(callback.amount ?? 0).toLocaleString()}</p>
          <p>We'll process your order shortly.</p>
        `,
      }).catch(() => {})

      // Notify university admin of payment
      const notifyTo = await getNotifyEmail(updatedOrder.university)
      if (notifyTo) {
        sendEmail({
          to: notifyTo,
          subject: `Payment received - Order #${updatedOrder.id} - KSh ${Number(callback.amount ?? 0).toLocaleString()}`,
          university: updatedOrder.university,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2>Payment received!</h2>
              <p><strong>Order #${updatedOrder.id}</strong></p>
              <p><strong>Customer:</strong> ${updatedOrder.name} (${updatedOrder.email})</p>
              <p><strong>Amount:</strong> KSh ${Number(callback.amount ?? 0).toLocaleString()}</p>
              <p><strong>M-Pesa receipt:</strong> ${callback.receipt ?? 'N/A'}</p>
              <p><strong>Items:</strong> ${(updatedOrder.items ?? []).map(i => `${i.name} x${i.qty ?? 1}`).join(', ')}</p>
            </div>
          `,
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[webhook] Error processing webhook:', err)
  }

  // Always return 200 to Lipana
  res.status(200).json({ ok: true })
})

// ---------- Admin: get university payment config ----------
// These routes are mounted in index.js where admin session checking is available
export async function getPaymentConfigAdmin(req, res) {
  const { university } = req.params
  try {
    const cfg = await getUniversityPaymentConfig(university)
    res.json({
      configured: Boolean(cfg?.lipana_api_key),
      environment: cfg?.lipana_environment ?? 'sandbox',
      tillNumber: cfg?.lipana_till_number ?? null,
      apiKeyPreview: cfg?.lipana_api_key
        ? '****' + cfg.lipana_api_key.slice(-8)
        : null,
      hasWebhookSecret: Boolean(cfg?.lipana_webhook_secret),
    })
  } catch {
    res.status(500).json({ error: 'Failed to load payment config' })
  }
}

export async function savePaymentConfigAdmin(req, res) {
  const { university } = req.params
  const { apiKey, webhookSecret, environment, tillNumber } = req.body ?? {}
  try {
    await pool.query(
      `UPDATE universities
       SET lipana_api_key = $1, lipana_webhook_secret = $2, lipana_environment = $3, lipana_till_number = $4
       WHERE slug = $5`,
      [apiKey || null, webhookSecret || null, environment || 'sandbox', tillNumber || null, university]
    )
    invalidateClientCache(university)
    res.json({ ok: true })
  } catch (err) {
    console.error('Failed to update payment config:', err.message)
    res.status(500).json({ error: 'Failed to save payment config' })
  }
}

export const paymentRouter = router
