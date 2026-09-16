/**
 * OPTIONAL DEVELOPMENT UTILITY: Demo D2C Catalog Seeder
 * File: scripts/seed_demo_d2c_catalog.ts
 *
 * NOTE: This script is intended strictly for local development, testing,
 * and staging previews. It is NEVER executed automatically as part of production
 * migrations.
 *
 * Run manually via: npx ts-node scripts/seed_demo_d2c_catalog.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

try {
  if (fs.existsSync('.env.local')) {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    envFile.split('\n').forEach(line => {
      const idx = line.indexOf('=')
      if (idx > 0) {
        const key = line.slice(0, idx).trim()
        let val = line.slice(idx + 1).trim()
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        process.env[key] = val
      }
    })
  }
} catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(supabaseUrl, supabaseServiceKey)

const DEMO_PIECES = [
  {
    code: 'SH-SOL-01',
    name: 'The Antwerp Solitaire Ring',
    slug: 'the-antwerp-solitaire-ring',
    category: 'rings',
    d2c_title: 'The Antwerp Solitaire Diamond Ring',
    d2c_subtitle: 'Round Brilliant Solitaire in Four-Prong Solid 18K Gold',
    d2c_description: 'An iconic classic, handcrafted with a tapered band to elevate a scintillating round brilliant diamond. Hand-set in solid 18K gold or 950 platinum.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 12,
    return_policy_type: 'made_to_order',
    return_window_days: 30,
    return_eligible: true,
    diamond_shape: 'round',
    diamond_type: 'lgd',
    diamond_weight: 1.0,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1200&q=85',
    ],
    prices: {
      US: { currency: 'USD', price: 2190, compare_at: 2450 },
      GB: { currency: 'GBP', price: 1750, compare_at: 1950 },
      AU: { currency: 'AUD', price: 3390, compare_at: 3790 },
      DE: { currency: 'EUR', price: 2050, compare_at: 2290 },
      FR: { currency: 'EUR', price: 2050, compare_at: 2290 },
    },
  },
  {
    code: 'SH-TNS-01',
    name: 'The Heritage Tennis Bracelet',
    slug: 'the-heritage-tennis-bracelet',
    category: 'bracelets',
    d2c_title: 'The Heritage Diamond Tennis Bracelet',
    d2c_subtitle: '3.00 Total Carat Weight in Solid 18K Gold Setting',
    d2c_description: 'A continuous ribbon of brilliant cut diamonds articulated with seamless fluidity. Features a dual-lock safety clasp for lifetime durability.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 14,
    return_policy_type: 'made_to_order',
    return_window_days: 30,
    return_eligible: true,
    diamond_shape: 'round',
    diamond_type: 'lgd',
    diamond_weight: 3.0,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1611591475870-760a927a4e69?auto=format&fit=crop&w=1200&q=85',
    ],
    prices: {
      US: { currency: 'USD', price: 3490, compare_at: 3900 },
      GB: { currency: 'GBP', price: 2790, compare_at: 3100 },
      AU: { currency: 'AUD', price: 5390, compare_at: 6000 },
      DE: { currency: 'EUR', price: 3250, compare_at: 3600 },
      FR: { currency: 'EUR', price: 3250, compare_at: 3600 },
    },
  },
]

async function seed() {
  console.log('Seeding optional demo D2C items...')

  for (const item of DEMO_PIECES) {
    const { prices, ...prodData } = item
    const { data: existing } = await sb.from('products').select('id').eq('code', item.code).maybeSingle()

    let productId = existing?.id
    if (productId) {
      console.log(`Updating existing product ${item.code}...`)
      await sb.from('products').update(prodData).eq('id', productId)
    } else {
      console.log(`Inserting new demo product ${item.code}...`)
      const { data: inserted, error: insErr } = await sb.from('products').insert({
        ...prodData,
        is_active: true,
      }).select('id').single()
      if (insErr) {
        console.error('Error inserting product:', insErr)
        continue
      }
      productId = inserted.id
    }

    // Insert market prices
    for (const [marketCode, p] of Object.entries(prices)) {
      try {
        await sb.from('d2c_market_prices').upsert({
          product_id: productId,
          market_code: marketCode,
          currency: p.currency,
          price: p.price,
          compare_at_price: p.compare_at,
          pricing_mode: 'fixed',
          is_active: true,
        }, { onConflict: 'product_id,market_code' })
      } catch {}
    }
  }

  console.log('Demo D2C catalog seed completed successfully.')
}

seed().catch(console.error)
