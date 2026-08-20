import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { initDb } from './db.js'
import { authRouter } from './auth.js'
import { cartRouter } from './cart.js'

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

function readData() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
}

function writeData(data) {
  const tmp = dataFile + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, dataFile)
}

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

function requireAuth(req, res, next) {
  if (sessions.has(req.cookies.adminToken)) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// ---------- Public ----------
app.get('/api/data', (_req, res) => {
  res.json(readData())
})

// ---------- Users ----------
app.use('/api/auth', authRouter)

// ---------- Cart (per user) ----------
app.use('/api/cart', cartRouter)

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
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
app.put('/api/admin/data', requireAuth, (req, res) => {
  const { section, value } = req.body ?? {}
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Unknown section' })
  const data = readData()
  data[section] = value
  writeData(data)
  res.json({ ok: true })
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

app.listen(config.port, () => {
  console.log(`Lacosta API + admin running on http://localhost:${config.port}`)
  console.log(`Admin page: http://localhost:${config.port}${config.adminPath}`)
})

initDb().catch((err) => {
  console.error('Database init failed — check DATABASE_URL in .env:', err.message)
})