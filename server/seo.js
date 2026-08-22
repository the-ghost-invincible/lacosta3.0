import { Router } from 'express'
import { pool } from './db.js'
import { config } from './config.js'

const router = Router()

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function categorySlug(name) {
  return name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')
}

router.get('/sitemap.xml', async (_req, res) => {
  const baseUrl = config.baseUrl
  const now = new Date().toISOString()

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(baseUrl)}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`

  try {
    // Add category pages
    const catResult = await pool.query(
      "SELECT value FROM site_data WHERE section = 'categories'"
    )
    if (catResult.rows[0]) {
      const categories = catResult.rows[0].value
      for (const cat of categories) {
        if (cat.name === 'All') continue
        const slug = categorySlug(cat.name)
        xml += `
  <url>
    <loc>${escapeXml(baseUrl)}/category/${escapeXml(slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      }
    }

    // Add product pages
    const prodResult = await pool.query(
      'SELECT id, name, category, updated_at FROM products WHERE active = true ORDER BY id'
    )
    for (const p of prodResult.rows) {
      const slug = categorySlug(p.category)
      const updated = p.updated_at?.toISOString?.() ?? now
      xml += `
  <url>
    <loc>${escapeXml(baseUrl)}/category/${escapeXml(slug)}?p=${p.id}</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
    }
  } catch {
    // If database is unavailable, just serve the static pages
  }

  xml += '\n</urlset>'

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(xml)
})

// robots.txt
router.get('/robots.txt', (_req, res) => {
  const baseUrl = config.baseUrl
  res.setHeader('Content-Type', 'text/plain')
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin*

Sitemap: ${baseUrl}/sitemap.xml
`)
})

export const seoRouter = router
