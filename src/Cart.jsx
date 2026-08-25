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

const HISTORY_KEY = 'lacosta_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [] } catch { return [] }
}

function saveToHistory(items, total, currency, serverOrderId = null) {
  const history = loadHistory()
  history.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    items: items.map((i) => ({ ...i })),
    total: formatMoney(total, currency),
    orderId: serverOrderId,
  })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

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
  const [paymentMethod, setPaymentMethod] = useState('mpesa')
  const [mpesaBusy, setMpesaBusy] = useState(false)
  const [mpesaError, setMpesaError] = useState(null)
  const [mpesaStatus, setMpesaStatus] = useState(null)
  const [mpesaReceipt, setMpesaReceipt] = useState(null)
  const [checkedOut, setCheckedOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
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
    setBusy(true)
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
      setBusy(false)
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
      setBusy(false)
      return
    }
    const data = await res.json().catch(() => ({}))
    setPhoneOpen(false)
    setOrderId(data.order?.id ?? null)
    setOrderPlaced(true)
    clearCart()

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

  const checkout = async () => {
    if (!items.length) return

    let serverOrderId = null

    if (user && user.phone) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: user.displayName || user.email, phone: user.phone, items }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          serverOrderId = data.order?.id ?? null
        }
      } catch {}
    }

    saveToHistory(items, total, currency, serverOrderId)
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
            Order placed! Your order will be confirmed by a call to <strong>{user.phone}</strong>. Please keep your phone nearby{user.displayName ? `, ${user.displayName}` : ''}. Your cart is kept until you check out.
          </p>
        )}
        {orderPlaced && paymentMethod === 'mpesa' && mpesaStatus === 'paid' && (
          <p className="order-success">
            Payment confirmed! M-Pesa receipt: <strong>{mpesaReceipt}</strong>. Your order is being processed.
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
          <p className="order-success">
            Items saved to your <strong>purchase history</strong>! Your cart has been cleared.{' '}
            Lacosta Markets will call to confirm your delivery location.{' '}
            <button type="button" className="text-btn" onClick={() => navigate('/history')} style={{ textDecoration: 'underline' }}>
              View history
            </button>
          </p>
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
                <article key={item.id} className={`cart-item ${expandedId === item.id ? 'cart-item-expanded' : ''}`}>
                  <img src={item.image} alt={item.name} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ cursor: 'pointer' }} />
                  <div className="cart-item-info">
                    <span className="product-category">{item.category}</span>
                    <h3 onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ cursor: 'pointer' }}>{item.name}</h3>
                    {item.brand && <small className="cart-item-brand">{item.brand}{item.subcategory ? ` · ${item.subcategory}` : ''}</small>}
                    {item.description && <p className="cart-item-description">{item.description}</p>}
                    {Array.isArray(item.specs) && item.specs.length > 0 && (
                      <div className="cart-item-specs">
                        {item.specs.map((spec) => (
                          <span key={spec} className="cart-item-spec">{spec}</span>
                        ))}
                      </div>
                    )}
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
                  {expandedId === item.id && (
                    <div className="cart-item-detail-panel">
                      <div className="cart-item-detail-image">
                        <img src={item.image} alt={item.name} />
                      </div>
                      <div className="cart-item-detail-body">
                        <span className="product-category">{item.category}</span>
                        <h3>{item.name}</h3>
                        {item.brand && <small className="cart-item-brand">{item.brand}{item.subcategory ? ` · ${item.subcategory}` : ''}</small>}
                        <div className="rating-row">
                          {item.rating != null && <span>★ {item.rating}</span>}
                          {item.seller && <span>{item.seller}</span>}
                        </div>
                        <div className="detail-price">
                          <strong>{item.price}</strong>
                          {item.oldPrice && <span>{item.oldPrice}</span>}
                        </div>
                        {item.description && <p className="detail-description">{item.description}</p>}
                        {Array.isArray(item.specs) && item.specs.length > 0 && (
                          <div className="spec-list">
                            {item.specs.map((spec) => (
                              <span key={spec}>{spec}</span>
                            ))}
                          </div>
                        )}
                        <button type="button" className="text-btn" onClick={() => setExpandedId(null)}>Close details</button>
                      </div>
                    </div>
                  )}
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
              <button type="button" className="primary-btn cart-place-order-btn" onClick={placeOrder} disabled={busy}>
                {busy ? 'Processing…' : 'Place order'}
              </button>
              <button type="button" className="secondary-btn cart-checkout-btn glow" onClick={checkout}>Checkout</button>
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

            {mpesaError && <p className="error">{mpesaError}</p>}
            <button type="submit" className="primary-btn" disabled={phoneBusy || mpesaBusy}>
              {phoneBusy ? 'Placing…' : mpesaBusy ? 'Processing payment…' : paymentMethod === 'mpesa' ? 'Pay with M-Pesa' : 'Place order'}
            </button>
            <button type="button" className="text-btn" onClick={() => { setPhoneOpen(false); setBusy(false) }}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default CartPage
