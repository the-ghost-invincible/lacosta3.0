import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Header } from './Header'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import './App.css'

const prefixOf = (price) => {
  const m = String(price ?? '').match(/^[^\d]+/)
  return m ? m[0].trim() : "KSh"
}

const formatMoney = (n, prefix = "KSh") => `${prefix} ${n.toLocaleString()}`

export function CartPage() {
  const { items, updateQty, removeFromCart, clearCart, total, parsePrice } = useCart()
  const { user, setPhone, setName } = useAuth()
  const navigate = useNavigate()
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [name, setNameValue] = useState('')
  const [phone, setPhoneValue] = useState('')
  const [nameError, setNameError] = useState(null)
  const [phoneError, setPhoneError] = useState(null)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('mpesa') // 'mpesa' or 'cod'
  const [mpesaBusy, setMpesaBusy] = useState(false)
  const [mpesaError, setMpesaError] = useState(null)
  const [mpesaStatus, setMpesaStatus] = useState(null) // null, 'pending', 'paid', 'failed'
  const [mpesaReceipt, setMpesaReceipt] = useState(null)
  const [checkedOut, setCheckedOut] = useState(false)
  const currency = items.find((i) => /[^\d]/.test(String(i.price ?? '')))
    ? prefixOf(items[0].price)
    : "KSh"

  const placeOrder = () => {
    setOrderPlaced(false)
    if (!user) {
      navigate('/login')
      return
    }
    setNameValue(user.displayName ?? '')
    setPhoneValue(user.phone ?? '')
    setNameError(null)
    setPhoneError(null)
    setPhoneOpen(true)
  }

  const submitOrder = async (e) => {
    e.preventDefault()
    setPhoneBusy(true)
    setNameError(null)
    setPhoneError(null)
    const nameErr = await setName(name)
    const phoneErr = await setPhone(phone)
    if (nameErr) setNameError(nameErr)
    if (phoneErr) setPhoneError(phoneErr)
    if (nameErr || phoneErr) {
      setPhoneBusy(false)
      return
    }
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, items }),
    })
    setPhoneBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setPhoneError(data.error ?? 'Could not place the order — try again')
      return
    }
    const data = await res.json().catch(() => ({}))
    setPhoneOpen(false)
    setOrderId(data.order?.id ?? null)
    setOrderPlaced(true)

    // Auto-initiate M-Pesa if selected
    if (paymentMethod === 'mpesa' && data.order?.id) {
      initiateMpesa(data.order.id)
    }
  }

  const initiateMpesa = async (oid) => {
    setMpesaBusy(true)
    setMpesaError(null)
    setMpesaStatus('pending')
    try {
      const res = await fetch('/api/payments/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: oid, phone: phone || user?.phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMpesaError(data.error ?? 'M-Pesa payment failed')
        setMpesaStatus(null)
      } else {
        // Poll for status
        pollPaymentStatus(data.checkoutRequestId)
      }
    } catch {
      setMpesaError('Network error — try again')
      setMpesaStatus(null)
    }
    setMpesaBusy(false)
  }

  const pollPaymentStatus = async (checkoutRequestId) => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/payments/status/${checkoutRequestId}`)
        const data = await res.json().catch(() => ({}))
        if (data.ResponseCode === '0') {
          setMpesaStatus('paid')
          setMpesaReceipt(data.MpesaReceiptNumber ?? 'N/A')
          return
        }
        if (data.ResponseCode && data.ResponseCode !== '1032') {
          setMpesaStatus('failed')
          setMpesaError(data.ResultDesc ?? 'Payment failed')
          return
        }
      } catch {
        // keep polling
      }
    }
    setMpesaStatus('failed')
    setMpesaError('Payment timed out — check your M-Pesa messages')
  }

  const checkout = () => {
    if (!items.length) return
    if (!confirm('Complete checkout? Your cart will be emptied.')) return
    clearCart()
    setCheckedOut(true)
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your items</p>
            <h2>Shopping cart</h2>
          </div>
        </section>

        {orderPlaced && paymentMethod === 'cod' && (
          <p className="order-success">
            Order placed! We&apos;ll call <strong>{user.phone}</strong> to confirm your delivery{user.displayName ? `, ${user.displayName}` : ''}. Your cart is kept until you check out.
          </p>
        )}
        {orderPlaced && paymentMethod === 'mpesa' && mpesaStatus === 'paid' && (
          <p className="order-success">
            Payment confirmed! M-Pesa receipt: <strong>{mpesaReceipt}</strong>. Your order is being processed.
          </p>
        )}
        {orderPlaced && paymentMethod === 'mpesa' && mpesaStatus === 'pending' && (
          <p className="order-success" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
            Check your phone for the M-Pesa prompt. Enter your PIN to complete payment.
          </p>
        )}
        {orderPlaced && paymentMethod === 'mpesa' && mpesaStatus === 'failed' && (
          <div className="order-success" style={{ background: '#fef2f2', borderColor: '#ef4444' }}>
            <p>Payment failed: {mpesaError}</p>
            <p>Your order is saved. You can try paying again or pay on delivery.</p>
            <button type="button" className="primary-btn" onClick={() => initiateMpesa(orderId)} disabled={mpesaBusy}>
              {mpesaBusy ? 'Retrying...' : 'Retry M-Pesa payment'}
            </button>
          </div>
        )}
        {checkedOut && (
          <p className="order-success">Checkout complete! Your cart has been cleared.</p>
        )}

        {items.length === 0 ? (
          <div className="cart-empty">
            <p>🛒</p>
            <h3>Your cart is empty</h3>
            <p>Add some products to get started.</p>
            <button type="button" className="primary-btn" onClick={() => navigate('/')}>
              Continue shopping
            </button>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {items.map((item) => (
                <article key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} />
                  <div className="cart-item-info">
                    <span className="product-category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <small>{item.seller}</small>
                    <div className="cart-item-controls">
                      <button type="button" onClick={() => updateQty(item.id, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, 1)}>+</button>
                      <button type="button" className="cart-remove" onClick={() => removeFromCart(item.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <strong className="cart-item-price">
                    {formatMoney(parsePrice(item.price) * item.qty, prefixOf(item.price))}
                  </strong>
                </article>
              ))}
            </div>

            <aside className="cart-summary">
              <h3>Order summary</h3>
              <div className="cart-summary-row">
                <span>Items ({items.reduce((s, i) => s + i.qty, 0)})</span>
                <span>{formatMoney(total, currency)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Delivery</span>
                <span>Free</span>
              </div>
              <div className="cart-summary-row cart-summary-total">
                <span>Total</span>
                <span>{formatMoney(total, currency)}</span>
              </div>
              <button type="button" className="primary-btn cart-place-order-btn" onClick={placeOrder}>Place order</button>
              <button
                type="button"
                className={`secondary-btn cart-checkout-btn ${orderPlaced ? 'glow' : ''}`}
                onClick={checkout}
              >Proceed to checkout</button>
              <button type="button" className="secondary-btn cart-clear-btn" onClick={clearCart}>
                Clear cart
              </button>
            </aside>
          </div>
        )}
      </main>

      {phoneOpen && (
        <div className="order-overlay" onClick={() => setPhoneOpen(false)}>
          <form
            className="order-card"
            onSubmit={submitOrder}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Confirm your order</h2>
            <p>Enter your name and phone number so we can confirm your delivery.</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
            {nameError && <p className="error">{nameError}</p>}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="e.g. 0712 345 678"
            />
            {phoneError && <p className="error">{phoneError}</p>}

            <div style={{ margin: '1rem 0' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Payment method</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="payment" value="mpesa" checked={paymentMethod === 'mpesa'} onChange={() => setPaymentMethod('mpesa')} />
                  M-Pesa
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  Pay on delivery
                </label>
              </div>
            </div>

            {paymentMethod === 'mpesa' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted, #666)', marginBottom: '1rem' }}>
                You&apos;ll receive an M-Pesa STK prompt on your phone to complete payment.
              </p>
            )}

            {mpesaError && <p className="error">{mpesaError}</p>}
            <button type="submit" className="primary-btn" disabled={phoneBusy || mpesaBusy}>
              {phoneBusy ? 'Placing…' : mpesaBusy ? 'Processing payment…' : paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Place order'}
            </button>
            <button type="button" className="text-btn" onClick={() => setPhoneOpen(false)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default CartPage