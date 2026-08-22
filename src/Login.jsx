import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from './AuthContext'
import './App.css'

export function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)
  const [resendMsg, setResendMsg] = useState(null)
  const [resendBusy, setResendBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setNeedsVerify(false)
    setResendMsg(null)

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setBusy(true)
    if (mode === 'login') {
      const err = await login(email, password)
      setBusy(false)
      if (err) {
        if (err.includes('verify')) {
          setNeedsVerify(true)
        }
        setError(err)
      } else navigate('/account')
    } else {
      const err = await register(email, password)
      setBusy(false)
      if (err) setError(err)
      else {
        setNotice('Account created! Check your email to verify your account, then log in.')
        setPassword('')
        setConfirm('')
        setMode('login')
      }
    }
  }

  const resendVerification = async () => {
    setResendBusy(true)
    setResendMsg(null)
    try {
      const res = await fetch('/api/auth/verify/resend-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      setResendMsg('Verification email sent! Check your inbox.')
    } catch {
      setResendMsg('Could not send email. Try again.')
    }
    setResendBusy(false)
  }

  const switchMode = (next) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setNeedsVerify(false)
    setResendMsg(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your account</p>
            <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
          </div>
        </section>

        <div className="auth-card">
          <form onSubmit={submit}>
            {notice && <p className="auth-notice">{notice}</p>}
            {error && <p className="error">{error}</p>}
            {needsVerify && (
              <div className="verify-banner" style={{ marginTop: '0.5rem' }}>
                {resendMsg ? (
                  <span>{resendMsg}</span>
                ) : (
                  <button
                    type="button"
                    className="text-btn"
                    disabled={resendBusy}
                    onClick={resendVerification}
                  >
                    {resendBusy ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

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

            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                required
              />
            </label>

            {mode === 'login' && (
              <div className="auth-row">
                <Link to="/forgot-password" className="text-btn">Forgot password?</Link>
              </div>
            )}

            {mode === 'register' && (
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
            )}

            <button type="submit" className="primary-btn auth-submit" disabled={busy}>
              {busy ? (mode === 'login' ? 'Logging in…' : 'Creating…') : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="text-btn" onClick={() => switchMode('register')}>
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="text-btn" onClick={() => switchMode('login')}>
                  Log in
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}

export default LoginPage