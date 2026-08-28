import { Header, CategoryNavigation } from './Header'
import { useSiteData } from './useSiteData'
import { useCart } from './CartContext'
import { ProductModal } from './ProductModal'
import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parsePrice } from './utils'
import './App.css'

export function Home() {
  const { catalogProducts, featuredProducts, deals, trendingProducts, benefits, siteContent } = useSiteData()
  const { addToCart, reservedQty } = useCart()
  const navigate = useNavigate()
  const [selectedProductId, setSelectedProductId] = useState(catalogProducts[0]?.id ?? null)
  const [justAddedId, setJustAddedId] = useState(null)
  const [modalProduct, setModalProduct] = useState(null)
  const [sort, setSort] = useState('Popular')
  const catalogRef = useRef(null)

  const currentProduct = catalogProducts.find((product) => product.id === selectedProductId) ?? catalogProducts[0]

  const sortedProducts = useMemo(() => {
    const list = [...catalogProducts]
    if (sort === 'Newest') list.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    else if (sort === 'Price: Low to High') list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price))
    return list
  }, [catalogProducts, sort])

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleAdd = (product) => {
    addToCart(product)
    setJustAddedId(product.id)
    setTimeout(() => setJustAddedId((cur) => (cur === product.id ? null : cur)), 1200)
  }

  const handleBuyNow = (product) => {
    addToCart(product)
    navigate('/cart')
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">{siteContent.hero.eyebrow}</p>
            <h1>{siteContent.hero.title}</h1>
            <p className="hero-text">
              {siteContent.hero.text}
            </p>

            <div className="hero-actions">
              <button type="button" className="primary-btn" onClick={scrollToCatalog}>Shop now</button>
              <button type="button" className="secondary-btn" onClick={scrollToCatalog}>Browse deals</button>
            </div>

            <div className="mini-stats" aria-label="store metrics">
              {siteContent.hero.stats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-label="Promoted product panel">
            <div className="feature-card large">
              <img
                src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"
                alt="Smartwatch promotion"
              />
              <div className="floating-badge">Up to 45% off</div>
            </div>
            <div className="mini-stack">
              <div className="feature-card small">
                <span>Best sellers</span>
                <strong>Smart devices</strong>
              </div>
              <div className="feature-card small accent-box">
                <span>Weekend flash</span>
                <strong>KSh 7,500</strong>
              </div>
            </div>
          </div>
        </section>

        <CategoryNavigation />

        <section className="section-header">
          <div>
            <p className="eyebrow">Top picks</p>
            <h2>Featured deals</h2>
          </div>
          <a href="#all-products" onClick={(e) => { e.preventDefault(); scrollToCatalog() }}>View all</a>
        </section>

        <section className="deal-banner-row" aria-label="Special deals">
          {deals.map((deal) => (
            <article key={deal.title} className="deal-banner">
              <span>{deal.title}</span>
              <strong>{deal.subtitle}</strong>
            </article>
          ))}
        </section>

        <section className="product-grid">
          {featuredProducts.map((product) => {
            const remaining = (product.quantity ?? 0) - reservedQty(product.id)
            const soldOut = product.outOfStock || remaining <= 0
            return (
            <article key={product.id} className="product-card" onClick={() => setModalProduct(product)}>
              <div className="card-image-wrap">
                <img src={product.image} alt={product.name} loading="lazy" />
                {soldOut ? (
                  <span className="product-badge" style={{ background: '#dc2626', color: '#fff' }}>Out of stock</span>
                ) : (
                  <span className="product-badge">{product.badge}</span>
                )}
              </div>
              <div className="card-body">
                <h3>{product.name}</h3>
                <div className="price-row">
                  <strong>{product.price}</strong>
                  <span>{product.oldPrice}</span>
                </div>
                {product.unitPrice && <div className="unit-price">@ {product.unitPrice}</div>}
                {!soldOut && remaining > 0 && (
                  <span className={remaining <= 5 ? 'stock-low' : 'stock-info'}>{remaining} in stock</span>
                )}
                <button type="button" disabled={soldOut} onClick={(event) => { event.stopPropagation(); handleAdd(product) }}>{justAddedId === product.id ? "Added ✓" : soldOut ? "Out of stock" : "Add to cart"}</button>
              </div>
            </article>
            )
          })}
        </section>

        <section className="catalog-layout" ref={catalogRef}>
          <div className="catalog-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Shop by category</p>
                <h2>All</h2>
              </div>
              <a href="#all-products" onClick={(e) => { e.preventDefault(); scrollToCatalog() }}>Filter</a>
            </div>

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

            <div className="catalog-grid">
              {sortedProducts.map((product) => {
                const remaining = (product.quantity ?? 0) - reservedQty(product.id)
                const soldOut = product.outOfStock || remaining <= 0
                return (
                <article
                  key={product.id}
                  className={`product-card catalog-card ${currentProduct.id === product.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedProductId(product.id); setModalProduct(product) }}
                >
                  <div className="card-image-wrap">
                    <img src={product.image} alt={product.name} loading="lazy" />
                    {soldOut ? (
                      <span className="product-badge" style={{ background: '#dc2626', color: '#fff' }}>Out of stock</span>
                    ) : product.badge ? (
                      <span className="product-badge">{product.badge}</span>
                    ) : null}
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
                    {!soldOut && remaining > 0 && remaining <= 5 && (
                      <span className="stock-low">Only {remaining} left</span>
                    )}
                    <button type="button" disabled={soldOut} onClick={(event) => { event.stopPropagation(); handleAdd(product) }}>{justAddedId === product.id ? "Added ✓" : soldOut ? "Out of stock" : "Add to cart"}</button>
                    {!soldOut && remaining > 0 && (
                      <span className="stock-info">{remaining} in stock</span>
                    )}
                  </div>
                </article>
                )
              })}
            </div>
          </div>

          <aside className="detail-panel">
            {currentProduct ? (() => {
              const curRemaining = (currentProduct.quantity ?? 0) - reservedQty(currentProduct.id)
              const curSoldOut = currentProduct.outOfStock || curRemaining <= 0
              return (
            <>
            <div className="detail-image-wrap">
              <img src={currentProduct.image} alt={currentProduct.name} loading="lazy" />
            </div>

            <div className="detail-meta">
              <span className={`detail-badge ${curSoldOut ? 'out-of-stock' : ''}`}>{curSoldOut ? 'Out of stock' : `In stock (${curRemaining})`}</span>
              <span className="detail-rating">★ {currentProduct.rating}</span>
            </div>

            <h3>{currentProduct.name}</h3>
            <div className="detail-price">
              <strong>{currentProduct.price}</strong>
              <span>{currentProduct.oldPrice}</span>
            </div>
            {currentProduct.unitPrice && <div className="unit-price" style={{ marginTop: '-4px' }}>@ {currentProduct.unitPrice}</div>}

            <p className="detail-description">{currentProduct.description}</p>

            <div className="spec-list">
              {currentProduct.specs.map((spec) => (
                <span key={spec}>{spec}</span>
              ))}
            </div>

            <div className="detail-actions">
              <button type="button" className="primary-btn" disabled={curSoldOut} onClick={() => handleAdd(currentProduct)}>{justAddedId === currentProduct.id ? "Added ✓" : curSoldOut ? "Out of stock" : "Add to cart"}</button>
              <button type="button" className="secondary-btn" disabled={curSoldOut} onClick={() => handleBuyNow(currentProduct)}>Buy now</button>
            </div>
            {!curSoldOut && curRemaining > 0 && (
              <span className="stock-info">{curRemaining} in stock</span>
            )}

            <div className="seller-box">
              <div>
                <p className="eyebrow small-eyebrow">Sold by</p>
                <strong>{currentProduct.seller}</strong>
              </div>
              <span>Verified seller</span>
            </div>
            </>
              )
            })() : <p style={{padding:'2rem',color:'#888'}}>Select a product to view details</p>}
          </aside>
        </section>

        <section className="trending-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Popular now</p>
              <h2>Trending items</h2>
            </div>
            <a href="#all-products" onClick={(e) => { e.preventDefault(); scrollToCatalog() }}>See more</a>
          </div>

          <div className="mini-product-grid">
            {trendingProducts.map((product) => (
              <article key={product.name} className="mini-product-card" onClick={() => setModalProduct(product)}>
                <img src={product.image} alt={product.name} loading="lazy" />
                <div>
                  <h3>{product.name}</h3>
                  <strong>{product.price}</strong>
                  {product.unitPrice && <div className="unit-price" style={{ fontSize: '0.7rem' }}>@ {product.unitPrice}</div>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="value-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Why us</p>
              <h2>Trusted marketplace experience</h2>
            </div>
          </div>

          <div className="value-list">
            {benefits.map((item) => (
              <div key={item} className="value-item">
                <span>✓</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer"></footer>

      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
    </div>
  )
}
