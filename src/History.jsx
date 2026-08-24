import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { useCart } from './CartContext'
import './App.css'

const HISTORY_KEY = 'lacosta_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [] } catch { return [] }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const removeEntry = (id) => {
    if (!confirm('Remove this entry from history?')) return
    const next = history.filter((h) => h.id !== id)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  const clearAll = () => {
    if (!confirm('Clear entire purchase history?')) return
    clearHistory()
    setHistory([])
  }

  const reorder = (entry) => {
    entry.items.forEach((item) => {
      for (let i = 0; i < (item.qty ?? 1); i++) {
        addToCart(item)
      }
    })
    navigate('/cart')
  }

  const fmtDate = (iso) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="page-shell">
      <Header />
      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your purchases</p>
            <h2>Purchase history</h2>
          </div>
          {history.length > 0 && (
            <button type="button" className="secondary-btn" onClick={clearAll}>Clear all</button>
          )}
        </section>

        {history.length === 0 ? (
          <div className="cart-empty">
            <p>📋</p>
            <h3>No purchase history</h3>
            <p>Items you checkout will appear here.</p>
            <button type="button" className="primary-btn" onClick={() => navigate('/')}>
              Start shopping
            </button>
          </div>
        ) : (
          <div className="order-history-list">
            {history.map((entry) => (
              <div key={entry.id} className="order-history-card">
                <div className="order-history-head">
                  <div>
                    <strong>Purchase</strong>
                    <span className="muted" style={{ marginLeft: '8px' }}>{fmtDate(entry.date)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn ghost small" onClick={() => reorder(entry)}>Reorder</button>
                    <button type="button" className="btn danger small" onClick={() => removeEntry(entry.id)}>✕</button>
                  </div>
                </div>
                <div className="order-history-items">
                  {(entry.items ?? []).map((item, idx) => (
                    <div key={idx} className="order-history-item">
                      {item.image && <img src={item.image} alt="" className="order-history-img" />}
                      <div>
                        <span>{item.name}</span>
                        <span className="muted"> x{item.qty ?? 1}</span>
                      </div>
                      <strong>{item.price}</strong>
                    </div>
                  ))}
                </div>
                <div className="order-history-total">
                  <span>Total</span>
                  <strong>{entry.total}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default HistoryPage
