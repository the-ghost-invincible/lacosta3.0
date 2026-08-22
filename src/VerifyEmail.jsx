import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Header } from './Header'
import './App.css'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setStatus(data.ok ? 'success' : 'invalid'))
      .catch(() => setStatus('invalid'))
  }, [token])

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Your account</p>
            <h2>Email verification</h2>
          </div>
        </section>

        <div className="auth-card">
          {status === 'loading' && <p>Verifying your email…</p>}

          {status === 'success' && (
            <>
              <p className="auth-notice">Your email has been verified!</p>
              <div className="auth-row" style={{ marginTop: '1rem' }}>
                <Link to="/login" className="text-btn">Log in</Link>
              </div>
            </>
          )}

          {status === 'invalid' && (
            <>
              <p className="error">Invalid or expired verification link.</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                The link may have expired. Log in and resend a new verification email.
              </p>
              <div className="auth-row" style={{ marginTop: '1rem' }}>
                <Link to="/login" className="text-btn">Log in</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default VerifyEmail
