import crypto from 'node:crypto'

const SENTRY_DSN = process.env.SENTRY_DSN ?? ''

// Lightweight error reporter — works with or without Sentry DSN
// If SENTRY_DSN is set, forwards errors to Sentry via their HTTP API
// Otherwise, just logs structured errors to console

async function sendToSentry(level, message, extra = {}) {
  if (!SENTRY_DSN) return

  // Parse DSN: https://public_key@o项目id.ingest.sentry.io/project_id
  const match = SENTRY_DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/)
  if (!match) return

  const [, publicKey, host, projectId] = match
  const url = `https://${host}/api/${projectId}/store/`
  const timestamp = new Date().toISOString()

  const payload = {
    event_id: crypto.randomUUID(),
    message,
    level,
    timestamp,
    platform: 'node',
    tags: { service: 'lacosta-api' },
    extra,
  }

  try {
    // Sentry uses a basic auth header
    const auth = Buffer.from(`${publicKey}:`).toString('base64')
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Don't let error reporting crash the app
  }
}

export function captureError(error, context = {}) {
  const message = error?.message ?? String(error)
  const stack = error?.stack ?? ''

  console.error(`[ERROR] ${message}`, context)

  sendToSentry('error', message, {
    ...context,
    stack,
    name: error?.name,
  })
}

export function captureWarning(message, context = {}) {
  console.warn(`[WARN] ${message}`, context)
  sendToSentry('warning', message, context)
}

// Express error-handling middleware
export function errorHandler(err, _req, res, _next) {
  captureError(err, { url: _req?.url, method: _req?.method })
  res.status(500).json({ error: 'Internal server error' })
}
