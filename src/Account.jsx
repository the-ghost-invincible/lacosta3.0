import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { useAuth } from './AuthContext'
import './App.css'

export function AccountPage() {
  const { user, loading, logout, resendVerification } = useAuth()
  const navigate = useNavigate()
  const [verifyMsg, setVerifyMsg] = useState(null)
  const [verifyBusy, setVerifyBusy] = useState(false)

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
      </main>
    </div>
  )
}