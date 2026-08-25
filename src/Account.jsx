import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from './AuthContext'
import './App.css'

const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', canceled: 'Canceled', delivered: 'Delivered' }
const PAYMENT_LABELS = { pending: 'Unpaid', paid: 'Paid', failed: 'Failed' }

export function AccountPage() {
  const { user, loading, logout, resendVerification } = useAuth()
  const navigate = useNavigate()
  const [verifyMsg, setVerifyMsg] = useState(null)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [orders, setOrders] = useState([])

  useEffect(() => {
    if (user) {
      fetch('/api/orders/mine', { credentials: 'include' })
        .then((res) => res.json())
        .then((d) => setOrders(d.orders ?? []))
        .catch(() => {})
    }
  }, [user])

  const cancelOrder = async (orderId) => {
    if (!confirm('Cancel this order?')) return
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'canceled' }),
      })
      if (res.ok) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'canceled' } : o))
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Header />
        <main className="container page-content">
          <p>Checking…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-shell">
        <Header />
        <main className="container page-content">
          <section className="section-header">
            <div>
              <p className="eyebrow">Your account</p>
              <h2>Sign in</h2>
            </div>
          </section>
          <div className="account-card">
            <p>Log in with your email and password to see your account, orders and saved items.</p>
            <button type="button" className="primary-btn" onClick={() => navigate('/login')}>Log in</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <Header />
      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your account</p>
            <h2>@{user.username ?? 'Pick a username'}</h2>
          </div>
        </section>

        <div className="account-card">
          {user.verified === false && (
            <div className="verify-banner">
              <p>Please verify your email address.</p>
              {verifyMsg ? (
                <span>{verifyMsg}</span>
              ) : (
                <button
                  type="button"
                  className="text-btn"
                  disabled={verifyBusy}
                  onClick={async () => {
                    setVerifyBusy(true)
                    const err = await resendVerification()
                    setVerifyBusy(false)
                    setVerifyMsg(err ? err : 'Verification email sent! Check your inbox.')
                  }}
                >
                  {verifyBusy ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}

          <div className="account-profile">
            {user.avatar && <img src={user.avatar} alt="" />}
            <div>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
              <span className="account-username">@{user.username ?? 'no username yet'}</span>
            </div>
          </div>

          <div className="account-actions">
            <button type="button" className="primary-btn" onClick={() => navigate('/')}>Continue shopping</button>
            <button type="button" className="secondary-btn" onClick={logout}>Log out</button>
          </div>
        </div>

        <section className="order-history">
          <h2>Order History</h2>
          {orders.length === 0 ? (
            <p className="muted">You haven't placed any orders yet.</p>
          ) : (
            <div className="order-history-list">
              {orders.map((order) => (
                <div key={order.id} className="order-history-card">
                  <div className="order-history-head">
                    <div>
                      <strong>Order #{order.id}</strong>
                      <span className="muted" style={{ marginLeft: '8px' }}>
                        {new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="order-history-badges">
                      <span className={`status-badge status-${order.status}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <span className={`status-badge payment-${order.payment_status ?? 'pending'}`}>
                        {PAYMENT_LABELS[order.payment_status ?? 'pending'] ?? order.payment_status}
                      </span>
                      {order.status !== 'canceled' && order.status !== 'delivered' && (
                        <button type="button" className="btn danger small" onClick={() => cancelOrder(order.id)}>Cancel</button>
                      )}
                    </div>
                  </div>
                  <div className="order-history-items">
                    {(order.items ?? []).map((item, idx) => (
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
                    <strong>{order.total}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}