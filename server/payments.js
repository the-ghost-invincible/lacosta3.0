import { Lipana } from '@lipana/sdk'
import crypto from 'node:crypto'
import { pool } from './db.js'

// Cache Lipana clients per university (re-initialized if credentials change)
const clientCache = new Map()

// ---------- Phone normalization ----------

export function normalizePhone(phone) {
  let msisdn = String(phone).replace(/[\s-]/g, '')
  if (msisdn.startsWith('+')) return msisdn
  if (msisdn.startsWith('0')) return '+254' + msisdn.slice(1)
  if (!msisdn.startsWith('254')) return '+254' + msisdn
  return '+' + msisdn
}

// ---------- University credential lookup ----------

export async function getUniversityPaymentConfig(university) {
  if (!university) return null
  try {
    const result = await pool.query(
      'SELECT lipana_api_key, lipana_webhook_secret, lipana_environment, lipana_till_number FROM universities WHERE slug = $1',
      [university]
    )
    return result.rows[0] || null
  } catch {
    return null
  }
}

// ---------- Lipana client factory ----------

function getLipanaClient(apiKey, environment) {
  const cacheKey = `${apiKey}:${environment}`
  if (clientCache.has(cacheKey)) return clientCache.get(cacheKey)

  const client = new Lipana({
    apiKey,
    environment: environment === 'production' ? 'production' : 'sandbox',
  })
  clientCache.set(cacheKey, client)

  // Evict after 1 hour (in case keys rotate)
  setTimeout(() => clientCache.delete(cacheKey), 3600_000)
  return client
}

export function invalidateClientCache(_university) {
  // Clear all cached clients (safe — they'll be recreated on next use)
  clientCache.clear()
}

// ---------- STK Push ----------

export async function initiateSTKPush({ phone, amount, accountRef, description, university }) {
  const config = await getUniversityPaymentConfig(university)
  if (!config?.lipana_api_key) {
    throw new Error('M-Pesa is not configured for this university')
  }

  const client = getLipanaClient(config.lipana_api_key, config.lipana_environment)
  const normalizedPhone = normalizePhone(phone)
  const roundedAmount = Math.round(Number(amount))

  if (roundedAmount < 10) {
    throw new Error('Minimum payment amount is KSh 10')
  }

  const result = await client.transactions.initiateStkPush({
    phone: normalizedPhone,
    amount: roundedAmount,
    accountReference: accountRef ?? 'Lacosta',
    transactionDesc: description ?? 'Lacosta order payment',
  })

  return {
    transactionId: result.transactionId ?? result.id ?? null,
    checkoutRequestId: result.checkoutRequestId ?? result.transactionId ?? result.id ?? null,
    customerMessage: result.customerMessage ?? result.message ?? 'STK push sent',
    raw: result,
  }
}

// ---------- Query transaction status ----------

export async function queryTransactionStatus(transactionId, university) {
  const config = await getUniversityPaymentConfig(university)
  if (!config?.lipana_api_key) {
    throw new Error('M-Pesa is not configured for this university')
  }

  const client = getLipanaClient(config.lipana_api_key, config.lipana_environment)

  try {
    const result = await client.transactions.get(transactionId)
    return result
  } catch {
    // Fallback: try listing transactions and filtering
    return { status: 'unknown', transactionId }
  }
}

// ---------- Webhook signature verification ----------

export function verifyWebhookSignature(payload, signature, webhookSecret) {
  if (!webhookSecret || !signature) return false
  try {
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

// ---------- Parse webhook payload ----------

export function parseWebhookPayload(body) {
  if (!body) return null

  // Handle different possible Lipana webhook formats
  const data = body.data ?? body

  return {
    transactionId: data.transactionId ?? data.id ?? data.TransactionID ?? null,
    status: data.status ?? data.Status ?? data.resultCode ?? null,
    amount: data.amount ?? data.Amount ?? null,
    phoneNumber: data.phoneNumber ?? data.PhoneNumber ?? data.phone ?? null,
    receipt: data.receipt ?? data.MpesaReceiptNumber ?? data.mpesaReceiptNumber ?? null,
    accountReference: data.accountReference ?? data.AccountReference ?? null,
    timestamp: data.timestamp ?? data.Timestamp ?? data.transactionDate ?? null,
    raw: body,
  }
}

// ---------- Validation ----------

export function isConfigured(university) {
  return getUniversityPaymentConfig(university).then(
    (config) => Boolean(config?.lipana_api_key),
    () => false
  )
}

export async function getConfig(university) {
  const config = await getUniversityPaymentConfig(university)
  return {
    configured: Boolean(config?.lipana_api_key),
    environment: config?.lipana_environment ?? 'sandbox',
    tillNumber: config?.lipana_till_number ?? null,
  }
}
