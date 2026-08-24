import { useState } from 'react'
import { useCart } from './CartContext'
import './App.css'

export function ProductModal({ product, onClose }) {
  const { addToCart } = useCart()
  const [justAdded, setJustAdded] = useState(false)

  if (!product) return null

  const handleAdd = () => {
    addToCart(product)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  return (
    <div className="product-modal-overlay" onClick={onClose}>
      <div className="product-modal" role="dialog" aria-label={product.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="product-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="product-modal-image">
          <img src={product.image} alt={product.name} />
          {product.outOfStock && <span className="product-badge" style={{ background: '#dc2626', color: '#fff' }}>Out of stock</span>}
        </div>

        <div className="product-modal-body">
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

          <span className={`detail-badge ${product.outOfStock ? 'out-of-stock' : ''}`}>
            {product.outOfStock ? 'Out of stock' : (product.quantity ?? 0) > 0 ? `In stock (${product.quantity})` : 'In stock'}
          </span>

          {product.description && <p className="detail-description">{product.description}</p>}

          {Array.isArray(product.specs) && product.specs.length > 0 && (
            <div className="spec-list">
              {product.specs.map((spec) => (
                <span key={spec}>{spec}</span>
              ))}
            </div>
          )}

          <button type="button" className="primary-btn product-modal-add" disabled={product.outOfStock} onClick={handleAdd}>
            {justAdded ? 'Added ✓' : product.outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
          {!product.outOfStock && (product.quantity ?? 0) > 0 && (
            <span className="stock-info">{product.quantity} in stock</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductModal