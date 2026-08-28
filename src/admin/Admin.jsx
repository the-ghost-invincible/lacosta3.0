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
  const [role, setRole] = useState(null)
  const [uniSlug, setUniSlug] = useState(null)
  const [uniName, setUniName] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('lacosta-theme') || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('lacosta-theme', theme)
  }, [theme])

  useEffect(() => {
    api('/api/admin/me')
      .then((res) => {
        if (!res.ok) return setAuthed(false)
        return res.json().then((data) => {
          setAuthed(true)
          setRole(data.role ?? 'superuser')
          setUniSlug(data.university ?? null)
          setUniName(data.universityName ?? null)
        })
      })
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="admin-shell">
        <div className="admin-content" style={{ textAlign: 'center' }}>Checking…</div>
      </div>
    )
  }

  if (!authed) return <Login onLogin={(r, slug, name) => { setAuthed(true); setRole(r); setUniSlug(slug); setUniName(name) }} />

  return (
    <Dashboard
      role={role}
      uniSlug={uniSlug}
      uniName={uniName}
      onLogout={() => setAuthed(false)}
      theme={theme}
      onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    />
  )
}

function Login({ onLogin }) {
  const [loginMode, setLoginMode] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uniList, setUniList] = useState([])
  const [selectedUniSlug, setSelectedUniSlug] = useState('')

  useEffect(() => {
    if (loginMode === 'university') {
      api('/api/universities')
        .then((res) => res.json())
        .then((data) => setUniList(data.universities ?? []))
        .catch(() => {})
    }
  }, [loginMode])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    if (loginMode === 'admin') {
      const res = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setBusy(false)
      if (res.ok) onLogin('superuser', null)
      else setError('Wrong password')
    } else {
      if (!selectedUniSlug) {
        setBusy(false)
        return setError('Select a university')
      }
      const res = await api('/api/uni-login', {
        method: 'POST',
        body: JSON.stringify({ slug: selectedUniSlug, password }),
      })
      setBusy(false)
      if (res.ok) {
        const uniDisplayName = uniList.find((u) => u.slug === selectedUniSlug)?.name || selectedUniSlug
        onLogin('subuser', selectedUniSlug, uniDisplayName)
      }
      else setError('Wrong password or invalid university')
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <h1>Lacosta Admin</h1>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn ${loginMode === 'admin' ? '' : 'ghost'}`}
            style={{ flex: 1 }}
            onClick={() => { setLoginMode('admin'); setPassword(''); setError('') }}
          >
            Admin Login
          </button>
          <button
            type="button"
            className={`btn ${loginMode === 'university' ? '' : 'ghost'}`}
            style={{ flex: 1 }}
            onClick={() => { setLoginMode('university'); setPassword(''); setError('') }}
          >
            University Login
          </button>
        </div>
        {loginMode === 'university' && (
          <select
            value={selectedUniSlug}
            onChange={(e) => setSelectedUniSlug(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--adm-border)', marginBottom: '0.75rem' }}
            autoFocus
          >
            <option value="">— Select university —</option>
            {uniList.map((u) => (
              <option key={u.slug} value={u.slug}>{u.name}</option>
            ))}
          </select>
        )}
        <p>{loginMode === 'admin' ? 'Enter the admin password to manage your store.' : 'Enter your university admin password.'}</p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={loginMode === 'admin'}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function SuperuserPasswordPrompt({ open, onClose, onVerified }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setPassword(''); setError('') }
  }, [open])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api('/api/admin/verify-superuser', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setBusy(false)
      if (res.ok) {
        onVerified(true, password)
      } else {
        setError('Wrong password')
      }
    } catch {
      setBusy(false)
      setError('Network error')
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Superuser Verification</h2>
        <p>Enter the superuser password to continue.</p>
        <form onSubmit={submit}>
          <label className="form-field">
            <span>Superuser password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Superuser password"
              autoFocus
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={busy || !password}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordModal({ open, onClose, universitySlug }) {
  const [step, setStep] = useState('verify')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) { setStep('verify'); setNewPassword(''); setError(''); setSuccess(false) }
  }, [open])

  if (!open) return null

  const handleVerified = async () => {
    setStep('newpassword')
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api(`/api/admin/universities/${universitySlug}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      })
      setBusy(false)
      if (res.ok) {
        setSuccess(true)
        setTimeout(onClose, 1500)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to change password')
      }
    } catch {
      setBusy(false)
      setError('Network error')
    }
  }

  return (
    <>
      <SuperuserPasswordPrompt
        open={step === 'verify'}
        onClose={onClose}
        onVerified={handleVerified}
      />
      {step === 'newpassword' && (
        <div className="admin-modal-overlay" onClick={onClose}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change University Password</h2>
            <p>Enter the new password for this university admin.</p>
            {success ? (
              <p style={{ color: '#16a34a', fontWeight: 600 }}>Password changed successfully!</p>
            ) : (
              <form onSubmit={changePassword}>
                <label className="form-field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    autoFocus
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                  <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
                  <button type="submit" className="btn" disabled={busy || !newPassword}>
                    {busy ? 'Saving…' : 'Save new password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Dashboard({ role, uniSlug, uniName, onLogout, theme, onToggleTheme }) {
  const [db, setDb] = useState(null)
  const [tab, setTab] = useState('products')
  const [msg, setMsg] = useState(null)
  const [ngrokUrl, setNgrokUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [universities, setUniversities] = useState([])
  const [selectedUni, setSelectedUni] = useState(uniSlug ?? null)
  const [showAddUni, setShowAddUni] = useState(false)
  const [newUniName, setNewUniName] = useState('')
  const [newUniPassword, setNewUniPassword] = useState('')
  const [newUniEmail, setNewUniEmail] = useState('')
  const [newUniBusy, setNewUniBusy] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showEditEmail, setShowEditEmail] = useState(false)
  const [editEmailValue, setEditEmailValue] = useState('')
  const [editEmailBusy, setEditEmailBusy] = useState(false)
  const [emailVerifyPrompt, setEmailVerifyPrompt] = useState(false)
  const [showEditNotifyEmail, setShowEditNotifyEmail] = useState(false)
  const [editNotifyEmailValue, setEditNotifyEmailValue] = useState('')
  const [editNotifyEmailBusy, setEditNotifyEmailBusy] = useState(false)
  const [notifyEmailVerifyPrompt, setNotifyEmailVerifyPrompt] = useState(false)
  const [deleteOrderTarget, setDeleteOrderTarget] = useState(null)
  const [showDeleteUniPrompt, setShowDeleteUniPrompt] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const loadUniversities = () => {
    api('/api/universities').then((res) => res.json()).then((data) => {
      const list = data.universities ?? []
      setUniversities(list)
      if (role === 'subuser') {
        setSelectedUni(uniSlug)
      } else if (!selectedUni && list.length > 0) {
        setSelectedUni(list[0].slug)
      }
    }).catch(() => {})
  }

  useEffect(() => {
    loadUniversities()
    api('/api/admin/ngrok').then((res) => res.json()).then((d) => setNgrokUrl(d.url)).catch(() => {})
  }, [])

  const loadData = () => {
    if (!selectedUni) return
    api(`/api/admin/data?university=${encodeURIComponent(selectedUni)}`).then((res) => res.json()).then(setDb).catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [selectedUni])

  // Auto-refresh product data every 10s
  useEffect(() => {
    if (tab !== 'products' || !selectedUni) return
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [tab, selectedUni])

  const flash = (text) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  const save = async (section, value) => {
    const res = await api('/api/admin/data', {
      method: 'PUT',
      body: JSON.stringify({ section, value, university: selectedUni }),
    })
    if (res.ok) {
      setDb((prev) => ({ ...prev, [section]: value }))
      flash('Saved')
    } else {
      flash('Save failed — are you still logged in?')
    }
  }

  const addUniversity = async () => {
    if (!newUniName.trim()) return
    setNewUniBusy(true)
    try {
      const res = await api('/api/admin/universities', {
        method: 'POST',
        body: JSON.stringify({ name: newUniName.trim(), password: newUniPassword || undefined, email: newUniEmail.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        flash('University created')
        setNewUniName('')
        setNewUniPassword('')
        setNewUniEmail('')
        setShowAddUni(false)
        loadUniversities()
        if (data.university) {
          setSelectedUni(data.university.slug)
        }
      } else {
        flash(data.error ?? 'Failed to create university')
      }
    } catch {
      flash('Failed to create university')
    }
    setNewUniBusy(false)
  }

  const deleteUniversity = async (slug, superuserPassword) => {
    try {
      const res = await api(`/api/admin/universities/${slug}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: superuserPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        flash('University deleted')
        setSelectedUni(null)
        loadUniversities()
      } else {
        flash(data.error ?? 'Failed to delete university')
      }
    } catch {
      flash('Failed to delete university')
    }
  }

  // Full-page product editor routes
  const [duplicateProduct, setDuplicateProduct] = useState(null)
  const isNewProduct = location.pathname === `${ADMIN_PATH}/products/new`
  const editMatch = location.pathname.match(/\/products\/(\d+)\/edit$/)
  const editProductId = editMatch ? Number(editMatch[1]) : null
  const editingProduct = isNewProduct
    ? (duplicateProduct
        ? { ...duplicateProduct, id: 0, name: `${duplicateProduct.name} (copy)` }
        : { ...emptyProduct(), category: db?.categories?.find((c) => c.name !== 'All')?.name ?? '', university: selectedUni })
    : editProductId != null
      ? (db?.catalogProducts ?? []).find((p) => Number(p.id) === editProductId) ?? null
      : null
  const onProductEditor = Boolean(editingProduct)

  useEffect(() => {
    if (!onProductEditor) setDuplicateProduct(null)
  }, [onProductEditor])

  const saveProduct = async (product) => {
    try {
      const toSave = { ...product, university: selectedUni }
      const res = await api('/api/admin/products', {
        method: product.id ? 'PUT' : 'POST',
        body: JSON.stringify(toSave),
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
    if (role === 'subuser') {
      await api('/api/uni-logout', { method: 'POST' })
    } else {
      await api('/api/logout', { method: 'POST' })
    }
    onLogout()
  }

  if (!db) return (
    <div className="admin-shell">
      <div className="admin-content" style={{ textAlign: 'center', padding: '3rem' }}>
        {universities.length === 0 ? (
          <>
            <h2>Welcome to Lacosta Admin</h2>
            <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>Create a university to get started.</p>
            <div style={{ marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="e.g. University of Nairobi"
                value={newUniName}
                onChange={(e) => setNewUniName(e.target.value)}
                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '0.5rem', width: '260px' }}
              />
              <input
                type="password"
                placeholder="Admin password (optional)"
                value={newUniPassword}
                onChange={(e) => setNewUniPassword(e.target.value)}
                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '0.5rem', width: '200px' }}
              />
              <input
                type="email"
                placeholder="Sending email (optional)"
                value={newUniEmail}
                onChange={(e) => setNewUniEmail(e.target.value)}
                style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '0.5rem', width: '260px' }}
              />
              <button className="btn" disabled={newUniBusy || !newUniName.trim()} onClick={addUniversity}>
                {newUniBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </>
        ) : (
          <div>Loading…</div>
        )}
      </div>
    </div>
  )

  const allTabs = [
    { id: 'products', label: 'Products' },
    { id: 'customers', label: 'Customers' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'featured', label: 'Featured deals' },
    { id: 'categories', label: 'Categories' },
    { id: 'menus', label: 'Subcategories' },
    { id: 'content', label: 'Site content' },
    ...(role === 'superuser' ? [{ id: 'sales', label: 'Daily Sales' }] : []),
  ]
  const tabs = allTabs

  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="admin-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="Lacosta" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'contain' }} />
          <div>
            <h1>Lacosta Admin</h1>
            <small>{role === 'subuser' ? (uniName || uniSlug) : 'Manage your store'}</small>
          </div>
        </div>
        <div className="admin-bar-actions">
          {role === 'subuser' && (
            <button type="button" className="btn ghost small" onClick={() => setShowChangePassword(true)}>
              Change Password
            </button>
          )}
          <a
            href="https://lacostamarkets.site"
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost small ngrok-badge"
            title="Open your store"
          >
            <span className="site-logo"><img src="/logo.png" alt="Lacosta" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} /></span> lacostamarkets.site
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

      {role === 'superuser' && (
      <div className="admin-university-bar">
        <div className="uni-selector">
          <label>University:</label>
          <select
            value={selectedUni ?? ''}
            onChange={(e) => setSelectedUni(e.target.value)}
          >
            {universities.length === 0 && <option value="">— none —</option>}
            {universities.map((u) => (
              <option key={u.slug} value={u.slug}>{u.name}</option>
            ))}
          </select>
          {selectedUni && (
            <button type="button" className="btn danger small" onClick={() => setShowDeleteUniPrompt(true)}>
              Delete
            </button>
          )}
          {selectedUni && (
            <button type="button" className="btn small" onClick={() => setShowChangePassword(true)}>
              Change Password
            </button>
          )}
          {selectedUni && (
            <button type="button" className="btn small" onClick={() => {
              const uni = universities.find((u) => u.slug === selectedUni)
              setEditEmailValue(uni?.email ?? '')
              setShowEditEmail(true)
            }}>
              Change Email
            </button>
          )}
          {selectedUni && (() => {
            const uni = universities.find((u) => u.slug === selectedUni)
            return uni?.email ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                From: {uni.email}
              </span>
            ) : null
          })()}
          {selectedUni && (
            <button type="button" className="btn small" onClick={() => {
              const uni = universities.find((u) => u.slug === selectedUni)
              setEditNotifyEmailValue(uni?.notify_email ?? '')
              setShowEditNotifyEmail(true)
            }}>
              Notify Email
            </button>
          )}
          {selectedUni && (() => {
            const uni = universities.find((u) => u.slug === selectedUni)
            return uni?.notify_email ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                Notify: {uni.notify_email}
              </span>
            ) : null
          })()}
        </div>
        <button type="button" className="btn small" onClick={() => setShowAddUni(true)}>
          + Add University
        </button>
      </div>
      )}

      {showAddUni && (
        <div className="admin-modal-overlay" onClick={() => setShowAddUni(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add University</h2>
            <p>Enter the name for the new university. This will create a separate product catalog.</p>
            <label className="form-field">
              <span>University name</span>
              <input
                value={newUniName}
                onChange={(e) => setNewUniName(e.target.value)}
                placeholder="e.g. University of Nairobi"
                autoFocus
              />
            </label>
            <label className="form-field">
              <span>Admin password (optional)</span>
              <input
                type="password"
                value={newUniPassword}
                onChange={(e) => setNewUniPassword(e.target.value)}
                placeholder="Password for university admin login"
              />
            </label>
            <label className="form-field">
              <span>Sending email (optional)</span>
              <input
                type="email"
                value={newUniEmail}
                onChange={(e) => setNewUniEmail(e.target.value)}
                placeholder="e.g. lacostamarketsmamangina@gmail.com"
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowAddUni(false)}>Cancel</button>
              <button type="button" className="btn" disabled={newUniBusy || !newUniName.trim()} onClick={addUniversity}>
                {newUniBusy ? 'Creating…' : 'Create university'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        {!selectedUni ? (
          <div className="admin-panel">
            <h2>Select a University</h2>
            <p className="panel-hint">Choose a university from the dropdown above to manage its products, orders, and content. Or add a new university to get started.</p>
          </div>
        ) : onProductEditor ? (
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
              <ProductsTab products={db.catalogProducts} onSave={(v) => save('catalogProducts', v)} onDuplicate={(p) => { setDuplicateProduct(p); navigate(`${ADMIN_PATH}/products/new`) }} />
            )}
            {tab === 'customers' && (
              <CustomersTab university={selectedUni} role={role} />
            )}
            {tab === 'orders' && (
              <OrdersTab university={selectedUni} role={role} />
            )}
            {tab === 'payments' && (
              <PaymentsTab university={selectedUni} role={role} baseUrl={ngrokUrl || 'https://lacostamarkets.site'} />
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
            {tab === 'sales' && role === 'superuser' && (
              <DailySalesTab university={selectedUni} />
            )}
          </>
        )}
      </main>

      <SuperuserPasswordPrompt
        open={showDeleteUniPrompt}
        onClose={() => setShowDeleteUniPrompt(false)}
        onVerified={(ok) => { if (ok) deleteUniversity(selectedUni) }}
      />

      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        universitySlug={selectedUni}
      />

      {showEditEmail && (
        <div className="admin-modal-overlay" onClick={() => setShowEditEmail(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change sending email</h2>
            <p>Set the email address that outgoing emails will be sent from for <strong>{selectedUni}</strong>.</p>
            <label className="form-field">
              <span>Email address</span>
              <input
                type="email"
                value={editEmailValue}
                onChange={(e) => setEditEmailValue(e.target.value)}
                placeholder="e.g. lacostamarketsmamangina@gmail.com"
                autoFocus
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowEditEmail(false)}>Cancel</button>
              <button type="button" className="btn" disabled={editEmailBusy || !editEmailValue.trim()} onClick={() => setEmailVerifyPrompt(true)}>
                {editEmailBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SuperuserPasswordPrompt
        open={emailVerifyPrompt}
        onClose={() => setEmailVerifyPrompt(false)}
        onVerified={async (ok) => {
          if (!ok) return
          setEditEmailBusy(true)
          const res = await api(`/api/admin/universities/${selectedUni}/email`, {
            method: 'PUT',
            body: JSON.stringify({ email: editEmailValue.trim() }),
          })
          setEditEmailBusy(false)
          setEmailVerifyPrompt(false)
          if (res.ok) {
            flash('Email updated')
            setShowEditEmail(false)
            loadUniversities()
          }
        }}
      />

      {showEditNotifyEmail && (
        <div className="admin-modal-overlay" onClick={() => setShowEditNotifyEmail(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change notification email</h2>
            <p>Set the email that receives order notifications for <strong>{selectedUni}</strong>.</p>
            <label className="form-field">
              <span>Notification email</span>
              <input
                type="email"
                value={editNotifyEmailValue}
                onChange={(e) => setEditNotifyEmailValue(e.target.value)}
                placeholder="e.g. lacostamarketsmnuc@gmail.com"
                autoFocus
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowEditNotifyEmail(false)}>Cancel</button>
              <button type="button" className="btn" disabled={editNotifyEmailBusy || !editNotifyEmailValue.trim()} onClick={() => setNotifyEmailVerifyPrompt(true)}>
                {editNotifyEmailBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SuperuserPasswordPrompt
        open={notifyEmailVerifyPrompt}
        onClose={() => setNotifyEmailVerifyPrompt(false)}
        onVerified={async (ok) => {
          if (!ok) return
          setEditNotifyEmailBusy(true)
          const res = await api(`/api/admin/universities/${selectedUni}/notify-email`, {
            method: 'PUT',
            body: JSON.stringify({ notify_email: editNotifyEmailValue.trim() }),
          })
          setEditNotifyEmailBusy(false)
          setNotifyEmailVerifyPrompt(false)
          if (res.ok) {
            flash('Notification email updated')
            setShowEditNotifyEmail(false)
            loadUniversities()
          }
        }}
      />

      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}

function ImageField({ value, onChange, placeholder }) {
  const [busy, setBusy] = useState(false)
  const [inputVal, setInputVal] = useState(value ?? '')

  const upload = async (file) => {
    setBusy(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await api('/api/admin/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.url) onChange(json.url)
    setBusy(false)
  }

  const submitUrl = () => {
    const trimmed = inputVal.trim()
    if (trimmed) {
      onChange(trimmed)
      setInputVal('')
    }
  }

  return (
    <div className="image-field">
      {value && <img src={value} alt="" />}
      <input
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitUrl() } }}
        placeholder={placeholder ?? 'Image URL or /uploads/…'}
      />
      {inputVal.trim() ? (
        <button type="button" className="btn ghost small" style={{ margin: 0 }} onClick={submitUrl}>Add</button>
      ) : (
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
      )}
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
    priceNum: 0,
    oldPriceNum: '',
    unitPrice: '',
    image: '',
    images: [],
    seller: '',
    rating: 4.5,
    brand: '',
    subcategory: '',
    description: '',
    specs: [],
    outOfStock: false,
    quantity: 0,
  }
}

function ProductForm({ initial, categories, onSave, onCancel }) {
  const [product, setProduct] = useState(() => {
    const imgs = initial.images?.length ? initial.images : (initial.image ? [initial.image] : [])
    const priceNum = (initial.priceNum ?? parseFloat(String(initial.price ?? '').replace(/[^\d.]/g, ''))) || 0
    const oldPriceNum = initial.oldPriceNum ?? (initial.oldPrice ? parseFloat(String(initial.oldPrice).replace(/[^\d.]/g, '')) : '')
    return { ...initial, images: imgs, priceNum, oldPriceNum }
  })
  const set = (key, value) => setProduct((prev) => ({ ...prev, [key]: value }))

  const addImage = (url) => {
    setProduct((prev) => {
      const imgs = [...prev.images, url]
      return { ...prev, images: imgs, image: imgs[0] ?? '' }
    })
  }

  const removeImage = (idx) => {
    setProduct((prev) => {
      const imgs = prev.images.filter((_, i) => i !== idx)
      return { ...prev, images: imgs, image: imgs[0] ?? '' }
    })
  }

  const moveImage = (idx, dir) => {
    setProduct((prev) => {
      const imgs = [...prev.images]
      const target = idx + dir
      if (target < 0 || target >= imgs.length) return prev
      ;[imgs[idx], imgs[target]] = [imgs[target], imgs[idx]]
      return { ...prev, images: imgs, image: imgs[0] ?? '' }
    })
  }

  const submit = () => {
    const priceNum = parseFloat(product.priceNum) || 0
    const oldPriceNum = product.oldPriceNum !== '' && product.oldPriceNum != null ? parseFloat(product.oldPriceNum) : null
    const next = {
      ...product,
      price_num: priceNum,
      old_price_num: oldPriceNum,
      price: priceNum > 0 ? `KSh ${priceNum.toLocaleString()}` : '',
      oldPrice: oldPriceNum != null && oldPriceNum > 0 ? `KSh ${oldPriceNum.toLocaleString()}` : '',
      specs: (product.specs || []).join(',').split(',').map((s) => s.trim()).filter(Boolean),
      image: product.images[0] ?? product.image ?? '',
    }
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
          <label>Price (KSh)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <span style={{ padding: '0.6rem 0.75rem', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '8px 0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>KSh</span>
            <input type="number" min="0" step="0.01" style={{ borderRadius: '0 8px 8px 0' }} value={product.priceNum ?? ''} onChange={(e) => set('priceNum', e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-field">
          <label>Old price (KSh, strikethrough)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <span style={{ padding: '0.6rem 0.75rem', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '8px 0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>KSh</span>
            <input type="number" min="0" step="0.01" style={{ borderRadius: '0 8px 8px 0' }} value={product.oldPriceNum ?? ''} onChange={(e) => set('oldPriceNum', e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-field">
          <label>Unit price text</label>
          <input type="text" value={product.unitPrice ?? ''} onChange={(e) => set('unitPrice', e.target.value)} placeholder="e.g. per piece, /kg, per 500ml" />
          <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
            Shows below the price as <strong>@ per piece</strong>. Leave empty to hide.
          </small>
          {product.unitPrice && product.priceNum > 0 && (
            <div style={{ marginTop: '6px', padding: '6px 10px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Preview: <strong>KSh {Number(product.priceNum).toLocaleString()}</strong> <span style={{ opacity: 0.7 }}>@ {product.unitPrice}</span>
            </div>
          )}
        </div>
        <div className="form-field">
          <label>Quantity in stock</label>
          <input type="number" min="0" value={product.quantity ?? 0} onChange={(e) => set('quantity', Math.max(0, parseInt(e.target.value) || 0))} />
          <small className="muted" style={{ display: 'block', marginTop: '4px' }}>
            Stock will be subtracted automatically when an order is marked as paid.
          </small>
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
          <label>Images (first image is the main product image)</label>
          <div className="images-list">
            {product.images.map((img, idx) => (
              <div key={idx} className="images-list-item">
                <img src={img} alt="" />
                <div className="images-list-actions">
                  {idx > 0 && <button type="button" className="btn ghost small" onClick={() => moveImage(idx, -1)} title="Move left">←</button>}
                  {idx < product.images.length - 1 && <button type="button" className="btn ghost small" onClick={() => moveImage(idx, 1)} title="Move right">→</button>}
                  <button type="button" className="btn danger small" onClick={() => removeImage(idx)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
          <ImageField value="" onChange={(v) => { if (v) addImage(v) }} placeholder="Add image URL or upload…" />
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

function ProductsTab({ products, onSave, onDuplicate }) {
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
              <tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Qty</th><th>Rating</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.image && <img src={p.image} alt="" />}</td>
                  <td><strong>{p.name}</strong>{p.outOfStock ? <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, marginLeft: '6px' }}>OUT OF STOCK</span> : null}{p.brand ? <div className="muted">{p.brand}{p.subcategory ? ` · ${p.subcategory}` : ''}</div> : null}</td>
                  <td>{p.category}</td>
                  <td>{p.price}</td>
                  <td>{p.quantity ?? 0}</td>
                  <td>★ {p.rating}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn ghost small" onClick={() => onDuplicate(p)}>Duplicate</button>{' '}
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
const PAYMENT_STATUS_LABELS = { pending: 'Unpaid', paid: 'Paid', failed: 'Failed' }

function CustomersTab({ university, role }) {
  const [customers, setCustomers] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [uniTarget, setUniTarget] = useState(null)
  const [uniList, setUniList] = useState([])
  const [uniNew, setUniNew] = useState('')
  const [uniBusy, setUniBusy] = useState(false)
  const [uniError, setUniError] = useState(null)

  const load = async () => {
    setRefreshing(true)
    try {
      const res = await api(`/api/admin/customers?university=${encodeURIComponent(university ?? '')}`)
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
  }, [university])

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

  const openUniModal = async (customer) => {
    setUniTarget(customer)
    setUniNew('')
    setUniError(null)
    if (uniList.length === 0) {
      try {
        const res = await api('/api/universities')
        const data = await res.json()
        setUniList(data.universities ?? [])
      } catch {}
    }
  }

  const changeUniversity = async () => {
    if (!uniTarget || !uniNew) return
    setUniBusy(true)
    setUniError(null)
    try {
      const res = await api(`/api/admin/customers/${uniTarget.id}/university`, {
        method: 'PUT',
        body: JSON.stringify({ university: uniNew }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCustomers((prev) => prev.filter((c) => c.id !== uniTarget.id))
        setUniTarget(null)
        setUniNew('')
      } else {
        setUniError(data.error ?? 'Failed')
      }
    } catch {
      setUniError('Network error')
    }
    setUniBusy(false)
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
                    <td className="nowrap" style={{ display: 'flex', gap: '0.4rem' }}>
                      {role === 'superuser' && (
                        <button
                          type="button"
                          className="btn small"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                          onClick={() => openUniModal(c)}
                        >
                          Change Univ
                        </button>
                      )}
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

      {uniTarget && (
        <div className="admin-modal-overlay" onClick={() => setUniTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Change university</h2>
            <p>Move <strong>{uniTarget.displayName || uniTarget.username || uniTarget.email}</strong> from <strong>{uniTarget.university}</strong> to another university. Their cart will be cleared.</p>
            <label className="form-field">
              <span>New university</span>
              <select
                value={uniNew}
                onChange={(e) => setUniNew(e.target.value)}
                autoFocus
              >
                <option value="">Select university…</option>
                {uniList.map((u) => (
                  <option key={u.slug} value={u.slug} disabled={u.slug === uniTarget.university}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            {uniError && <p className="error">{uniError}</p>}
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setUniTarget(null)}>Cancel</button>
              <button type="button" className="btn" disabled={uniBusy || !uniNew} onClick={changeUniversity}>
                {uniBusy ? 'Moving…' : 'Move user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrdersTab({ university, role }) {
  const [orders, setOrders] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [selected, setSelected] = useState([])
  const [viewOrder, setViewOrder] = useState(null)
  const [deleteOrderPrompt, setDeleteOrderPrompt] = useState(null)

  const load = () => {
    api(`/api/admin/orders?university=${encodeURIComponent(university ?? '')}`)
      .then((res) => res.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [university])

  const setStatus = async (id, status) => {
    setBusyId(id)
    const res = await api(`/api/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    setBusyId(null)
    if (res.ok) load()
  }

  const setPaymentStatus = async (id, payment_status) => {
    setBusyId(id)
    const res = await api(`/api/admin/orders/${id}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ payment_status }),
    })
    setBusyId(null)
    if (res.ok) load()
  }

  const removeOrder = async (id, password) => {
    setBusyId(id)
    const res = await api(`/api/admin/orders/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    })
    setBusyId(null)
    if (res.ok) {
      if (viewOrder?.id === id) setViewOrder(null)
      load()
    }
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
            {orders.length} orders total · {orders.filter((o) => o.status === 'pending').length} pending · {orders.filter((o) => (o.payment_status ?? 'pending') !== 'paid').length} unpaid
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
                <th>Payment</th>
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
                  <td>
                    <span className={`status-badge payment-${order.payment_status ?? 'pending'}`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status ?? 'pending'] ?? order.payment_status}
                    </span>
                  </td>
                  <td className="nowrap">
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => setViewOrder(order)}
                    >
                      View
                    </button>{' '}
                    {(order.payment_status ?? 'pending') !== 'paid' ? (
                      <button
                        type="button"
                        className="btn small paid-btn"
                        disabled={busyId === order.id || order.status === 'canceled'}
                        onClick={() => setPaymentStatus(order.id, 'paid')}
                      >
                        Mark Paid
                      </button>
                    ) : (
                      <span className="status-badge payment-paid">Paid</span>
                    )}{' '}
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
                      onClick={() => setDeleteOrderPrompt(order)}
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

      {viewOrder && (
        <div className="admin-modal-overlay" onClick={() => setViewOrder(null)}>
          <div className="admin-modal order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-detail-head">
              <div>
                <h2>Order #{viewOrder.id}</h2>
                <p className="muted">{fmtTime(viewOrder.created_at)}</p>
              </div>
              <span className={`status-badge status-${viewOrder.status}`}>
                {STATUS_LABELS[viewOrder.status] ?? viewOrder.status}
              </span>
              <span className={`status-badge payment-${viewOrder.payment_status ?? 'pending'}`} style={{ marginLeft: '0.5rem' }}>
                {PAYMENT_STATUS_LABELS[viewOrder.payment_status ?? 'pending'] ?? viewOrder.payment_status}
              </span>
            </div>

            <div className="order-detail-customer">
              <h3>Customer</h3>
              <p><strong>{viewOrder.name}</strong></p>
              <p className="muted">{viewOrder.phone}</p>
              <p className="muted">{viewOrder.email}</p>
            </div>

            <div className="order-detail-items">
              <h3>Items</h3>
              {(viewOrder.items ?? []).map((item, idx) => (
                <div key={idx} className="order-detail-item">
                  {item.image && <img src={item.image} alt={item.name} className="order-detail-img" />}
                  <div className="order-detail-item-info">
                    <strong>{item.name}</strong>
                    {item.brand && <div className="muted">{item.brand}{item.subcategory ? ` · ${item.subcategory}` : ''}</div>}
                    {item.description && <p className="order-detail-desc">{item.description}</p>}
                    {Array.isArray(item.specs) && item.specs.length > 0 && (
                      <div className="order-detail-specs">
                        {item.specs.map((spec) => (
                          <span key={spec} className="order-detail-spec">{spec}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="order-detail-item-right">
                    <span className="muted">× {item.qty ?? 1}</span>
                    <strong>{item.price}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-detail-total">
              <span>Total</span>
              <strong>{viewOrder.total}</strong>
            </div>

            <div className="form-actions">
              {(viewOrder.payment_status ?? 'pending') !== 'paid' && (
                <button
                  type="button"
                  className="btn paid-btn"
                  disabled={busyId === viewOrder.id}
                  onClick={async () => {
                    await setPaymentStatus(viewOrder.id, 'paid')
                    setViewOrder((prev) => prev ? { ...prev, payment_status: 'paid' } : prev)
                  }}
                >
                  Mark as Paid
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <SuperuserPasswordPrompt
        open={deleteOrderPrompt !== null}
        onClose={() => setDeleteOrderPrompt(null)}
        onVerified={(ok, pw) => { if (ok && deleteOrderPrompt) removeOrder(deleteOrderPrompt.id, pw); setDeleteOrderPrompt(null) }}
      />
    </div>
  )
}

function PaymentsTab({ university, role, baseUrl }) {
  const [config, setConfig] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [environment, setEnvironment] = useState('sandbox')
  const [tillNumber, setTillNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [superuserPrompt, setSuperuserPrompt] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)

  useEffect(() => {
    if (!university) return
    api(`/api/payments/config/${university}/admin`)
      .then((res) => res.json())
      .then((data) => {
        setConfig(data)
        setEnvironment(data.environment ?? 'sandbox')
        setTillNumber(data.tillNumber ?? '')
        setApiKey('')
        setWebhookSecret('')
      })
      .catch(() => setConfig({ configured: false }))
  }, [university])

  const flash = (text) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  const saveConfig = async () => {
    setBusy(true)
    try {
      const body = {
        environment,
        tillNumber: tillNumber.trim() || null,
      }
      if (apiKey.trim()) body.apiKey = apiKey.trim()
      if (webhookSecret.trim()) body.webhookSecret = webhookSecret.trim()

      const res = await api(`/api/payments/config/${university}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        flash('Payment config saved')
        // Reload config
        const updated = await api(`/api/payments/config/${university}/admin`).then(r => r.json())
        setConfig(updated)
        setApiKey('')
        setWebhookSecret('')
      } else {
        flash('Failed to save — are you logged in?')
      }
    } catch {
      flash('Failed to save')
    }
    setBusy(false)
  }

  const handleSave = () => {
    if (role === 'subuser') {
      setSuperuserPrompt(true)
      setPendingSave(true)
    } else {
      saveConfig()
    }
  }

  const webhookUrl = `${baseUrl}/api/payments/webhook/${university}`

  if (!config) return <div className="admin-panel"><p>Loading...</p></div>

  if (role === 'subuser') {
    return (
      <div className="admin-panel">
        <h2>Payment Status</h2>
        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>M-Pesa payments:</strong>{' '}
            {config.configured ? (
              <span style={{ color: '#16a34a' }}>Configured</span>
            ) : (
              <span style={{ color: '#dc2626' }}>Not configured</span>
            )}
          </p>
          {config.configured && (
            <>
              <p><strong>Environment:</strong> {config.environment}</p>
              {config.tillNumber && <p><strong>Till number:</strong> {config.tillNumber}</p>}
            </>
          )}
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Contact the super admin to configure payment settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Payment Settings</h2>
          <p className="panel-hint">Configure Lipana M-Pesa for this university. Each university uses its own till account.</p>
        </div>
      </div>

      {msg && <p style={{ padding: '0.5rem 1rem', background: '#f0fdf4', borderRadius: '8px', marginBottom: '1rem', color: '#166534' }}>{msg}</p>}

      <div style={{ display: 'grid', gap: '1.25rem', maxWidth: '500px' }}>
        <label className="form-field">
          <span>Lipana API Key</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.apiKeyPreview ? `Existing key ends with ${config.apiKeyPreview}` : 'lip_sk_live_... or lip_sk_test_...'}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn ghost small" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {config.apiKeyPreview && !apiKey && (
            <small style={{ color: 'var(--text-secondary)' }}>Current: {config.apiKeyPreview}</small>
          )}
        </label>

        <label className="form-field">
          <span>Webhook Secret</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showWebhookSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={config.hasWebhookSecret ? '•••••••• (set, leave blank to keep)' : 'whsec_...'}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn ghost small" onClick={() => setShowWebhookSecret(!showWebhookSecret)}>
              {showWebhookSecret ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label className="form-field">
          <span>Till Number</span>
          <input
            type="text"
            value={tillNumber}
            onChange={(e) => setTillNumber(e.target.value)}
            placeholder="e.g. 123456"
          />
          <small style={{ color: 'var(--text-secondary)' }}>Optional — displayed to university admin</small>
        </label>

        <label className="form-field">
          <span>Environment</span>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="radio" name="env" value="sandbox" checked={environment === 'sandbox'} onChange={() => setEnvironment('sandbox')} />
              Sandbox (testing)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="radio" name="env" value="production" checked={environment === 'production'} onChange={() => setEnvironment('production')} />
              Production (live)
            </label>
          </div>
        </label>

        <div style={{ marginTop: '0.5rem' }}>
          <label className="form-field">
            <span>Webhook URL</span>
            <input
              type="text"
              value={webhookUrl}
              readOnly
              style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
              onClick={(e) => { navigator.clipboard.writeText(webhookUrl); e.target.select() }}
            />
            <small style={{ color: 'var(--text-secondary)' }}>Configure this URL in your Lipana dashboard. Click to copy.</small>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving...' : 'Save payment config'}
          </button>
          {config.configured && (
            <span style={{ alignSelf: 'center', color: '#16a34a', fontSize: '0.9rem' }}>
              Configured ({config.environment})
            </span>
          )}
        </div>
      </div>

      <SuperuserPasswordPrompt
        open={superuserPrompt}
        onClose={() => { setSuperuserPrompt(false); setPendingSave(false) }}
        onVerified={(ok) => {
          if (ok && pendingSave) saveConfig()
          setSuperuserPrompt(false)
          setPendingSave(false)
        }}
      />
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

function DailySalesTab({ university }) {
  const [sales, setSales] = useState([])
  const [days, setDays] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const qs = `?days=${days}${university ? `&university=${encodeURIComponent(university)}` : ''}`
      const res = await api(`/api/admin/orders/daily-sales${qs}`)
      const data = await res.json()
      setSales(data.sales ?? [])
    } catch {}
    setRefreshing(false)
  }

  useEffect(() => {
    load()
  }, [days, university])

  const fmt = (n) => `KSh ${(n ?? 0).toLocaleString()}`
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })

  const totals = sales.reduce((acc, s) => ({
    orders: acc.orders + s.total_orders,
    revenue: acc.revenue + s.total_revenue,
    paidOrders: acc.paidOrders + s.paid_orders,
    paidRevenue: acc.paidRevenue + s.paid_revenue,
  }), { orders: 0, revenue: 0, paidOrders: 0, paidRevenue: 0 })

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Daily Sales</h2>
          <p className="panel-hint">
            Revenue tracking — saved per day per university. Only superusers can access this.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="btn ghost small" onClick={load} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Total Orders</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totals.orders}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Total Revenue</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{fmt(totals.revenue)}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Paid Orders</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totals.paidOrders}</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Paid Revenue</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{fmt(totals.paidRevenue)}</div>
        </div>
      </div>

      {sales.length === 0 ? (
        <p className="muted">No sales data yet. Sales are tracked when orders are placed and paid.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table orders-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>University</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Paid</th>
                <th>Paid Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={`${s.university}-${s.sale_date}`}>
                  <td className="nowrap">{fmtDate(s.sale_date)}</td>
                  <td>{s.university}</td>
                  <td>{s.total_orders}</td>
                  <td className="nowrap">{fmt(s.total_revenue)}</td>
                  <td>{s.paid_orders}</td>
                  <td className="nowrap" style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(s.paid_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}