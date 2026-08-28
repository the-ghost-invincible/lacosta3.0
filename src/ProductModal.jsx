import { useState, useEffect, useRef, useCallback } from 'react'
import { useCart } from './CartContext'
import './App.css'

export function ProductModal({ product, onClose }) {
  const { addToCart, reservedQty } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const touchStart = useRef(null)
  const timerRef = useRef(null)

  const images = product ? (product.images?.length ? product.images : (product.image ? [product.image] : [])) : []
  const hasMany = images.length > 1

  const stopAutoPlay = useCallback(() => {
    setAutoPlay(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (!hasMany || !autoPlay) return
    timerRef.current = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % images.length)
    }, 3000)
    return () => clearInterval(timerRef.current)
  }, [hasMany, autoPlay, images.length])

  useEffect(() => {
    if (!product) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (!hasMany) return
      stopAutoPlay()
      if (e.key === 'ArrowLeft') setCurrentIdx((i) => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setCurrentIdx((i) => (i + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, hasMany, images.length, onClose, stopAutoPlay])

  useEffect(() => {
    setCurrentIdx(0)
    setAutoPlay(true)
  }, [product?.id])

  if (!product) return null

  const remaining = (product.quantity ?? 0) - reservedQty(product.id)
  const soldOut = product.outOfStock || remaining <= 0

  const handleAdd = () => {
    if (soldOut) return
    addToCart(product)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  const goTo = (idx) => {
    stopAutoPlay()
    setCurrentIdx(idx)
  }

  const goPrev = () => {
    stopAutoPlay()
    setCurrentIdx((i) => (i - 1 + images.length) % images.length)
  }

  const goNext = () => {
    stopAutoPlay()
    setCurrentIdx((i) => (i + 1) % images.length)
  }

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStart.current == null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      stopAutoPlay()
      if (diff > 0) setCurrentIdx((i) => (i + 1) % images.length)
      else setCurrentIdx((i) => (i - 1 + images.length) % images.length)
    }
    touchStart.current = null
  }

  return (
    <div className="product-modal-overlay" onClick={onClose}>
      <div className="product-modal" role="dialog" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="product-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div
          className="product-modal-image"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {hasMany ? (
            <div className="carousel">
              <div className="carousel-track" style={{ transform: `translateX(-${currentIdx * 100}%)` }}>
                {images.map((src, idx) => (
                  <img key={idx} src={src} alt={`${product.name} ${idx + 1}`} loading="lazy" />
                ))}
              </div>
              <button type="button" className="carousel-btn carousel-prev" onClick={goPrev} aria-label="Previous image">‹</button>
              <button type="button" className="carousel-btn carousel-next" onClick={goNext} aria-label="Next image">›</button>
              <div className="carousel-dots">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`carousel-dot ${idx === currentIdx ? 'active' : ''}`}
                    onClick={() => goTo(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <img src={images[0]} alt={product.name} loading="lazy" />
          )}
          {soldOut && <span className="product-badge" style={{ background: '#dc2626', color: '#fff' }}>Out of stock</span>}
        </div>

        <div className="product-modal-body">
          <div className="product-modal-sticky-header">
            {product.category && <span className="product-category">{product.category}</span>}
            <h3>{product.name}</h3>

            <div className="rating-row">
              {product.rating != null && <span>★ {product.rating}</span>}
              {product.seller && <span>{product.seller}</span>}
            </div>

            <div className="detail-price">
              <strong>{product.price}</strong>
              {product.oldPrice && <span>{product.oldPrice}</span>}
            </div>
            {product.unitPrice && <div className="unit-price" style={{ marginTop: '-2px' }}>@ {product.unitPrice}</div>}

            <span className={`detail-badge ${soldOut ? 'out-of-stock' : ''}`}>
              {soldOut ? 'Out of stock' : `In stock (${remaining})`}
            </span>

            <button type="button" className="primary-btn product-modal-add" disabled={soldOut} onClick={handleAdd}>
              {justAdded ? 'Added ✓' : soldOut ? 'Out of stock' : 'Add to cart'}
            </button>
            {!soldOut && remaining > 0 && (
              <span className="stock-info">{remaining} in stock</span>
            )}
          </div>

          <div className="product-modal-scroll-content">
            {product.description && <p className="detail-description">{product.description}</p>}

            {Array.isArray(product.specs) && product.specs.length > 0 && (
              <div className="spec-list">
                {product.specs.map((spec) => (
                  <span key={spec}>{spec}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductModal
