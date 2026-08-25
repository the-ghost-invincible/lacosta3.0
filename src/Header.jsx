import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useSiteData } from './useSiteData'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { normalize } from './utils'
import './App.css'

export function categorySlug(name) {
  return name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')
}

export function Header() {
  const [theme, setTheme] = useState(() => localStorage.getItem('lacosta-theme') || 'light')
  const { siteContent, catalogProducts, categories, categoryMenus } = useSiteData()
  const { count } = useCart()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [uniName, setUniName] = useState(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (user?.university) {
      fetch('/api/universities')
        .then((r) => r.json())
        .then((data) => {
          const match = (data.universities ?? []).find((u) => u.slug === user.university)
          if (match) setUniName(match.name)
        })
        .catch(() => {})
    }
  }, [user?.university])

  const categoryResults = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return categories
      .filter((c) => c.name !== 'All' && normalize(c.name).includes(q))
      .slice(0, 3)
  }, [query, categories])

  const subcategoryResults = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    const out = []
    for (const menu of categoryMenus ?? []) {
      for (const group of menu.groups ?? []) {
        if (normalize(group.name).includes(q)) {
          out.push({ type: 'group', menu, group, label: group.name })
        }
        for (const item of group.items ?? []) {
          if (normalize(item.name).includes(q)) {
            out.push({ type: 'item', menu, group, item, label: item.name })
          }
        }
      }
    }
    return out.slice(0, 6)
  }, [query, categoryMenus])

  const productResults = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return catalogProducts
      .filter(
        (p) =>
          normalize(p.name).includes(q) ||
          normalize(p.brand).includes(q) ||
          normalize(p.category).includes(q) ||
          normalize(p.description).includes(q) ||
          (p.specs ?? []).some((s) => normalize(s).includes(q))
      )
      .slice(0, 8)
  }, [query, catalogProducts])

  const autocompleteSuggestions = useMemo(() => {
    const q = normalize(query)
    if (!q || q.length < 2) return []
    const seen = new Set()
    const out = []
    for (const p of catalogProducts) {
      const name = p.name
      if (normalize(name).includes(q) && !seen.has(name)) {
        seen.add(name)
        out.push({ name, category: p.category, price: p.price })
      }
      if (out.length >= 6) break
    }
    return out
  }, [query, catalogProducts])

  const [highlightIdx, setHighlightIdx] = useState(-1)

  useEffect(() => {
    setHighlightIdx(-1)
  }, [query])

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const goToProduct = (product) => {
    setOpen(false)
    setQuery('')
    const sub = (product.subcategory ?? '').trim()
    const params = sub
      ? `?g=${encodeURIComponent(sub)}&p=${product.id}`
      : `?p=${product.id}`
    navigate(`/category/${categorySlug(product.category)}${params}`)
  }

  const goToCategory = (name) => {
    setOpen(false)
    setQuery('')
    navigate(`/category/${categorySlug(name)}`)
  }

  const goToSub = (r) => {
    setOpen(false)
    setQuery('')
    const groupParam = encodeURIComponent(r.group.name)
    const params = r.type === 'item' && r.item
      ? `?g=${groupParam}&i=${encodeURIComponent(r.item.name)}`
      : `?g=${groupParam}`
    navigate(`/category/${categorySlug(r.menu.category)}${params}`)
  }

  const goToSearch = () => {
    const q = query.trim()
    if (!q) return
    setOpen(false)
    setQuery('')
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  // Best match for Enter/Search button: category > subcategory > product
  const firstResult = categoryResults[0] ?? subcategoryResults[0] ?? productResults[0] ?? null
  const runFirstResult = () => {
    if (categoryResults[0]) goToCategory(categoryResults[0].name)
    else if (subcategoryResults[0]) goToSub(subcategoryResults[0])
    else if (productResults[0]) goToProduct(productResults[0])
  }

  // Highlights the part of the name that matches the query
  const highlightMatch = (text) => {
    const q = query.trim()
    const idx = (text ?? '').toLowerCase().indexOf(q.toLowerCase())
    if (!q || idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lacosta-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand-wrap" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="brand-mark"><img src="/logo.png" alt="Lacosta" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }} /></div>
            <div>
              <span className="brand-name">Lacosta</span>
              <small>{uniName || 'Marketplace'}</small>
            </div>
          </Link>

          <div className="search-bar" ref={searchRef}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search for products, brands and categories"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                const suggestions = autocompleteSuggestions
                if (suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                  e.preventDefault()
                  setHighlightIdx((prev) => {
                    if (e.key === 'ArrowDown') return prev < suggestions.length - 1 ? prev + 1 : 0
                    return prev > 0 ? prev - 1 : suggestions.length - 1
                  })
                  return
                }
                if (e.key === 'Enter') {
                  if (highlightIdx >= 0 && suggestions[highlightIdx]) {
                    setQuery(suggestions[highlightIdx].name)
                    setHighlightIdx(-1)
                  } else if (firstResult) {
                    runFirstResult()
                  }
                }
              }}
            />
            <button type="button" onClick={runFirstResult}>Search</button>

            {open && !query.trim() && (
              <div className="search-dropdown catalogue-dropdown">
                <p className="search-heading">Browse catalogue</p>
                <div className="catalogue-cats">
                  {categories.filter((c) => c.name !== 'All').map((c) => (
                    <button key={c.name} type="button" className="catalogue-cat" onClick={() => goToCategory(c.name)}>
                      <span>{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
                <p className="search-heading">Popular products</p>
                <div className="catalogue-products">
                  {catalogProducts.slice(0, 5).map((p) => (
                    <button key={p.id} type="button" className="search-result" onClick={() => goToProduct(p)}>
                      <img src={p.image} alt="" />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.category}</small>
                      </span>
                      <em>{p.price}</em>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {open && query.trim() && autocompleteSuggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {autocompleteSuggestions.map((s, idx) => (
                  <button
                    key={s.name}
                    type="button"
                    className={`autocomplete-item ${idx === highlightIdx ? 'highlighted' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s.name)
                      setHighlightIdx(-1)
                    }}
                  >
                    <span className="autocomplete-name">{highlightMatch(s.name)}</span>
                    <span className="autocomplete-meta">{s.category} · {s.price}</span>
                  </button>
                ))}
                <button type="button" className="search-view-all" onClick={goToSearch}>
                  View all results for &ldquo;{query.trim()}&rdquo;
                </button>
              </div>
            )}

            {open && query.trim() && autocompleteSuggestions.length === 0 && (
              <div className="search-dropdown">
                {categoryResults.length === 0 && subcategoryResults.length === 0 && productResults.length === 0 ? (
                  <p className="search-empty">No matches found</p>
                ) : (
                  <>
                    {categoryResults.length > 0 && (
                      <>
                        <p className="search-heading">Categories</p>
                        {categoryResults.map((c) => (
                          <button key={`cat-${c.name}`} type="button" className="search-result" onClick={() => goToCategory(c.name)}>
                            <span className="search-ico">{c.icon}</span>
                            <span>
                              <strong>{highlightMatch(c.name)}</strong>
                              <small>Category</small>
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {subcategoryResults.length > 0 && (
                      <>
                        <p className="search-heading">Subcategories</p>
                        {subcategoryResults.map((r, idx) => (
                          <button key={`sub-${idx}`} type="button" className="search-result" onClick={() => goToSub(r)}>
                            <span className="search-ico">📂</span>
                            <span>
                              <strong>{highlightMatch(r.label)}</strong>
                              <small>{highlightMatch(r.menu.category)} · {r.group.name}</small>
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {productResults.length > 0 && (
                      <>
                        <p className="search-heading">Products</p>
                        {productResults.map((p) => (
                          <button key={p.id} type="button" className="search-result" onClick={() => goToProduct(p)}>
                            <img src={p.image} alt="" />
                            <span>
                              <strong>{highlightMatch(p.name)}</strong>
                              <small>{highlightMatch(p.category)}{p.brand ? ` · ${p.brand}` : ''}</small>
                            </span>
                            <em>{p.price}</em>
                          </button>
                        ))}
                        <button type="button" className="search-view-all" onClick={goToSearch}>
                          View all results for &ldquo;{query.trim()}&rdquo;
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <nav className="top-actions" aria-label="Account actions">
            {loading ? (
              <span className="nav-pill user-pill" style={{ opacity: 0.6 }}>…</span>
            ) : user ? (
              <button
                type="button"
                className="nav-pill user-pill"
                aria-label="Account menu"
                onClick={() => navigate('/account')}
              >
                {user.avatar && <img src={user.avatar} alt="" />}
                <span>@{user.username ?? 'Set username'}</span>
              </button>
            ) : (
              <button type="button" className="nav-pill" onClick={() => navigate('/login')}>Login</button>
            )}
            <button type="button" className="nav-pill accent">Sell</button>
            <button
              type="button"
              className="nav-pill theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button type="button" className="cart-pill" aria-label="Shopping cart" onClick={() => navigate('/cart')}>
              🛒 <span>Cart</span>
              {count > 0 && <em className="cart-badge">{count}</em>}
            </button>
            <button type="button" className="cart-pill" aria-label="Purchase history" onClick={() => navigate('/history')} style={{ cursor: 'pointer' }}>
              📋 <span>History</span>
            </button>
          </nav>
        </div>
      </header>

      <div className="promo-strip">
        <div className="container promo-inner">
          {siteContent.promo.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <MobileNav theme={theme} onToggleTheme={toggleTheme} onAccountClick={() => {
    if (user) navigate('/account')
    else navigate('/login')
  }} />
    </>
  )
}

export function CategoryNavigation() {
  const { categories } = useSiteData()
  const stripRef = useRef(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return

    let resumeTimer = null
    let ownScrollUntil = 0

    const pause = () => {
      pausedRef.current = true
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        pausedRef.current = false
      }, 2500)
    }

    // A scroll not caused by our own auto-advance means the user is
    // scrolling the strip — pause the carousel while they do.
    const onScroll = () => {
      if (Date.now() < ownScrollUntil) return
      pause()
    }
    const onWheel = () => pause()
    const onTouchStart = () => pause()
    const onMouseDown = () => pause()

    strip.addEventListener('scroll', onScroll, { passive: true })
    strip.addEventListener('wheel', onWheel, { passive: true })
    strip.addEventListener('touchstart', onTouchStart, { passive: true })
    strip.addEventListener('mousedown', onMouseDown)

    const tick = () => {
      if (pausedRef.current) return
      const pill = strip.querySelector('.category-pill')
      if (!pill) return
      const step = pill.offsetWidth + 12
      const max = strip.scrollWidth - strip.clientWidth
      ownScrollUntil = Date.now() + 600
      if (strip.scrollLeft >= max - 2) {
        strip.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        strip.scrollBy({ left: step, behavior: 'smooth' })
      }
    }

    const id = setInterval(tick, 3500)
    return () => {
      clearInterval(id)
      clearTimeout(resumeTimer)
      strip.removeEventListener('scroll', onScroll)
      strip.removeEventListener('wheel', onWheel)
      strip.removeEventListener('touchstart', onTouchStart)
      strip.removeEventListener('mousedown', onMouseDown)
    }
  }, [categories])

  return (
    <section
      className="category-strip"
      aria-label="Store categories"
      ref={stripRef}
    >
      {categories.map((category) => (
        <Link
          key={category.name}
          to={category.name === 'All' ? '/' : `/category/${categorySlug(category.name)}`}
          className={`category-pill ${category.accent}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <span>{category.icon}</span>
          {category.name}
        </Link>
      ))}
    </section>
  )
}

function MobileNav({ theme, onToggleTheme, onAccountClick }) {
  const { categories } = useSiteData()
  const { count } = useCart()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <div className={`category-sheet ${sheetOpen ? 'open' : ''}`}>
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
        <div className="sheet-panel" role="dialog" aria-label="Categories">
          <div className="sheet-head">
            <h3>Browse categories</h3>
            <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close categories">✕</button>
          </div>
          <div className="sheet-grid">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={category.name === 'All' ? '/' : `/category/${categorySlug(category.name)}`}
                onClick={() => setSheetOpen(false)}
              >
                <span>{category.icon}</span>
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link to="/" className={pathname === '/' ? 'active' : ''}>
          <span className="nav-icon">🏠</span>
          Home
        </Link>
        <button type="button" className={sheetOpen ? 'active' : ''} onClick={() => setSheetOpen(true)}>
          <span className="nav-icon">☰</span>
          Categories
        </button>
        <button type="button" onClick={() => navigate('/cart')} className={pathname === '/cart' ? 'active' : ''}>
          <span className="nav-icon">
            🛒
            {count > 0 && <em className="cart-badge">{count}</em>}
          </span>
          Cart
        </button>
        <button type="button" onClick={() => navigate('/history')} className={pathname === '/history' ? 'active' : ''}>
          <span className="nav-icon">📋</span>
          History
        </button>
        <button type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          Theme
        </button>
        <button type="button" onClick={onAccountClick}>
          <span className="nav-icon">👤</span>
          {user ? 'Account' : 'Login'}
        </button>
      </nav>
    </>
  )
}
