import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Header } from './Header'
import { useCart } from './CartContext'
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

function saveToHistory(items, total, currency) {
  const history = loadHistory()
  history.unshift({
    id: Date.now(),
    date: new Date().toISOString(),
    items: items.map((i) => ({ ...i })),
    total: formatMoney(total, currency),
  })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function CartPage() {
  const { items, updateQty, removeFromCart, clearCart, total, parsePrice } = useCart()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState(null)
  const [checkedOut, setCheckedOut] = useState(false)
  const currency = items.find((i) => /[^\d]/.test(String(i.price ?? '')))
    ? prefixOf(items[0].price)
    : "KSh"

  const checkout = () => {
    if (!items.length) return
    if (!confirm('Save these items to your purchase history and clear the cart?')) return
    saveToHistory(items, total, currency)
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

        {checkedOut && (
          <p className="order-success">
            Items saved to your <strong>purchase history</strong>! Your cart has been cleared.{' '}
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
              <button type="button" className="primary-btn cart-place-order-btn glow" onClick={checkout}>
                Checkout
              </button>
              <button type="button" className="secondary-btn cart-clear-btn" onClick={clearCart}>
                Clear cart
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

export default CartPage
