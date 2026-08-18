import fs from 'node:fs'
import path from 'node:path'
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