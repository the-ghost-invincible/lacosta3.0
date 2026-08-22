import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import * as siteData from '../src/data.js'

const out = path.resolve(import.meta.dirname, '..', 'server', 'data.json')
const payload = {
  categories: siteData.categories,
  featuredProducts: siteData.featuredProducts,
  catalogProducts: siteData.catalogProducts,
  deals: siteData.deals,
  trendingProducts: siteData.trendingProducts,
  benefits: siteData.benefits,
  siteContent: siteData.siteContent,
  categoryMenus: siteData.categoryMenus,
}

fs.writeFileSync(out, JSON.stringify(payload, null, 2))
console.log(`Seeded ${out}`)

// Also seed database if DATABASE_URL is set
const DATABASE_URL = process.env.DATABASE_URL
if (DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  try {
    // Seed catalog products
    for (const p of siteData.catalogProducts) {
      await pool.query(
        `INSERT INTO products (id, name, category, brand, subcategory, price, old_price, seller, rating, image, description, specs, badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, category = EXCLUDED.category, brand = EXCLUDED.brand,
           subcategory = EXCLUDED.subcategory, price = EXCLUDED.price, old_price = EXCLUDED.old_price,
           seller = EXCLUDED.seller, rating = EXCLUDED.rating, image = EXCLUDED.image,
           description = EXCLUDED.description, specs = EXCLUDED.specs, updated_at = now()`,
        [p.id, p.name, p.category, p.brand ?? null, p.subcategory ?? null,
         p.price, p.oldPrice ?? null, p.seller ?? null, p.rating ?? 4.5,
         p.image ?? null, p.description ?? null, JSON.stringify(p.specs ?? []), p.badge ?? null]
      )
    }

    // Seed site data sections
    const sections = ['categories', 'featuredProducts', 'deals', 'trendingProducts', 'benefits', 'siteContent', 'categoryMenus']
    for (const section of sections) {
      const value = payload[section]
      if (value !== undefined) {
        await pool.query(
          `INSERT INTO site_data (section, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (section) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [section, JSON.stringify(value)]
        )
      }
    }

    console.log(`Seeded database with ${siteData.catalogProducts.length} products and ${sections.length} site sections`)
  } catch (err) {
    console.error('Database seed failed:', err.message)
  } finally {
    await pool.end()
  }
}
