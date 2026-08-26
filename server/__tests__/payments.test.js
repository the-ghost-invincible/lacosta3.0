import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { parseWebhookPayload, verifyWebhookSignature, normalizePhone } from '../payments.js'

describe('normalizePhone', () => {
  it('converts 07xx to +254', () => {
    expect(normalizePhone('0712345678')).toBe('+254712345678')
  })

  it('handles +254 prefix', () => {
    expect(normalizePhone('+254712345678')).toBe('+254712345678')
  })

  it('handles 254 prefix without +', () => {
    expect(normalizePhone('254712345678')).toBe('+254712345678')
  })

  it('strips spaces and dashes', () => {
    expect(normalizePhone('0712 345 678')).toBe('+254712345678')
    expect(normalizePhone('0712-345-678')).toBe('+254712345678')
  })

  it('handles leading 0 with country code', () => {
    expect(normalizePhone('0112974286')).toBe('+254112974286')
  })
})

describe('parseWebhookPayload', () => {
  it('parses a standard webhook payload', () => {
    const body = {
      data: {
        transactionId: 'tx_abc123',
        status: 'completed',
        amount: 2500,
        phoneNumber: '+254712345678',
        receipt: 'QHK73G5YZ0',
        accountReference: 'ORD-42',
        timestamp: '2026-08-26T10:00:00Z',
      },
    }

    const result = parseWebhookPayload(body)
    expect(result).toEqual({
      transactionId: 'tx_abc123',
      status: 'completed',
      amount: 2500,
      phoneNumber: '+254712345678',
      receipt: 'QHK73G5YZ0',
      accountReference: 'ORD-42',
      timestamp: '2026-08-26T10:00:00Z',
      raw: body,
    })
  })

  it('parses flat payload format', () => {
    const body = {
      transactionId: 'tx_flat',
      status: 'success',
      amount: 1000,
    }

    const result = parseWebhookPayload(body)
    expect(result.transactionId).toBe('tx_flat')
    expect(result.status).toBe('success')
  })

  it('returns null for null/empty body', () => {
    expect(parseWebhookPayload(null)).toBeNull()
    expect(parseWebhookPayload(undefined)).toBeNull()
  })

  it('handles missing fields gracefully', () => {
    const result = parseWebhookPayload({ data: {} })
    expect(result.transactionId).toBeNull()
    expect(result.status).toBeNull()
    expect(result.amount).toBeNull()
  })
})

describe('verifyWebhookSignature', () => {
  it('returns true for valid signature', () => {
    const secret = 'whsec_test123'
    const payload = '{"transactionId":"tx_123"}'
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    expect(verifyWebhookSignature('{"test":true}', 'invalid_sig', 'secret')).toBe(false)
  })

  it('returns false when secret is missing', () => {
    expect(verifyWebhookSignature('payload', 'sig', '')).toBe(false)
    expect(verifyWebhookSignature('payload', 'sig', null)).toBe(false)
  })

  it('returns false when signature is missing', () => {
    expect(verifyWebhookSignature('payload', '', 'secret')).toBe(false)
    expect(verifyWebhookSignature('payload', null, 'secret')).toBe(false)
  })
})
