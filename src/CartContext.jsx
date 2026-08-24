import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { parsePrice } from './utils'

const CartContext = createContext(null)
const STORAGE_KEY = 'lacosta-cart'

const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const { user, loading } = useAuth()
  const [items, setItems] = useState([])
  const [ready, setReady] = useState(false)
  const prevUserRef = useRef(null)

  // Load the right cart whenever the auth state changes:
  // logged in   -> the user's saved cart from the server
  // just logged out -> basket resets to empty
  // fresh guest -> guest cart kept in localStorage
  useEffect(() => {
    if (loading) return
    let cancelled = false
    const wasSignedIn = Boolean(prevUserRef.current)
    prevUserRef.current = user
    if (user) {
      fetch('/api/cart')
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return
          const serverItems = Array.isArray(data.items) ? data.items : []
          // Keep the guest's items when the account cart is empty, so items
          // added before signing up are preserved on the account.
          const merged = serverItems.length ? serverItems : loadCart()
          setItems(merged)
          setReady(true)
        })
        .catch(() => {
          if (cancelled) return
          setItems(loadCart())
          setReady(true)
        })
    } else {
      if (wasSignedIn) {
        localStorage.removeItem(STORAGE_KEY)
        setItems([])
      } else {
        setItems(loadCart())
      }
      setReady(true)
    }
    return () => {
      cancelled = true
    }
  }, [user, loading])

  // Persist changes immediately: to the server when signed in, and always to
  // localStorage as a mirror (covers page reloads and expired sessions).
  useEffect(() => {
    if (!ready) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    if (user) {
      fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).catch(() => {})
    }
  }, [items, user, ready])

  const addToCart = (product) => {
    if (product.outOfStock) return
    const snapshot = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      seller: product.seller,
      description: product.description ?? '',
      specs: product.specs ?? [],
      brand: product.brand ?? '',
      oldPrice: product.oldPrice ?? '',
      subcategory: product.subcategory ?? '',
      rating: product.rating,
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { ...snapshot, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    )
  }

  const removeFromCart = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const clearCart = () => setItems([])

  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const total = items.reduce(
    (sum, i) => sum + parsePrice(i.price) * i.qty,
    0
  )

  const cartQty = (productId) => {
    const item = items.find((i) => i.id === productId)
    return item ? item.qty : 0
  }

  const value = {
    items,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    count,
    total,
    parsePrice,
    cartQty,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}