import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { initDb, pool } from './db.js'
import { authRouter, userFromSession } from './auth.js'
import { cartRouter } from './cart.js'
import { orderRouter, orderAdminRouter, getCustomers } from './orders.js'
import { paymentRouter, getPaymentConfigAdmin, savePaymentConfigAdmin } from './payment-routes.js'
import { errorHandler } from './error-tracker.js'
import { seoRouter } from './seo.js'

// Password hashing for university passwords (scrypt, same as auth.js)
const keylen = 64
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, keylen).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, keylen)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

const root = path.resolve(import.meta.dirname, '..')
const dataFile = path.join(import.meta.dirname, 'data.json')
const uploadsDir = path.join(root, 'public', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

const SECTIONS = [
  'categories',
  'featuredProducts',
  'catalogProducts',
  'deals',
  'trendingProducts',
  'benefits',
  'siteContent',
  'categoryMenus',
]

const sessions = new Set()

// Cache for site data (refreshed periodically)
let siteDataCache = null
let siteDataCacheTime = 0
const SITE_CACHE_TTL = 5000 // 5 seconds

// Allow other modules (e.g. orders.js) to invalidate the cache
process.on('invalidate-data-cache', () => {
  siteDataCache = null
})

async function readData(university) {
  try {
    const now = Date.now()
    const cacheKey = university || 'default'
    if (siteDataCache && siteDataCache._cacheKey === cacheKey && now - siteDataCacheTime < SITE_CACHE_TTL) {
      return siteDataCache
    }

    const uniFilter = university || 'default'

    // Read site data sections from database for this university
    const result = await pool.query(
      'SELECT section, value FROM site_data WHERE university = $1',
      [uniFilter]
    )
    const dbData = {}
    for (const row of result.rows) {
      dbData[row.section] = row.value
    }

    // Read products from database for this university
    const productsResult = await pool.query(
      'SELECT * FROM products WHERE active = true AND university = $1 ORDER BY id',
      [uniFilter]
    )
    dbData.catalogProducts = productsResult.rows.map(p => {
      const images = p.images?.length ? p.images : (p.image ? [p.image] : [])
      const priceNum = (p.price_num ?? parseFloat(String(p.price ?? '').replace(/[^\d.]/g, ''))) || 0
      const oldPriceNum = p.old_price_num ?? (p.old_price ? parseFloat(String(p.old_price).replace(/[^\d.]/g, '')) : null)
      const priceFormatted = priceNum > 0 ? `KSh ${priceNum.toLocaleString()}` : p.price ?? ''
      const oldPriceFormatted = oldPriceNum != null && oldPriceNum > 0 ? `KSh ${oldPriceNum.toLocaleString()}` : p.old_price ?? ''
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        subcategory: p.subcategory,
        price: priceFormatted,
        oldPrice: oldPriceFormatted,
        priceNum,
        oldPriceNum,
        unitPrice: p.unit_price ?? '',
        seller: p.seller,
        rating: Number(p.rating),
        image: p.image,
        images,
        description: p.description,
        specs: p.specs,
        badge: p.badge,
        outOfStock: p.out_of_stock || p.quantity <= 0,
        quantity: p.quantity,
      }
    })

    // Merge with fallback data from JSON file
    const fallback = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    siteDataCache = { ...fallback, ...dbData, _cacheKey: cacheKey }
    siteDataCacheTime = now
    return siteDataCache
  } catch (err) {
    console.error('Database read failed, using JSON fallback:', err.message)
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  }
}

