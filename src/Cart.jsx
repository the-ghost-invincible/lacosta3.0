import { Link, useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { useCart } from './CartContext'
import './App.css'

const prefixOf = (price) => {
  const m = String(price ?? '').match(/^[^\d]+/)
  return m ? m[0].trim() : "KSh"
}

const formatMoney = (n, prefix = "KSh") => `${prefix} ${n.toLocaleString()}`

export function CartPage() {
  const { items, updateQty, removeFromCart, clearCart, total, parsePrice } = useCart()
  const navigate = useNavigate()
  const currency = items.find((i) => /[^\d]/.test(String(i.price ?? '')))
    ? prefixOf(items[0].price)
    : "KSh"

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
              <button type="button" className="primary-btn cart-place-order-btn">Place order</button>
              <button type="button" className="secondary-btn cart-checkout-btn">Proceed to checkout</button>
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