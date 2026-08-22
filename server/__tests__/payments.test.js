import { describe, it, expect } from 'vitest'
import { parseCallback, isConfigured } from '../payments.js'

describe('parseCallback', () => {
  it('parses a successful M-Pesa callback', () => {
    const body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mr-001',
          CheckoutRequestID: 'ws_CO_123',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1000 },
              { Name: 'MpesaReceiptNumber', Value: 'QHK73G5YZ0' },
              { Name: 'Balance', Value: 0 },
              { Name: 'TransactionDate', Value: 20260821190000 },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    }

    const result = parseCallback(body)
    expect(result).toEqual({
      merchantRequestId: 'mr-001',
      checkoutRequestId: 'ws_CO_123',
      resultCode: 0,
      resultDesc: 'Success',
      amount: 1000,
      mpesaReceiptNumber: 'QHK73G5YZ0',
      balance: 0,
      transactionDate: 20260821190000,
      phoneNumber: 254712345678,
    })
  })

  it('returns null for invalid body', () => {
    expect(parseCallback(null)).toBeNull()
    expect(parseCallback({})).toBeNull()
    expect(parseCallback({ Body: {} })).toBeNull()
  })

  it('handles failed callback (ResultCode != 0)', () => {
    const body = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mr-002',
          CheckoutRequestID: 'ws_CO_456',
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
        },
      },
    }

    const result = parseCallback(body)
    expect(result.resultCode).toBe(1032)
    expect(result.mpesaReceiptNumber).toBeUndefined()
  })
})

describe('isConfigured', () => {
  it('returns false when env vars are missing', () => {
    // In test env, MPESA vars are not set
    expect(isConfigured()).toBe(false)
  })
})
