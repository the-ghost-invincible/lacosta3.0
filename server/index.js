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
import { authRouter } from './auth.js'
import { cartRouter } from './cart.js'
import { orderRouter, orderAdminRouter, getCustomers } from './orders.js'
import { paymentRouter } from './payment-routes.js'
import { errorHandler } from './error-tracker.js'
import { seoRouter } from './seo.js'

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

async function readData() {
  try {
    // Try to read from database first
    const now = Date.now()
    if (siteDataCache && now - siteDataCacheTime < SITE_CACHE_TTL) {
      return siteDataCache
    }

    // Read site data sections from database
    const result = await pool.query('SELECT section, value FROM site_data')
    const dbData = {}
    for (const row of result.rows) {
      dbData[row.section] = row.value
    }

    // Read products from database
    const productsResult = await pool.query(
      'SELECT * FROM products WHERE active = true ORDER BY id'
    )
    dbData.catalogProducts = productsResult.rows.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      subcategory: p.subcategory,
      price: p.price,
      oldPrice: p.old_price,
      seller: p.seller,
      rating: Number(p.rating),
      image: p.image,
      description: p.description,
      specs: p.specs,
      badge: p.badge,
      outOfStock: p.out_of_stock,
    }))

    // Merge with fallback data from JSON file
    const fallback = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    siteDataCache = { ...fallback, ...dbData }
    siteDataCacheTime = now
    return siteDataCache
  } catch (err) {
    // Fallback to JSON file if database is unavailable
    console.error('Database read failed, using JSON fallback:', err.message)
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  }
}

async function writeSection(section, value) {
  try {
    await pool.query(
      `INSERT INTO site_data (section, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (section) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [section, JSON.stringify(value)]
    )
    siteDataCache = null // invalidate cache
  } catch (err) {
    // Fallback to JSON file
    console.error('Database write failed, using JSON fallback:', err.message)
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    data[section] = value
    const tmp = dataFile + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, dataFile)
  }
}

async function writeProduct(product) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (product.id) {
      await client.query(
        `UPDATE products SET name = $1, category = $2, brand = $3, subcategory = $4,
         price = $5, old_price = $6, seller = $7, rating = $8, image = $9,
         description = $10, specs = $11, badge = $12, out_of_stock = $13, updated_at = now()
         WHERE id = $14`,
        [product.name, product.category, product.brand ?? null, product.subcategory ?? null,
         product.price, product.oldPrice ?? null, product.seller ?? null, product.rating ?? 4.5,
         product.image ?? null, product.description ?? null, JSON.stringify(product.specs ?? []),
         product.badge ?? null, product.outOfStock ?? false, product.id]
      )
    } else {
      const result = await client.query(
        `INSERT INTO products (name, category, brand, subcategory, price, old_price, seller, rating, image, description, specs, badge, out_of_stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [product.name, product.category, product.brand ?? null, product.subcategory ?? null,
         product.price, product.oldPrice ?? null, product.seller ?? null, product.rating ?? 4.5,
         product.image ?? null, product.description ?? null, JSON.stringify(product.specs ?? []),
         product.badge ?? null, product.outOfStock ?? false]
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
app.get('/api/data', async (_req, res) => {
  const data = await readData()
  res.json(data)
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

// ---------- Orders ----------
app.use('/api/orders', orderRouter)
app.get('/api/admin/customers', requireAuth, getCustomers)
app.use('/api/admin/orders', requireAuth, orderAdminRouter)

// ---------- Payments ----------
app.use('/api/payments', paymentRouter)

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

app.get('/api/admin/me', (req, res) => {
  if (sessions.has(req.cookies.adminToken)) return res.json({ ok: true })
  res.status(401).json({ error: 'Unauthorized' })
})

// ---------- Admin: data ----------
app.put('/api/admin/data', requireAuth, async (req, res) => {
  const { section, value } = req.body ?? {}
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Unknown section' })
  await writeSection(section, value)
  res.json({ ok: true })
})

// ---------- Admin: products ----------
app.post('/api/admin/products', requireAuth, async (req, res) => {
  try {
    const product = req.body ?? {}
    const result = await writeProduct(product)
    res.json({ ok: true, product: result })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save product' })
  }
})

app.put('/api/admin/products', requireAuth, async (req, res) => {
  try {
    const product = req.body ?? {}
    if (!product.id) return res.status(400).json({ error: 'Product id is required' })
    const result = await writeProduct(product)
    res.json({ ok: true, product: result })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save product' })
  }
})

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE products SET active = false WHERE id = $1', [req.params.id])
    siteDataCache = null
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete product' })
  }
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