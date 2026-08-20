import { useParams, useSearchParams } from 'react-router-dom'
import { Header, CategoryNavigation } from './Header'
import { useSiteData } from './useSiteData'
import { useCart } from './CartContext'
import { ProductModal } from './ProductModal'
import { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'

const parsePrice = (price) => Number(String(price ?? '').replace(/[^\d]/g, '')) || 0

export function CategoryPage() {
  const { categorySlug } = useParams()
  const [searchParams] = useSearchParams()
  const detailRef = useRef(null)
  const catalogRef = useRef(null)
  const { categories, catalogProducts, deals, trendingProducts, categoryMenus } = useSiteData()
  const { addToCart } = useCart()
  const [justAddedId, setJustAddedId] = useState(null)

  const handleAdd = (product) => {
    addToCart(product)
    setJustAddedId(product.id)
    setTimeout(() => setJustAddedId((cur) => (cur === product.id ? null : cur)), 1200)
  }
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedBrand, setSelectedBrand] = useState('All')
  const [openMenu, setOpenMenu] = useState(null) // For dropdown menu
  const [sort, setSort] = useState('Popular')
  const [modalProduct, setModalProduct] = useState(null)

  // Deep link from the search bar: ?p=<productId> selects that product
  const productParam = searchParams.get('p')
  // ...or ?g=<GroupName> jumps straight to a subcategory menu group
  const groupParam = searchParams.get('g')
  // ...and ?i=<ItemName> (optional) selects a specific menu item inside that group
  const itemParam = searchParams.get('i')

  useEffect(() => {
    if (productParam) {
      setSelectedProductId(Number(productParam))
      if (detailRef.current && window.innerWidth <= 980) {
        setTimeout(() => detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
      }
    }
  }, [productParam])

  // Get category info by matching slug
  const categoryInfo = categories.find(
    (cat) => cat.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-') === categorySlug
  )

  // Get the actual category name from categoryInfo
  const categoryName = categoryInfo?.name || 'Category'

  // Filter products by category
  const categoryProducts = useMemo(
    () => catalogProducts.filter((product) => product.category === categoryName),
    [categoryName, catalogProducts]
  )

  // Get unique brands for this category
  const brands = useMemo(() => {
    const uniqueBrands = ['All', ...new Set(categoryProducts.map(p => p.brand).filter(Boolean))]
    return uniqueBrands
  }, [categoryProducts])

  // Dropdown subcategory menus for this category (if any are configured)
  const menu = useMemo(
    () => categoryMenus.find((m) => m.category === categoryName) ?? null,
    [categoryMenus, categoryName]
  )
  const defaultGroup = menu?.groups?.[0]?.name ?? null
  const defaultMenuItem = menu?.groups?.[0]?.items?.[0]?.name ?? null
  const [selectedMenu, setSelectedMenu] = useState(defaultMenuItem)
  const [selectedGroup, setSelectedGroup] = useState(defaultGroup)
  const appliedGroupRef = useRef(null)

  useEffect(() => {
    setSelectedGroup(defaultGroup)
    setSelectedMenu(defaultMenuItem)
    if (!productParam) setSelectedProductId(null)
    setSelectedBrand('All')
    setOpenMenu(null)
  }, [categoryName, defaultGroup, defaultMenuItem])

  // Deep link from the search bar: ?g=<GroupName> jumps straight to a
  // subcategory menu group (declared after `menu` so the deps are safe).
  // appliedGroupRef keeps it one-shot: without it, the polled `menu`
  // reference changes every 5s and would keep snapping the view back
  // to the URL's group.
  useEffect(() => {
    if (!groupParam || !menu) return
    const key = `${groupParam}|${itemParam ?? ''}`
    if (appliedGroupRef.current === key) return
    const group = menu.groups.find((grp) => normalize(grp.name) === normalize(groupParam))
    if (group && group.items[0]) {
      appliedGroupRef.current = key
      const targetItem = itemParam
        ? group.items.find((it) => normalize(it.name) === normalize(itemParam))
        : null
      setSelectedGroup(group.name)
      setSelectedMenu(targetItem ? targetItem.name : group.items[0].name)
      if (!productParam) {
        setSelectedProductId(null)
        setSelectedBrand('All')
      }
      setOpenMenu(null)
    }
  }, [groupParam, itemParam, menu])

  const normalize = (value) => (value ?? '').trim().toLowerCase()

  // A product belongs to a menu group when it has no subcategory assigned
  // (unassigned products show in every group) or its subcategory matches
  // the group name (e.g. product.subcategory === 'Laptops' only appears
  // in the "Laptops" group, never in "Monitors").
  const matchesGroup = (product, group) => {
    const sub = normalize(product.subcategory)
    return !sub || sub === normalize(group.name)
  }

  // A menu item shows a product when:
  // - the item is named "All"/"All Items" (shows everything in the group), or
  // - the product brand matches the item name, or
  // - the product brand is in the item's brand list
  const matchesMenuItem = (product, item) => {
    const itemName = normalize(item.name)
    if (itemName === 'all' || itemName === 'all items') return true
    const brand = normalize(product.brand)
    if (!brand) return false
    if (brand === itemName) return true
    return (item.brands ?? []).some((b) => normalize(b) === brand)
  }

  // Filter by menu item (brands), then by brand if no menu applies
  const visibleProducts = useMemo(() => {
    if (menu && selectedMenu) {
      // Resolve the item inside its own group, so duplicate item names
      // (e.g. "All Items" in every group) can't leak products from
      // a different subcategory.
      const group =
        menu.groups.find((g) => normalize(g.name) === normalize(selectedGroup)) ??
        menu.groups.find((g) => g.items.some((i) => i.name === selectedMenu))
      if (group) {
        const menuItem = group.items.find((i) => i.name === selectedMenu)
        if (menuItem) {
          return categoryProducts.filter(
            (product) => matchesGroup(product, group) && matchesMenuItem(product, menuItem)
          )
        }
      }
    }

    if (selectedBrand === 'All') {
      return categoryProducts
    }
    return categoryProducts.filter((product) => product.brand === selectedBrand)
  }, [categoryProducts, selectedBrand, selectedMenu, selectedGroup, menu])

  const sortedVisible = useMemo(() => {
    const list = [...visibleProducts]
    if (sort === 'Newest') list.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    else if (sort === 'Price: Low to High') list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price))
    return list
  }, [visibleProducts, sort])

  // Set selected product if not already set
  const currentProduct = selectedProductId
    ? visibleProducts.find((product) => product.id === selectedProductId)
    : visibleProducts[0]

  if (!categoryInfo) {
    return (
      <div className="page-shell">
        <Header />
        <main className="container page-content">
          <h1>Category not found</h1>
        </main>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="container page-content">
        <CategoryNavigation />

        <section className="section-header">
          <div>
            <p className="eyebrow">Shop by category</p>
            <h2>{categoryName}</h2>
          </div>
          <a href="#catalog" onClick={(e) => { e.preventDefault(); catalogRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>Filter</a>
        </section>

        <section className="deal-banner-row" aria-label="Special deals">
          {deals.map((deal) => (
            <article key={deal.title} className="deal-banner">
              <span>{deal.title}</span>
              <strong>{deal.subtitle}</strong>
            </article>
          ))}
        </section>

        <section className="catalog-layout" ref={catalogRef}>
          <div className="catalog-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{categoryInfo.icon}</p>
                <h2>{categoryName}</h2>
              </div>
            </div>

            {menu ? (
              <div className="catalog-toolbar">
                <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>Menu:</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {menu.groups.map((group) => (
                    <div key={group.name} style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroup(group.name)
                          const first = group.items[0]?.name
                          if (first) setSelectedMenu(first)
                          setSelectedProductId(null)
                          setSelectedBrand('All')
                          setOpenMenu(openMenu === group.name ? null : group.name)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: selectedGroup === group.name ? 'var(--bg-accent-soft)' : 'var(--btn-bg)',
                          color: selectedGroup === group.name ? '#65a30d' : 'var(--btn-text)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          minWidth: '150px',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        {group.name}
                        <span style={{ marginLeft: '0.5rem' }}>▼</span>
                      </button>

                      {openMenu === group.name && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-2)',
                          borderRadius: '4px',
                          marginTop: '0.25rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          minWidth: '150px',
                          overflow: 'hidden'
                        }}>
                          {group.items.map((item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => {
                                setSelectedMenu(item.name)
                                setSelectedGroup(group.name)
                                setOpenMenu(null)
                                setSelectedProductId(null)
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.75rem 1rem',
                                backgroundColor: selectedMenu === item.name ? 'var(--bg-soft)' : 'transparent',
                                color: 'var(--text)',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontWeight: selectedMenu === item.name ? '600' : '400',
                                borderBottom: '1px solid var(--border-3)'
                              }}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : brands.length > 1 && (
              <div className="catalog-toolbar">
                <p style={{ marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>Brands:</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {brands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      className={`filter-chip ${selectedBrand === brand ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedBrand(brand)
                        setSelectedProductId(null)
                      }}
                      style={{
                        fontWeight: selectedBrand === brand ? '600' : '400',
                        backgroundColor: selectedBrand === brand ? 'var(--btn-bg)' : 'var(--bg-soft)',
                        color: selectedBrand === brand ? 'var(--btn-text)' : 'var(--text)',
                        cursor: 'pointer',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '4px',
                      }}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {visibleProducts.length > 0 ? (
              <div className="catalog-grid">
                {sortedVisible.map((product) => (
                  <article
                    key={product.id}
                    className={`product-card catalog-card ${currentProduct?.id === product.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedProductId(product.id); setModalProduct(product) }}
                  >
                    <div className="card-image-wrap">
                      <img src={product.image} alt={product.name} />
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
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleAdd(product) }}>{justAddedId === product.id ? "Added ✓" : "Add to cart"}</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem' }}>
                No products match this selection. Pick another menu item or brand.
              </p>
            )}
          </div>

          {currentProduct && (
            <aside className="detail-panel" ref={detailRef}>
                <div className="detail-image-wrap">
                  <img src={currentProduct.image} alt={currentProduct.name} />
                </div>

                <div className="detail-meta">
                  <span className="detail-badge">In stock</span>
                  <span className="detail-rating">★ {currentProduct.rating}</span>
                </div>

                <h3>{currentProduct.name}</h3>
                <div className="detail-price">
                  <strong>{currentProduct.price}</strong>
                  <span>{currentProduct.oldPrice}</span>
                </div>

                <p className="detail-description">{currentProduct.description}</p>

                <div className="spec-list">
                  {currentProduct.specs.map((spec) => (
                    <span key={spec}>{spec}</span>
                  ))}
                </div>

                <div className="detail-actions">
                  <button type="button" className="primary-btn" onClick={() => handleAdd(currentProduct)}>{justAddedId === currentProduct.id ? "Added ✓" : "Add to cart"}</button>
                  <button type="button" className="secondary-btn">Buy now</button>
                </div>

                <div className="seller-box">
                  <div>
                    <p className="eyebrow small-eyebrow">Sold by</p>
                    <strong>{currentProduct.seller}</strong>
                  </div>
                  <span>Verified seller</span>
                </div>
              </aside>
            )}
          </section>

          <section className="trending-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Popular now</p>
              <h2>Trending items</h2>
            </div>
            <a href="#catalog" onClick={(e) => { e.preventDefault(); catalogRef.current?.scrollIntoView({ behavior: 'smooth' }) }}>See more</a>
          </div>

          <div className="mini-product-grid">
            {trendingProducts.map((product) => (
              <article key={product.name} className="mini-product-card" onClick={() => setModalProduct(product)}>
                <img src={product.image} alt={product.name} />
                <div>
                  <h3>{product.name}</h3>
                  <strong>{product.price}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer"></footer>

      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
    </div>
  )
}
