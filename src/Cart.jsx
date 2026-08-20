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
    setPhoneOpen(false)
    setOrderPlaced(true)
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

        {orderPlaced && (
          <p className="order-success">
            Order placed! We&apos;ll call <strong>{user.phone}</strong> to confirm your delivery{user.displayName ? `, ${user.displayName}` : ''}. Your cart is kept until you check out.
          </p>
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
            <button type="submit" className="primary-btn" disabled={phoneBusy}>
              {phoneBusy ? 'Placing…' : 'Place order'}
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