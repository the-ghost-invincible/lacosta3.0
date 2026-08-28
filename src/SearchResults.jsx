import { useSearchParams } from 'react-router-dom'
import { Header } from './Header'
import { useSiteData } from './useSiteData'
import { useCart } from './CartContext'
import { ProductModal } from './ProductModal'
import { useState, useMemo } from 'react'
import { normalize, parsePrice } from './utils'
import './App.css'

export function SearchResults() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { catalogProducts } = useSiteData()
  const { addToCart } = useCart()
  const [justAddedId, setJustAddedId] = useState(null)
  const [modalProduct, setModalProduct] = useState(null)
  const [sort, setSort] = useState('Popular')

  const handleAdd = (product) => {
    addToCart(product)
    setJustAddedId(product.id)
    setTimeout(() => setJustAddedId((cur) => (cur === product.id ? null : cur)), 1200)
  }

  const results = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return catalogProducts.filter(
      (p) =>
        normalize(p.name).includes(q) ||
        normalize(p.brand).includes(q) ||
        normalize(p.category).includes(q) ||
        normalize(p.description).includes(q) ||
        (p.specs ?? []).some((s) => normalize(s).includes(q))
    )
  }, [query, catalogProducts])

  const sorted = useMemo(() => {
    const list = [...results]
    if (sort === 'Newest') list.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    else if (sort === 'Price: Low to High') list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price))
    return list
  }, [results, sort])

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="section-header">
          <div>
            <p className="eyebrow">Search results</p>
            <h2>{query ? `Results for "${query}"` : 'All products'}</h2>
          </div>
          <span>{sorted.length} product{sorted.length !== 1 ? 's' : ''}</span>
        </section>

        <div className="catalog-toolbar">
          {['Popular', 'Newest', 'Price: Low to High'].map((label) => (
            <button
              key={label}
              type="button"
              className={`filter-chip ${sort === label ? 'active' : ''}`}
              onClick={() => setSort(label)}
            >
              {label}
            </button>
          ))}
        </div>

        {sorted.length > 0 ? (
          <div className="catalog-grid">
            {sorted.map((product) => (
              <article
                key={product.id}
                className="product-card catalog-card"
                onClick={() => setModalProduct(product)}
              >
                <div className="card-image-wrap">
                  <img src={product.image} alt={product.name} loading="lazy" />
                </div>
                <div className="card-body">
                  <span className="product-category">{product.category}</span>
                  <h3>{product.name}</h3>
                  <div className="rating-row">
                    <span>★ {product.rating}</span>
                    <span>{product.seller}</span>
                  </div>
                  <div className="price-row">
                    <strong>{product.price}</strong>
                    <span>{product.oldPrice}</span>
                  </div>
                  {product.unitPrice && <div className="unit-price">@ {product.unitPrice}</div>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleAdd(product) }}>
                    {justAddedId === product.id ? 'Added ✓' : 'Add to cart'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {query ? `No products found for "${query}". Try a different search.` : 'Start typing to search products.'}
          </p>
        )}
      </main>

      <footer className="site-footer"></footer>

      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
    </div>
  )
}
