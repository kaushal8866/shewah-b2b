/**
 * DIP slice 1, step 1 — measure before building.
 *
 * Reads the verified Shopify catalogues and writes NOTHING. The point is to
 * size two decisions with real numbers rather than guesses:
 *
 *   1. How much database will `dip_snapshots` consume per week, given that
 *      every row keeps the raw payload.
 *   2. Whether archiving one image per design fits Supabase's 1GB free tier,
 *      which determines whether the visual moat can actually be held.
 *
 * Run: npx vite-node scripts/dip-measure.ts
 */

import { shopifyAdapter } from '../lib/dip/adapters/shopify'
import { DIP_USER_AGENT } from '../lib/dip/http'
import type { DipBrand } from '../lib/dip/types'

const BRANDS: DipBrand[] = [
  {
    id: 'measure-limelight', name: 'Limelight Diamonds', market: 'IN', platform: 'shopify',
    base_url: 'https://limelightdiamonds.com', is_active: true, product_focus: 'lgd_gold', notes: null,
  },
  {
    id: 'measure-starkle', name: 'Starkle', market: 'IN', platform: 'shopify',
    base_url: 'https://starkle.in', is_active: true, product_focus: 'lgd_gold', notes: null,
  },
  {
    id: 'measure-giva', name: 'GIVA', market: 'IN', platform: 'shopify',
    base_url: 'https://giva.co', is_active: true, product_focus: 'silver', notes: null,
  },
]

const IMAGE_SAMPLE = 8

/** HEAD a few images to get a real average size instead of assuming 200KB. */
async function sampleImageBytes(urls: string[]): Promise<number | null> {
  const picks: number[] = []
  const step = Math.max(1, Math.floor(urls.length / IMAGE_SAMPLE))
  for (let i = 0; i < urls.length && picks.length < IMAGE_SAMPLE; i += step) {
    try {
      const res = await fetch(urls[i], { method: 'HEAD', headers: { 'User-Agent': DIP_USER_AGENT } })
      const len = Number(res.headers.get('content-length'))
      if (Number.isFinite(len) && len > 0) picks.push(len)
    } catch { /* a sample failing is not interesting; the average is */ }
    await new Promise(r => setTimeout(r, 300))
  }
  if (picks.length === 0) return null
  return picks.reduce((a, b) => a + b, 0) / picks.length
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function main() {
  console.log('DIP measurement — reading catalogues, writing nothing.\n')

  let totalDesigns = 0
  let totalPrimaryImageBytes = 0
  let totalSnapshotBytes = 0

  for (const brand of BRANDS) {
    process.stdout.write(`${brand.name} … `)
    const started = Date.now()

    let out
    try {
      out = await shopifyAdapter.fetch(brand)
    } catch (err: any) {
      console.log(`FAILED — ${err?.message || err}\n`)
      continue
    }

    const d = out.designs
    const elapsed = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`${d.length} designs in ${elapsed}s`)

    const priced = d.filter(x => x.price_local !== null)
    // Not `!== null` — that counted Shopify's default 0 as a published weight
    // and reported "645/645" for a brand that publishes none at all.
    const withGrams = d.filter(x => x.grams !== null && x.grams > 0)
    const discounted = d.filter(x => x.compare_at_price !== null)
    const available = d.filter(x => x.available)
    const allImages = d.flatMap(x => x.image_urls)
    const primaryImages = d.map(x => x.image_urls[0]).filter(Boolean) as string[]

    // Snapshot weight is dominated by `raw`, so measure the serialised payload
    // rather than estimating from column count.
    const snapshotBytes = d.reduce((sum, x) => sum + JSON.stringify(x.raw).length, 0)

    const prices = priced.map(x => x.price_local!).sort((a, b) => a - b)
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0

    console.log(`  priced          ${priced.length}/${d.length}  median ₹${median.toLocaleString('en-IN')}`)
    console.log(`  available       ${available.length}/${d.length}`)
    console.log(`  discounted      ${discounted.length}/${d.length}  (compare_at set)`)
    console.log(`  grams published ${withGrams.length}/${d.length}`)
    console.log(`  images          ${allImages.length} total, ${(allImages.length / (d.length || 1)).toFixed(1)}/design`)
    console.log(`  raw payload     ${mb(snapshotBytes)} per weekly snapshot`)
    if (out.truncated_reason) console.log(`  ⚠ TRUNCATED: ${out.truncated_reason}`)

    const avgImage = await sampleImageBytes(primaryImages)
    if (avgImage) {
      const archive = avgImage * primaryImages.length
      console.log(`  primary images  ${primaryImages.length} × ~${(avgImage / 1024).toFixed(0)} KB = ${mb(archive)} one-off`)
      totalPrimaryImageBytes += archive
    } else {
      console.log('  primary images  size unknown (no content-length)')
    }

    totalDesigns += d.length
    totalSnapshotBytes += snapshotBytes
    console.log()
  }

  console.log('─'.repeat(64))
  console.log(`designs across all brands      ${totalDesigns}`)
  console.log(`snapshot payload per week      ${mb(totalSnapshotBytes)}`)
  console.log(`  → per year (52 weeks)        ${mb(totalSnapshotBytes * 52)}`)
  console.log(`primary-image archive (once)   ${mb(totalPrimaryImageBytes)}`)
  console.log()
  console.log('Supabase free tier: 500 MB database, 1 GB storage.')
  console.log('If the yearly figure exceeds 500 MB, either compress `raw`, prune it')
  console.log('after extraction, or move to Pro before the corpus outgrows the plan.')
}

main().catch(err => { console.error(err); process.exit(1) })
