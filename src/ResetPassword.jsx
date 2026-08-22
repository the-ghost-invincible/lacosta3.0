import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from './AuthContext'
import './App.css'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { resetPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    const err = await resetPassword(token, password)
    setBusy(false)
    if (err) setError(err)
    else setDone(true)
  }

  if (!token) {
    return (
      <div className="page-shell">
        <Header />
        <main className="container page-content">
          <div className="auth-card">
            <p className="error">Invalid reset link. Please request a new one.</p>
            <p className="auth-switch">
              <Link to="/forgot-password" className="text-btn">Forgot password</Link>
            </p>
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
            <h2>Set new password</h2>
          </div>
        </section>

        <div className="auth-card">
          {done ? (
            <>
              <p className="auth-notice">Your password has been reset.</p>
              <div className="auth-row" style={{ marginTop: '1rem' }}>
                <Link to="/login" className="text-btn">Log in with new password</Link>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              {error && <p className="error">{error}</p>}

              <label className="form-field">
                <span>New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoFocus
                  required
                />
              </label>

              <label className="form-field">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                />
              </label>

              <button type="submit" className="primary-btn auth-submit" disabled={busy}>
                {busy ? 'Resetting…' : 'Reset password'}
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

export default ResetPassword
