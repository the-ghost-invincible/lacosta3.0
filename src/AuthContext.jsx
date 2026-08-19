import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = () => {
    window.location.href = '/api/auth/google'
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  const switchAccount = () => {
    fetch('/api/auth/logout', { method: 'POST' }).then(login)
  }

  // Returns null on success, or an error message
  const setUsername = async (username) => {
    const res = await fetch('/api/auth/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    const data = await res.json()
    if (res.ok) {
      setUser(data.user)
      return null
    }
    return data.error ?? 'Something went wrong'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchAccount, setUsername }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}