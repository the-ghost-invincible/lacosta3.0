import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './admin.css'

export const ADMIN_PATH = '/admin-7f3k9'

const ACCENTS = ['orange', 'blue', 'pink', 'green', 'purple', 'red', 'yellow', 'cyan']

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  })
  return res
}

export function AdminPage() {
  const [authed, setAuthed] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('lacosta-theme') || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lacosta-theme', theme)
  }, [theme])

  useEffect(() => {
    api('/api/admin/me')
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="admin-shell">
        <div className="admin-content" style={{ textAlign: 'center' }}>Checking…</div>
      </div>
    )
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <Dashboard
      onLogout={() => setAuthed(false)}
      theme={theme}
      onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    />
  )
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    setBusy(false)
    if (res.ok) onLogin()
    else setError('Wrong password')
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <h1>Lacosta Admin</h1>
        <p>Enter the admin password to manage your store.</p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ onLogout, theme, onToggleTheme }) {
  const [db, setDb] = useState(null)
  const [tab, setTab] = useState('products')
  const [msg, setMsg] = useState(null)
  const [ngrokUrl, setNgrokUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    api('/api/data').then((res) => res.json()).then(setDb).catch(() => {})
    api('/api/admin/ngrok').then((res) => res.json()).then((d) => setNgrokUrl(d.url)).catch(() => {})
  }, [])

  const flash = (text) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  const save = async (section, value) => {
    const res = await api('/api/admin/data', {
      method: 'PUT',
      body: JSON.stringify({ section, value }),
    })
    if (res.ok) {
      setDb((prev) => ({ ...prev, [section]: value }))
      flash('Saved')
    } else {
      flash('Save failed — are you still logged in?')
    }
  }

  // Full-page product editor routes:
  // /admin-7f3k9/products/new          -> create a product
  // /admin-7f3k9/products/:id/edit     -> edit an existing product
  const isNewProduct = location.pathname === `${ADMIN_PATH}/products/new`
  const editMatch = location.pathname.match(/\/products\/(\d+)\/edit$/)
  const editProductId = editMatch ? Number(editMatch[1]) : null
  const editingProduct = isNewProduct
    ? { ...emptyProduct(), category: db?.categories?.find((c) => c.name !== 'All')?.name ?? '' }
    : editProductId != null
      ? (db?.catalogProducts ?? []).find((p) => Number(p.id) === editProductId) ?? null
      : null
  const onProductEditor = Boolean(editingProduct)

  const saveProduct = async (product) => {
    try {
      const res = await api('/api/admin/products', {
        method: product.id ? 'PUT' : 'POST',
        body: JSON.stringify(product),
      })
      if (res.ok) {
        const data = await res.json()
        const products = db.catalogProducts
        let next
        if (product.id) {
          next = products.map((p) => (Number(p.id) === Number(product.id) ? data.product : p))
        } else {
          next = [...products, data.product]
        }
        setDb((prev) => ({ ...prev, catalogProducts: next }))
        flash('Product saved')
      } else {
        flash('Save failed')
      }
    } catch {
      flash('Save failed')
    }
  }

  const logout = async () => {
    await api('/api/logout', { method: 'POST' })
    onLogout()
  }

  if (!db) return <div className="admin-shell"><div className="admin-content">Loading…</div></div>

  const tabs = [
    { id: 'products', label: 'Products' },
    { id: 'customers', label: 'Customers' },
    { id: 'orders', label: 'Orders' },
    { id: 'featured', label: 'Featured deals' },
    { id: 'categories', label: 'Categories' },
    { id: 'menus', label: 'Subcategories' },
    { id: 'content', label: 'Site content' },
  ]

  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="admin-brand">
          <h1>Lacosta Admin</h1>
          <small>Manage your store</small>
        </div>
        <div className="admin-bar-actions">
          <a
            href="https://lacostamarkets.site"
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost small ngrok-badge"
            title="Open your store"
          >
            <span className="site-logo">L</span> lacostamarkets.site
          </a>
          <button
            type="button"
            className="btn ghost small"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <Link to="/" className="btn ghost">View site</Link>
          <button type="button" className="btn danger small" onClick={logout}>Log out</button>
        </div>
      </header>

      <nav className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === 'products' && onProductEditor ? '' : tab === t.id ? 'active' : ''}
            onClick={() => { navigate(ADMIN_PATH); setTab(t.id) }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="admin-content">
        {onProductEditor ? (
          <ProductForm
            initial={editingProduct}
            categories={db.categories}
            onSave={(product) => {
              saveProduct(product)
              navigate(ADMIN_PATH)
            }}
            onCancel={() => navigate(ADMIN_PATH)}
          />
        ) : (
          <>
            {tab === 'products' && (
              <ProductsTab products={db.catalogProducts} onSave={(v) => save('catalogProducts', v)} />
            )}
            {tab === 'customers' && (
              <CustomersTab />
            )}
            {tab === 'orders' && (
              <OrdersTab />
            )}
            {tab === 'featured' && (
              <FeaturedTab products={db.featuredProducts} categories={db.categories} onSave={(v) => save('featuredProducts', v)} />
            )}
            {tab === 'categories' && (
              <CategoriesTab categories={db.categories} onSave={(v) => save('categories', v)} />
            )}
            {tab === 'menus' && (
              <MenusTab menus={db.categoryMenus ?? []} categories={db.categories} onSave={(v) => save('categoryMenus', v)} />
            )}
            {tab === 'content' && (
              <ContentTab
                deals={db.deals}
                trending={db.trendingProducts}
                benefits={db.benefits}
                siteContent={db.siteContent}
                onSave={({ deals, trending, benefits, siteContent }) => {
                  save('deals', deals)
                  save('trendingProducts', trending)
                  save('benefits', benefits)
                  save('siteContent', siteContent)
                }}
              />
            )}
          </>
        )}
      </main>

      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}

function ImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false)

  const upload = async (file) => {
    setBusy(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await api('/api/admin/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.url) onChange(json.url)
    setBusy(false)
  }

  return (
    <div className="image-field">
      {value && <img src={value} alt="" />}
      <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Image URL or /uploads/…" />
      <label className="btn ghost small" style={{ margin: 0 }}>
        {busy ? 'Uploading…' : 'Upload'}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload(file)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

function emptyProduct() {
  return {
    id: 0,
    name: '',
    category: '',
    price: '',
    oldPrice: '',
    image: '',
    seller: '',
    rating: 4.5,
    brand: '',
    subcategory: '',
    description: '',
    specs: [],
    outOfStock: false,
  }
}

function ProductForm({ initial, categories, onSave, onCancel }) {
  const [product, setProduct] = useState(initial)
  const set = (key, value) => setProduct((prev) => ({ ...prev, [key]: value }))

  const submit = () => {
    const next = { ...product, specs: (product.specs || []).join(',').split(',').map((s) => s.trim()).filter(Boolean) }
    onSave(next)
  }

  return (
    <div className="admin-panel">
      <h2>{initial.id ? `Edit: ${initial.name}` : 'New product'}</h2>
      <div className="form-grid">
        <div className="form-field full">
          <label>Name</label>
          <input value={product.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Category</label>
          <select value={product.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">— choose —</option>
            {categories.filter((c) => c.name !== 'All').map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Brand (optional)</label>
          <input value={product.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Coca-Cola" />
        </div>
        <div className="form-field">
          <label>Subcategory (optional)</label>
          <input
            value={product.subcategory ?? ''}
            onChange={(e) => set('subcategory', e.target.value)}
            placeholder="e.g. Laptops, Monitors"
          />
          <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
            Leave empty to show in all menu groups. Must match a group name exactly (e.g. "Laptops").
          </small>
        </div>
        <div className="form-field">
          <label>Price</label>
          <input value={product.price} onChange={(e) => set('price', e.target.value)} placeholder="KSh 150" />
        </div>
        <div className="form-field">
          <label>Old price (strikethrough)</label>
          <input value={product.oldPrice ?? ''} onChange={(e) => set('oldPrice', e.target.value)} placeholder="KSh 200" />
        </div>
        <div className="form-field">
          <label>Seller</label>
          <input value={product.seller ?? ''} onChange={(e) => set('seller', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Rating (0–5)</label>
          <input type="number" min="0" max="5" step="0.1" value={product.rating ?? 4.5} onChange={(e) => set('rating', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="form-field full">
          <label>Image</label>
          <ImageField value={product.image} onChange={(v) => set('image', v)} />
        </div>
        <div className="form-field full">
          <label>Description</label>
          <textarea value={product.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="form-field full">
          <label>Specs (comma separated)</label>
          <input value={(product.specs ?? []).join(', ')} onChange={(e) => set('specs', e.target.value.split(',').map((s) => s.trim()))} placeholder="330ml bottle, Carbonated, …" />
        </div>
        <div className="form-field full">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={product.outOfStock ?? false}
              onChange={(e) => set('outOfStock', e.target.checked)}
            />
            Out of stock
          </label>
          <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
            Mark this product as out of stock. It will still appear in the store but show an "Out of stock" badge.
          </small>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn" onClick={submit}>{initial.id ? 'Save changes' : 'Add product'}</button>
      </div>
    </div>
  )
}

function ProductsTab({ products, onSave }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const filtered = products.filter((p) =>
    (p.name + ' ' + (p.brand ?? '') + ' ' + p.category).toLowerCase().includes(query.toLowerCase())
  )

  const removeProduct = async (id) => {
    if (!confirm('Delete this product?')) return
    const res = await api(`/api/admin/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      onSave(products.filter((p) => p.id !== id))
    }
  }

  return (
    <div>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Products</h2>
            <p className="panel-hint">{products.length} products in your store</p>
          </div>
          <button type="button" className="btn" onClick={() => navigate(`${ADMIN_PATH}/products/new`)}>
            + Add product
          </button>
        </div>
        <input className="search-box" type="text" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {filtered.length === 0 ? (
          <p className="muted">No products match your search.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Rating</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.image && <img src={p.image} alt="" />}</td>
                  <td><strong>{p.name}</strong>{p.outOfStock ? <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, marginLeft: '6px' }}>OUT OF STOCK</span> : null}{p.brand ? <div className="muted">{p.brand}{p.subcategory ? ` · ${p.subcategory}` : ''}</div> : null}</td>
                  <td>{p.category}</td>
                  <td>{p.price}</td>
                  <td>★ {p.rating}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn ghost small" onClick={() => navigate(`${ADMIN_PATH}/products/${p.id}/edit`)}>Edit</button>{' '}
                    <button type="button" className="btn danger small" onClick={() => removeProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', canceled: 'Canceled', delivered: 'Delivered' }

function CustomersTab() {
  const [customers, setCustomers] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const res = await api('/api/admin/customers')
      const data = await res.json()
      setCustomers(data.customers ?? [])
    } catch {
      // keep last known data
    }
    setRefreshing(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const deleteUser = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await api(`/api/admin/orders/user/${deleteTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        setDeleteTarget(null)
        setDeletePassword('')
      } else {
        setDeleteError(data.error ?? 'Delete failed')
      }
    } catch {
      setDeleteError('Network error')
    }
    setDeleteBusy(false)
  }

  const parsePrice = (price) => Number(String(price ?? '').replace(/[^\d]/g, '')) || 0
  const cartTotal = (items) => (items ?? []).reduce((s, i) => s + parsePrice(i.price) * (i.qty ?? 1), 0)
  const fmtTime = (iso) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Customers & live carts</h2>
          <p className="panel-hint">
            {customers.length} registered users · carts update live, so products added or removed by a customer show here on refresh
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={load} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {customers.length === 0 ? (
        <p className="muted">No registered users yet. When a customer signs in, they appear here with their live cart.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table orders-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Cart (live)</th>
                <th>Total</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const items = c.items ?? []
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.displayName || c.username || c.email}</strong>
                      {c.username && <div className="muted">@{c.username}</div>}
                      <div className="muted">{c.email}</div>
                      {c.phone && <div className="muted">{c.phone}</div>}
                    </td>
                    <td>
                      {items.length === 0 ? (
                        <span className="muted">Empty</span>
                      ) : (
                        items.map((item, idx) => (
                          <div key={idx} className="order-item">
                            <span>{item.name}</span>
                            <em>× {item.qty ?? 1}</em>
                          </div>
                        ))
                      )}
                    </td>
                    <td className="nowrap">{items.length ? `KSh ${cartTotal(items).toLocaleString()}` : '—'}</td>
                    <td className="nowrap muted">{fmtTime(c.lastActive)}</td>
                    <td className="nowrap">
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={() => { setDeleteTarget(c); setDeletePassword(''); setDeleteError(null) }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete user</h2>
            <p>Are you sure you want to permanently delete <strong>{deleteTarget.email}</strong>? This cannot be undone.</p>
            <label className="form-field">
              <span>Enter admin password to confirm</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
              />
            </label>
            {deleteError && <p className="error">{deleteError}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn danger" disabled={deleteBusy || !deletePassword} onClick={deleteUser}>
                {deleteBusy ? 'Deleting…' : 'Delete user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [selected, setSelected] = useState([])

  const load = () => {
    api('/api/admin/orders')
      .then((res) => res.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const setStatus = async (id, status) => {
    setBusyId(id)
    const res = await api(`/api/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    setBusyId(null)
    if (res.ok) load()
  }

  const removeOrder = async (id) => {
    if (!confirm('Delete this order permanently?')) return
    setBusyId(id)
    const res = await api(`/api/admin/orders/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (res.ok) load()
  }

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const toggleAll = () =>
    setSelected((prev) => (prev.length === orders.length ? [] : orders.map((o) => o.id)))

  const bulkStatus = async (status) => {
    if (selected.length === 0) return
    if (!confirm(`Mark ${selected.length} selected order(s) as ${STATUS_LABELS[status].toLowerCase()}?`)) return
    setBusyId('bulk')
    await Promise.all(
      selected.map((id) =>
        api(`/api/admin/orders/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        })
      )
    )
    setBusyId(null)
    setSelected([])
    load()
  }

  const fmtTime = (iso) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Orders</h2>
          <p className="panel-hint">
            {orders.length} orders total · {orders.filter((o) => o.status === 'pending').length} pending
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={load}>Refresh</button>
      </div>

      <div className="bulk-actions">
        <span className="bulk-hint">
          {selected.length ? `${selected.length} order${selected.length > 1 ? 's' : ''} selected` : 'Tick orders, then use the buttons'}
        </span>
        <button
          type="button"
          className="btn small"
          disabled={selected.length === 0 || busyId === 'bulk'}
          onClick={() => bulkStatus('confirmed')}
        >
          Confirm order
        </button>
        <button
          type="button"
          className="btn danger small"
          disabled={selected.length === 0 || busyId === 'bulk'}
          onClick={() => bulkStatus('canceled')}
        >
          Cancel order
        </button>
        <button
          type="button"
          className="btn small"
          disabled={selected.length === 0 || busyId === 'bulk'}
          onClick={() => bulkStatus('delivered')}
        >
          Deliver
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="muted">No orders yet. When a customer places an order it will show up here.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table orders-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selected.length === orders.length}
                    onChange={toggleAll}
                    aria-label="Select all orders"
                  />
                </th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(order.id)}
                      onChange={() => toggle(order.id)}
                      aria-label={`Select order ${order.id}`}
                    />
                  </td>
                  <td className="nowrap muted">{fmtTime(order.created_at)}</td>
                  <td>
                    <strong>{order.name}</strong>
                    <div className="muted">{order.phone}</div>
                    <div className="muted">{order.email}</div>
                  </td>
                  <td>
                    {(order.items ?? []).map((item, idx) => (
                      <div key={idx} className="order-item">
                        <span>{item.name}</span>
                        <em>× {item.qty ?? 1}</em>
                      </div>
                    ))}
                  </td>
                  <td className="nowrap">{order.total}</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="nowrap">
                    {order.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn small"
                          disabled={busyId === order.id}
                          onClick={() => setStatus(order.id, 'confirmed')}
                        >
                          Confirm
                        </button>{' '}
                        <button
                          type="button"
                          className="btn danger small"
                          disabled={busyId === order.id}
                          onClick={() => setStatus(order.id, 'canceled')}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          className="btn small"
                          disabled={busyId === order.id}
                          onClick={() => setStatus(order.id, 'delivered')}
                        >
                          Deliver
                        </button>{' '}
                        <button
                          type="button"
                          className="btn danger small"
                          disabled={busyId === order.id}
                          onClick={() => setStatus(order.id, 'canceled')}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn danger small"
                      disabled={busyId === order.id}
                      title="Remove from this list"
                      onClick={() => removeOrder(order.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FeaturedTab({ products, categories, onSave }) {
  const [editing, setEditing] = useState(null)

  const saveProduct = (product) => {
    let next
    if (product.id) {
      next = products.map((p) => (p.id === product.id ? product : p))
    } else {
      const newId = Math.max(0, ...products.map((p) => p.id)) + 1
      next = [...products, { ...product, id: newId }]
    }
    onSave(next)
    setEditing(null)
  }

  const removeProduct = (id) => {
    if (!confirm('Delete this featured deal?')) return
    onSave(products.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Featured deals</h2>
            <p className="panel-hint">Shown in the "Featured deals" section on the home page</p>
          </div>
          <button type="button" className="btn" onClick={() => setEditing({ ...emptyProduct(), category: '', badge: 'New' })}>
            + Add featured
          </button>
        </div>
        {products.length === 0 ? (
          <p className="muted">No featured products.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th></th><th>Name</th><th>Badge</th><th>Category</th><th>Price</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.image && <img src={p.image} alt="" />}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.badge ?? '—'}</td>
                  <td>{p.category ?? '—'}</td>
                  <td>{p.price}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn ghost small" onClick={() => setEditing({ ...p })}>Edit</button>{' '}
                    <button type="button" className="btn danger small" onClick={() => removeProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="admin-panel">
          <h2>{editing.id ? `Edit: ${editing.name}` : 'New featured deal'}</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label>Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Badge</label>
              <input value={editing.badge ?? ''} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} placeholder="Top Deal" />
            </div>
            <div className="form-field">
              <label>Category</label>
              <select value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                <option value="">— none —</option>
                {categories.filter((c) => c.name !== 'All').map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Price</label>
              <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Old price</label>
              <input value={editing.oldPrice ?? ''} onChange={(e) => setEditing({ ...editing, oldPrice: e.target.value })} />
            </div>
            <div className="form-field full">
              <label>Image</label>
              <ImageField value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn" onClick={() => saveProduct(editing)}>{editing.id ? 'Save changes' : 'Add featured'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoriesTab({ categories, onSave }) {
  const [items, setItems] = useState(categories)
  useEffect(() => setItems(categories), [categories])

  const update = (index, key, value) => {
    setItems((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)))
  }

  const remove = (index) => {
    const item = items[index]
    if (item.name !== 'All' && !confirm(`Remove category "${item.name}"?`)) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Categories</h2>
          <p className="panel-hint">Renaming updates the store navigation automatically. "All" links to the home page.</p>
        </div>
        <button type="button" className="btn" onClick={() => setItems((prev) => [...prev, { name: 'New Category', icon: '📦', accent: 'blue' }])}>
          + Add category
        </button>
      </div>

      {items.map((cat, index) => (
        <div className="row-edit" key={index}>
          <input className="icon-input" value={cat.icon} onChange={(e) => update(index, 'icon', e.target.value)} title="Icon" />
          <input value={cat.name} onChange={(e) => update(index, 'name', e.target.value)} title="Name" />
          <select value={cat.accent} onChange={(e) => update(index, 'accent', e.target.value)} title="Colour">
            {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="muted">/category/{cat.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')}</span>
          <button type="button" className="btn ghost small" onClick={() => onSave(items)}>Save</button>
          <button type="button" className="btn danger small" onClick={() => remove(index)}>×</button>
        </div>
      ))}

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onSave(items)}>Save all changes</button>
      </div>
    </div>
  )
}

function MenusTab({ menus, categories, onSave }) {
  const [items, setItems] = useState(menus)
  useEffect(() => setItems(menus), [menus])

  const updateMenu = (category, groups) => {
    setItems((prev) => {
      const rest = prev.filter((m) => m.category !== category)
      return groups.length ? [...rest, { category, groups }] : rest
    })
  }

  const upsertGroup = (menu, groupIndex, patch) => {
    const groups = menu ? [...menu.groups] : []
    if (groupIndex === -1) groups.push({ name: 'New group', items: [{ name: 'All Items', brands: [] }] })
    else groups[groupIndex] = { ...groups[groupIndex], ...patch }
    updateMenu(menu?.category ?? 'New Category', groups)
  }

  const removeGroup = (menu, groupIndex) => {
    const groups = menu.groups.filter((_, i) => i !== groupIndex)
    if (groups.length === 0) {
      updateMenu(menu.category, [])
    } else {
      updateMenu(menu.category, groups)
    }
  }

  const upsertItem = (menu, groupIndex, itemIndex, patch) => {
    const groups = [...menu.groups]
    const group = { ...groups[groupIndex], items: [...groups[groupIndex].items] }
    if (itemIndex === -1) group.items.push({ name: 'New item', brands: [] })
    else group.items[itemIndex] = { ...group.items[itemIndex], ...patch }
    groups[groupIndex] = group
    updateMenu(menu.category, groups)
  }

  const removeItem = (menu, groupIndex, itemIndex) => {
    const groups = [...menu.groups]
    const group = { ...groups[groupIndex], items: groups[groupIndex].items.filter((_, i) => i !== itemIndex) }
    groups[groupIndex] = group
    updateMenu(menu.category, groups)
  }

  const addMenu = () => {
    const name = categories.find((c) => c.name !== 'All' && !items.some((m) => m.category === c.name))?.name
    setItems((prev) => [...prev, { category: name ?? 'New Category', groups: [{ name: 'New group', items: [{ name: 'All Items', brands: [] }] }] }])
  }

  const changeMenuCategory = (oldName, newName) => {
    if (!newName || newName === oldName) return
    setItems((prev) => {
      if (prev.some((m) => m.category === newName)) return prev
      return prev.map((m) => (m.category === oldName ? { ...m, category: newName } : m))
    })
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Subcategory dropdown menus</h2>
          <p className="panel-hint">
            Menu groups ("Laptops", "Monitors", ...) only show products whose Subcategory equals the group name
            (products with no subcategory appear in every group). Items inside a group filter by brand: a product
            matches when its brand equals the item name or is listed in its brands. Name an item "All" or "All Items"
            to show everything in that group.
          </p>
        </div>
        <button type="button" className="btn" onClick={addMenu}>+ Add menu for a category</button>
      </div>

      {items.map((menu) => (
        <div className="admin-panel sub" key={menu.category}>
          <div className="row-edit" style={{ gridTemplateColumns: '1fr auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Category:
              <select value={menu.category} onChange={(e) => changeMenuCategory(menu.category, e.target.value)}>
                <option value="">— choose —</option>
                {categories.filter((c) => c.name !== 'All').map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn danger small" onClick={() => updateMenu(menu.category, [])}>Remove menu</button>
          </div>

          {menu.groups.map((group, groupIndex) => (
            <div className="admin-panel sub" key={groupIndex}>
              <div className="row-edit" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                <input value={group.name} placeholder="Group name (e.g. Softdrinks)" onChange={(e) => upsertGroup(menu, groupIndex, { name: e.target.value })} />
                <button type="button" className="btn ghost small" onClick={() => upsertItem(menu, groupIndex, -1)}>+ Add menu item</button>
                <button type="button" className="btn danger small" onClick={() => removeGroup(menu, groupIndex)}>×</button>
              </div>

              {group.items.map((item, itemIndex) => (
                <div className="row-edit" key={itemIndex} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                  <input value={item.name} placeholder="Item name (e.g. Fanta)" onChange={(e) => upsertItem(menu, groupIndex, itemIndex, { name: e.target.value })} />
                  <input
                    value={(item.brands ?? []).join(', ')}
                    placeholder="Brands, comma separated (empty = all)"
                    onChange={(e) => upsertItem(menu, groupIndex, itemIndex, { brands: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                  <button type="button" className="btn danger small" onClick={() => removeItem(menu, groupIndex, itemIndex)}>×</button>
                </div>
              ))}
            </div>
          ))}

          <div className="form-actions">
            <button type="button" className="btn ghost small" onClick={() => upsertGroup(menu, -1)}>+ Add group</button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <p className="muted">No subcategory menus yet. Add one to start grouping products on a category page.</p>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onSave(items)}>Save all subcategory menus</button>
      </div>
    </div>
  )
}

function ContentTab({ deals, trending, benefits, siteContent, onSave }) {
  const [hero, setHero] = useState(siteContent.hero)
  const [promo, setPromo] = useState(siteContent.promo)
  const [dealsList, setDealsList] = useState(deals)
  const [trendingList, setTrendingList] = useState(trending)
  const [benefitsList, setBenefitsList] = useState(benefits)

  useEffect(() => setHero(siteContent.hero), [siteContent])
  useEffect(() => setPromo(siteContent.promo), [siteContent])
  useEffect(() => setDealsList(deals), [deals])
  useEffect(() => setTrendingList(trending), [trending])
  useEffect(() => setBenefitsList(benefits), [benefits])

  const saveAll = () => {
    onSave({ deals: dealsList, trending: trendingList, benefits: benefitsList, siteContent: { hero, promo } })
  }

  return (
    <div>
      <div className="admin-panel">
        <h2>Hero section</h2>
        <p className="panel-hint">The headline block at the top of the home page</p>
        <div className="form-grid">
          <div className="form-field">
            <label>Eyebrow</label>
            <input value={hero.eyebrow} onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Headline</label>
            <input value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} />
          </div>
          <div className="form-field full">
            <label>Subtitle</label>
            <textarea value={hero.text} onChange={(e) => setHero({ ...hero, text: e.target.value })} />
          </div>
          <div className="form-field full">
            <label>Stats</label>
            <div className="stat-grid">
              {hero.stats.map((stat, index) => (
                <div key={index} className="form-field">
                  <input
                    value={stat.value}
                    placeholder="Value (e.g. 120k+)"
                    onChange={(e) => {
                      const stats = hero.stats.map((s, i) => (i === index ? { ...s, value: e.target.value } : s))
                      setHero({ ...hero, stats })
                    }}
                  />
                  <input
                    value={stat.label}
                    placeholder="Label (e.g. Products)"
                    onChange={(e) => {
                      const stats = hero.stats.map((s, i) => (i === index ? { ...s, label: e.target.value } : s))
                      setHero({ ...hero, stats })
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <h2>Promo strip</h2>
        <p className="panel-hint">The three messages under the header</p>
        {promo.map((item, index) => (
          <div className="row-edit" key={index} style={{ gridTemplateColumns: '1fr auto' }}>
            <input value={item} onChange={(e) => setPromo((prev) => prev.map((p, i) => (i === index ? e.target.value : p)))} />
            <button type="button" className="btn danger small" onClick={() => setPromo((prev) => prev.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setPromo((prev) => [...prev, ''])}>+ Add message</button>
      </div>

      <div className="admin-panel">
        <h2>Deal banners</h2>
        <p className="panel-hint">The offer cards below the page heading</p>
        {dealsList.map((deal, index) => (
          <div className="row-edit" key={index} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <input value={deal.title} onChange={(e) => setDealsList((prev) => prev.map((d, i) => (i === index ? { ...d, title: e.target.value } : d)))} placeholder="Title" />
            <input value={deal.subtitle} onChange={(e) => setDealsList((prev) => prev.map((d, i) => (i === index ? { ...d, subtitle: e.target.value } : d)))} placeholder="Subtitle" />
            <button type="button" className="btn danger small" onClick={() => setDealsList((prev) => prev.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setDealsList((prev) => [...prev, { title: 'New deal', subtitle: 'Up to X% off' }])}>+ Add deal</button>
      </div>

      <div className="admin-panel">
        <h2>Trending items</h2>
        <p className="panel-hint">The "Trending items" strip at the bottom</p>
        {trendingList.map((item, index) => (
          <div className="row-edit" key={index} style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
            <input value={item.name} onChange={(e) => setTrendingList((prev) => prev.map((t, i) => (i === index ? { ...t, name: e.target.value } : t)))} placeholder="Name" />
            <input value={item.price} onChange={(e) => setTrendingList((prev) => prev.map((t, i) => (i === index ? { ...t, price: e.target.value } : t)))} placeholder="Price" />
            <input value={item.image} onChange={(e) => setTrendingList((prev) => prev.map((t, i) => (i === index ? { ...t, image: e.target.value } : t)))} placeholder="Image URL" />
            <button type="button" className="btn danger small" onClick={() => setTrendingList((prev) => prev.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setTrendingList((prev) => [...prev, { name: 'New item', price: 'KSh 0', image: '' }])}>+ Add item</button>
      </div>

      <div className="admin-panel">
        <h2>Trusted marketplace benefits</h2>
        <p className="panel-hint">The checklist in the "Why us" section</p>
        {benefitsList.map((item, index) => (
          <div className="row-edit" key={index} style={{ gridTemplateColumns: '1fr auto' }}>
            <input value={item} onChange={(e) => setBenefitsList((prev) => prev.map((b, i) => (i === index ? e.target.value : b)))} />
            <button type="button" className="btn danger small" onClick={() => setBenefitsList((prev) => prev.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setBenefitsList((prev) => [...prev, 'New benefit'])}>+ Add benefit</button>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={saveAll}>Save all content</button>
      </div>
    </div>
  )
}