async function writeSection(section, value, university) {
  const uni = university || 'default'
  try {
    await pool.query(
      `INSERT INTO site_data (section, university, value, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (section, university) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [section, uni, JSON.stringify(value)]
    )
    siteDataCache = null
  } catch (err) {
    console.error('Database write failed:', err.message)
    throw err
  }
}

async function writeProduct(product) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const autoOutOfStock = (product.quantity ?? 0) <= 0
    const university = product.university || 'default'
    const images = product.images?.length ? product.images : (product.image ? [product.image] : [])
    const primaryImage = images[0] ?? product.image ?? null
    const priceNum = parseFloat(product.price_num) || parseFloat(String(product.price ?? '').replace(/[^\d.]/g, '')) || 0
    const oldPriceNum = product.old_price_num != null && product.old_price_num !== '' ? parseFloat(product.old_price_num) : null
    const priceText = priceNum > 0 ? `KSh ${priceNum.toLocaleString()}` : ''
    const oldPriceText = oldPriceNum != null && oldPriceNum > 0 ? `KSh ${oldPriceNum.toLocaleString()}` : null
    if (product.id) {
      await client.query(
        `UPDATE products SET name = $1, category = $2, brand = $3, subcategory = $4,
         price = $5, old_price = $6, price_num = $7, old_price_num = $8,
         seller = $9, rating = $10, image = $11,
         description = $12, specs = $13, badge = $14, out_of_stock = $15, quantity = $16,
         university = $17, images = $18, unit_price = $19, updated_at = now()
         WHERE id = $20`,
        [product.name, product.category, product.brand ?? null, product.subcategory ?? null,
         priceText, oldPriceText, priceNum, oldPriceNum,
         product.seller ?? null, product.rating ?? 4.5,
         primaryImage, product.description ?? null, JSON.stringify(product.specs ?? []),
         product.badge ?? null, autoOutOfStock, product.quantity ?? 0, university,
         JSON.stringify(images), product.unit_price ?? null, product.id]
      )
    } else {
      const result = await client.query(
        `INSERT INTO products (name, category, brand, subcategory, price, old_price, price_num, old_price_num,
         seller, rating, image, description, specs, badge, out_of_stock, quantity, university, images, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id`,
        [product.name, product.category, product.brand ?? null, product.subcategory ?? null,
         priceText, oldPriceText, priceNum, oldPriceNum,
         product.seller ?? null, product.rating ?? 4.5,
         primaryImage, product.description ?? null, JSON.stringify(product.specs ?? []),
         product.badge ?? null, autoOutOfStock, product.quantity ?? 0, university,
         JSON.stringify(images), product.unit_price ?? null]
      )
      product.id = result.rows[0].id
    }
    await client.query('COMMIT')
    siteDataCache = null
    return product
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Product write failed:', err.message)
    throw err
  } finally {
    client.release()
  }
}

const app = express()
app.set('trust proxy', 1)

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disable for inline scripts in admin
  crossOriginEmbedderPolicy: false,
}))

// General rate limiter: 100 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use(generalLimiter)

// Strict limiter for auth routes: 10 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
})

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

function requireAuth(req, res, next) {
  if (sessions.has(req.cookies.adminToken)) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// ---------- Public ----------
app.get('/api/data', async (req, res) => {
  // Check if user is authenticated and has a university
  const user = await userFromSession(req)
  const university = user?.university || null
  const data = await readData(university)
  res.json(data)
})

// ---------- Universities ----------
app.get('/api/universities', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name, slug, email, notify_email, created_at, (password_hash IS NOT NULL) AS "hasPassword" FROM universities ORDER BY name')
    res.json({ universities: result.rows })
  } catch {
    res.json({ universities: [] })
  }
})

// ---------- Health check ----------
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' })
  }
})

// ---------- Users ----------
app.use('/api/auth', authLimiter, authRouter)

// ---------- Cart (per user) ----------
app.use('/api/cart', cartRouter)

// ---------- Stock reservations (how many items are in all users' carts) ----------
app.get('/api/stock/reserved', async (req, res) => {
  try {
    // Get the requesting user's university to filter carts
    const user = await userFromSession(req)
    const university = user?.university

    let cartQuery = 'SELECT items FROM carts'
    let cartParams = []

    // If user has a university, only count carts from users at that university
    if (university) {
      cartQuery = `SELECT c.items FROM carts c
                   JOIN users u ON u.id = c.user_id
                   WHERE u.university = $1`
      cartParams = [university]
    }

    const result = await pool.query(cartQuery, cartParams)
    const reserved = {}
    for (const row of result.rows) {
      const items = Array.isArray(row.items) ? row.items : []
      for (const item of items) {
        if (!item.id) continue
        const pid = String(item.id)
        reserved[pid] = (reserved[pid] || 0) + (item.qty ?? 1)
      }
    }
    res.json({ reserved })
  } catch {
    res.json({ reserved: {} })
  }
})

// ---------- Orders ----------
app.use('/api/orders', orderRouter)
app.get('/api/admin/customers', requireAnyAdmin, getCustomers)

app.put('/api/admin/customers/:id/university', requireAnyAdmin, async (req, res) => {
  if (req.adminRole !== 'superuser') {
    return res.status(403).json({ error: 'Only superusers can change customer university' })
  }
  const { id } = req.params
  const { university } = req.body ?? {}
  if (!university) {
    return res.status(400).json({ error: 'university is required' })
  }
  try {
    const check = await pool.query('SELECT id, university FROM users WHERE id = $1', [id])
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (check.rows[0].university === university) {
      return res.status(400).json({ error: 'User is already at that university' })
    }
    await pool.query('UPDATE users SET university = $1 WHERE id = $2', [university, id])
    await pool.query('UPDATE carts SET items = \'[]\' WHERE user_id = $1', [id])
    siteDataCache = null
    res.json({ ok: true })
  } catch (err) {
    console.error('Change customer university failed:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

app.use('/api/admin/orders', requireAnyAdmin, orderAdminRouter)

// ---------- Admin: data for specific university ----------
app.get('/api/admin/data', requireAnyAdmin, async (req, res) => {
  const university = req.query.university || null
  if (req.adminRole === 'subuser') {
    if (university && university !== req.adminUniversity) {
      return res.status(403).json({ error: 'Access denied' })
    }
  }
  const data = await readData(req.adminRole === 'subuser' ? req.adminUniversity : university)
  res.json(data)
})

// ---------- Payments ----------
app.use('/api/payments', paymentRouter)

// ---------- Admin: payment config per university ----------
app.get('/api/payments/config/:university/admin', requireAnyAdmin, getPaymentConfigAdmin)
app.put('/api/payments/config/:university', requireAnyAdmin, savePaymentConfigAdmin)

// ---------- SEO (sitemap, robots.txt) ----------
app.use(seoRouter)

// ---------- Auth (admin login) ----------
app.post('/api/login', authLimiter, (req, res) => {
  const { password } = req.body ?? {}
  if (password === config.adminPassword) {
    const token = crypto.randomBytes(24).toString('hex')
    sessions.add(token)
    res.cookie('adminToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'Wrong password' })
  }
})

app.post('/api/logout', (_req, res) => {
  res.clearCookie('adminToken')
  res.json({ ok: true })
})

app.get('/api/admin/me', async (req, res) => {
  if (sessions.has(req.cookies.adminToken)) return res.json({ ok: true, role: 'superuser' })
  if (req.cookies.uniAdminToken && uniSessions.has(req.cookies.uniAdminToken)) {
    const slug = req.cookies.uniAdminUniversity
    try {
      const result = await pool.query('SELECT name FROM universities WHERE slug = $1', [slug])
      const name = result.rows[0]?.name || slug
      return res.json({ ok: true, role: 'subuser', university: slug, universityName: name })
    } catch {
      return res.json({ ok: true, role: 'subuser', university: slug, universityName: slug })
    }
  }
  res.status(401).json({ error: 'Unauthorized' })
})

// ---------- University sub-user sessions ----------
const uniSessions = new Set()

// ---------- University sub-user login ----------
app.post('/api/uni-login', authLimiter, async (req, res) => {
  const { slug, password } = req.body ?? {}
  if (!slug || !password) return res.status(400).json({ error: 'University and password required' })

  const result = await pool.query('SELECT * FROM universities WHERE slug = $1', [slug])
  const uni = result.rows[0]
  if (!uni) return res.status(401).json({ error: 'University not found' })

  if (uni.password_hash) {
    if (!verifyPassword(password, uni.password_hash)) {
      return res.status(401).json({ error: 'Wrong password' })
    }
  }

  const token = crypto.randomBytes(24).toString('hex')
  uniSessions.add(token)
  res.cookie('uniAdminToken', token, {
    httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  res.cookie('uniAdminUniversity', slug, {
    httpOnly: false, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  res.json({ ok: true, university: slug })
})

app.post('/api/uni-logout', (req, res) => {
  const token = req.cookies.uniAdminToken
  if (token) uniSessions.delete(token)
  res.clearCookie('uniAdminToken')
  res.clearCookie('uniAdminUniversity')
  res.json({ ok: true })
})

// Middleware: accept both admin (superuser) and sub-user tokens
function requireAnyAdmin(req, res, next) {
  if (sessions.has(req.cookies.adminToken)) {
    req.adminRole = 'superuser'
    return next()
  }
  if (req.cookies.uniAdminToken && uniSessions.has(req.cookies.uniAdminToken)) {
    req.adminRole = 'subuser'
    req.adminUniversity = req.cookies.uniAdminUniversity
    return next()
  }
  res.status(401).json({ error: 'Unauthorized' })
}

// ---------- Super user password verify ----------
app.post('/api/admin/verify-superuser', requireAnyAdmin, (req, res) => {
  const { password } = req.body ?? {}
  if (password === config.superUserPassword) {
    res.json({ ok: true })
  } else {
    res.status(403).json({ error: 'Wrong super user password' })
  }
})

// ---------- Admin: data (accepts sub-user with university filter) ----------
app.put('/api/admin/data', requireAnyAdmin, async (req, res) => {
  const { section, value, university } = req.body ?? {}
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Unknown section' })
  if (req.adminRole === 'subuser') {
    if (university !== req.adminUniversity) return res.status(403).json({ error: 'Access denied' })
  }
  await writeSection(section, value, university)
  res.json({ ok: true })
})

// ---------- Admin: products ----------
app.post('/api/admin/products', requireAnyAdmin, async (req, res) => {
  try {
    const product = req.body ?? {}
    if (req.adminRole === 'subuser') {
      product.university = req.adminUniversity
    }
    const result = await writeProduct(product)
    res.json({ ok: true, product: result })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save product' })
  }
})

app.put('/api/admin/products', requireAnyAdmin, async (req, res) => {
  try {
    const product = req.body ?? {}
    if (!product.id) return res.status(400).json({ error: 'Product id is required' })
    if (req.adminRole === 'subuser') {
      product.university = req.adminUniversity
    }
    const result = await writeProduct(product)
    res.json({ ok: true, product: result })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save product' })
  }
})

app.delete('/api/admin/products/:id', requireAnyAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE products SET active = false WHERE id = $1', [req.params.id])
    siteDataCache = null
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete product' })
  }
})

// ---------- Admin: universities (superuser only for create/delete/password) ----------
app.post('/api/admin/universities', requireAuth, async (req, res) => {
  try {
    const { name, password, email, notify_email } = req.body ?? {}
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'University name is required' })
    }
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const existing = await pool.query('SELECT 1 FROM universities WHERE slug = $1', [slug])
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'A university with that name already exists' })
    }

    const pwHash = password ? hashPassword(password) : null
    const uniEmail = email ? email.trim() : null
    const uniNotifyEmail = notify_email ? notify_email.trim() : null
    const result = await pool.query(
      'INSERT INTO universities (name, slug, password_hash, email, notify_email) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, slug, email, notify_email, created_at',
      [name.trim(), slug, pwHash, uniEmail, uniNotifyEmail]
    )
    const uni = result.rows[0]

    // Create default site data for this university
    const fallback = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    const defaultSections = ['categories', 'deals', 'trendingProducts', 'benefits', 'siteContent', 'categoryMenus']
    for (const section of defaultSections) {
      if (fallback[section]) {
        await pool.query(
          `INSERT INTO site_data (section, university, value, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (section, university) DO NOTHING`,
          [section, slug, JSON.stringify(fallback[section])]
        )
      }
    }

    siteDataCache = null
    res.json({ ok: true, university: uni })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create university' })
  }
})

app.delete('/api/admin/universities/:slug', requireAuth, async (req, res) => {
  try {
    const { slug } = req.params
    if (slug === 'default') {
      return res.status(400).json({ error: 'Cannot delete the default university' })
    }

    // Check if users are assigned to this university
    const usersCheck = await pool.query('SELECT COUNT(*) FROM users WHERE university = $1', [slug])
    if (parseInt(usersCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete university with assigned users. Reassign or remove them first.' })
    }

    await pool.query('DELETE FROM universities WHERE slug = $1', [slug])
    await pool.query('DELETE FROM site_data WHERE university = $1', [slug])
    await pool.query('DELETE FROM products WHERE university = $1', [slug])
    await pool.query('DELETE FROM orders WHERE university = $1', [slug])
    siteDataCache = null
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete university' })
  }
})

// ---------- Admin: university change password (requires superuser verification) ----------
app.put('/api/admin/universities/:slug/password', requireAnyAdmin, async (req, res) => {
  const { password } = req.body ?? {}
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' })
  }
  const { slug } = req.params
  const result = await pool.query(
    'UPDATE universities SET password_hash = $1 WHERE slug = $2 RETURNING id',
    [hashPassword(password), slug]
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'University not found' })
  res.json({ ok: true })
})

// ---------- Admin: university update email (requires superuser verification) ----------
app.put('/api/admin/universities/:slug/email', requireAnyAdmin, async (req, res) => {
  const { email } = req.body ?? {}
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' })
  }
  const { slug } = req.params
  const result = await pool.query(
    'UPDATE universities SET email = $1 WHERE slug = $2 RETURNING id',
    [email.trim(), slug]
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'University not found' })
  res.json({ ok: true })
})

// ---------- Admin: university update notify email (requires superuser verification) ----------
app.put('/api/admin/universities/:slug/notify-email', requireAnyAdmin, async (req, res) => {
  const { notify_email } = req.body ?? {}
  if (!notify_email || !notify_email.trim()) {
    return res.status(400).json({ error: 'Email is required' })
  }
  const { slug } = req.params
  const result = await pool.query(
    'UPDATE universities SET notify_email = $1 WHERE slug = $2 RETURNING id',
    [notify_email.trim(), slug]
  )
  if (result.rowCount === 0) return res.status(404).json({ error: 'University not found' })
  res.json({ ok: true })
})

// ---------- Admin: ngrok tunnel ----------
app.get('/api/admin/ngrok', requireAuth, async (_req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels')
    const tunnels = (await response.json())?.tunnels ?? []
    const url = tunnels.find((t) => t.public_url.startsWith('https://'))?.public_url ?? null
    res.json({ url })
  } catch {
    res.json({ url: null })
  }
})

// ---------- Admin: image upload ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images are allowed'))
  },
})

app.post('/api/admin/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// Uploaded images are served in dev (by Vite via public/) and in prod (here)
app.use('/uploads', express.static(uploadsDir))

// ---------- Production: serve built site ----------
const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1y', immutable: true, index: false }))
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// ---------- Error handler ----------
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Lacosta API + admin running on http://localhost:${config.port}`)
  console.log(`Admin page: http://localhost:${config.port}${config.adminPath}`)
})

initDb().catch((err) => {
  console.error('Database init failed — check DATABASE_URL in .env:', err.message)
})