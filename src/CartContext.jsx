import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'lacosta-cart'

const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

// Prices are display strings like "KSh 1,200,000" — reduce to a number
const parsePrice = (price) => Number(String(price ?? '').replace(/[^\d]/g, '')) || 0

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToCart = (product) => {
    const snapshot = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      seller: product.seller
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

  const value = {
    items,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    count,
    total,
    parsePrice
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}