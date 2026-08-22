import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from './AuthContext'
import './App.css'

export function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const err = await forgotPassword(email)
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your account</p>
            <h2>Forgot password</h2>
          </div>
        </section>

        <div className="auth-card">
          {sent ? (
            <>
              <p className="auth-notice">
                If an account exists with <strong>{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Check your inbox and click the link to set a new password. The link expires in 1 hour.
              </p>
              <div className="auth-row" style={{ marginTop: '1.5rem' }}>
                <Link to="/login" className="text-btn">Back to log in</Link>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {error && <p className="error">{error}</p>}

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </label>

              <button type="submit" className="primary-btn auth-submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="auth-switch">
            <Link to="/login" className="text-btn">Back to log in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default ForgotPassword
