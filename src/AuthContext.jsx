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

  // Returns null on success, or an error message
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setUser(data.user)
      return null
    }
    return data.error ?? 'Something went wrong'
  }

  // Returns null on success, or an error message
  const register = async (email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) return null
    return data.error ?? 'Something went wrong'
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
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

  // Returns null on success, or an error message
  const setPhone = async (phone) => {
    const res = await fetch('/api/auth/phone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setUser(data.user)
      return null
    }
    return data.error ?? 'Something went wrong'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUsername, setPhone }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}