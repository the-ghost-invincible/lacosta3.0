// M-Pesa Daraja API configuration
const DARAJA_BASE = process.env.DARAJA_BASE_URL ?? 'https://sandbox.safaricom.co.ke'
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY ?? ''
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET ?? ''
const SHORTCODE = process.env.MPESA_SHORTCODE ?? ''
const PASSKEY = process.env.MPESA_PASSKEY ?? ''
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL ?? ''

let cachedToken = null
let tokenExpiry = 0

// ---------- Authentication ----------

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64')
  const res = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) throw new Error(`M-Pesa auth failed: ${res.status}`)
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000 // refresh 60s early
  return cachedToken
}

// ---------- STK Push (Lipa Na M-Pesa Online) ----------

function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
  const raw = `${SHORTCODE}${PASSKEY}${timestamp}`
  const password = Buffer.from(raw).toString('base64')
  return { timestamp, password }
}

export async function initiateSTKPush({ phone, amount, accountRef, description }) {
  const token = await getAccessToken()
  const { timestamp, password } = generatePassword()

  // Normalize phone: strip +, leading 0 → 254
  let msisdn = String(phone).replace(/[\s-]/g, '')
  if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1)
  if (!msisdn.startsWith('254')) msisdn = '254' + msisdn

  const body = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(Number(amount)),
    PartyA: msisdn,
    PartyB: SHORTCODE,
    PhoneNumber: msisdn,
    CallBackURL: CALLBACK_URL,
    AccountReference: accountRef ?? 'Lacosta',
    TransactionDesc: description ?? 'Lacosta order payment',
  }

  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (data.ResponseCode !== '0') {
    throw new Error(data.CustomerMessage ?? data.errorMessage ?? 'STK push failed')
  }
  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseCode: data.ResponseCode,
    customerMessage: data.CustomerMessage,
  }
}

// ---------- Query transaction status ----------

export async function querySTKStatus(checkoutRequestId) {
  const token = await getAccessToken()
  const { timestamp, password } = generatePassword()

  const res = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  })

  return await res.json()
}

// ---------- Callback parsing ----------

export function parseCallback(body) {
  const result = body?.Body?.stkCallback
  if (!result) return null

  const meta = {}
  for (const item of result.CallbackMetadata?.Item ?? []) {
    meta[item.Name] = item.Value
  }

  return {
    merchantRequestId: result.MerchantRequestID,
    checkoutRequestId: result.CheckoutRequestID,
    resultCode: result.ResultCode,
    resultDesc: result.ResultDesc,
    amount: meta.Amount,
    mpesaReceiptNumber: meta.MpesaReceiptNumber,
    balance: meta.Balance,
    transactionDate: meta.TransactionDate,
    phoneNumber: meta.PhoneNumber,
  }
}

// ---------- Validation ----------

export function isConfigured() {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET && SHORTCODE && PASSKEY && CALLBACK_URL)
}

export function getConfig() {
  return {
    configured: isConfigured(),
    sandbox: DARAJA_BASE.includes('sandbox'),
  }
}
