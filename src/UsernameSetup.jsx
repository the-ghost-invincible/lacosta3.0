import { useState } from 'react'
import { useAuth } from './AuthContext'

export function UsernameSetup() {
  const { user, setUsername, logout } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!user || user.username) return null

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await setUsername(value)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="username-overlay">
      <form className="username-card" onSubmit={submit}>
        <h2>Welcome{user.displayName ? `, ${user.displayName}` : ''}!</h2>
        <p>Pick a username to finish creating your Lacosta account.</p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username"
          autoFocus
          maxLength={20}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button type="button" className="text-btn" onClick={logout}>
          Log out
        </button>
      </form>
    </div>
  )
}