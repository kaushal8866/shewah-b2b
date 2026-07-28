/**
 * DIP weekly ingest.
 *
 *   npm run dip:ingest                     all active brands
 *   npm run dip:ingest -- --brand=starkle  one brand (substring match)
 *   npm run dip:ingest -- --dry-run        fetch and report, write nothing
 *
 * Runs from GitHub Actions on a weekly schedule, and by hand for backfill or
 * debugging. Exits non-zero if any brand failed, so a red run means a real hole
 * in the time series rather than something to skim past.
 */

import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'
import type { DipBrand } from '../lib/dip/types'

// Must run before anything that touches supabaseAdmin — that module builds its
// client at import time, so a static import would capture an empty env.
loadEnv()
requireSupabaseEnv()

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : undefined
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`)

async function dryRun(brandFilter?: string) {
  const { supabaseAdmin } = await import('../lib/supabaseAdmin')
  const { getAdapter } = await import('../lib/dip/adapters')

  let query = supabaseAdmin.from('dip_brands').select('*').eq('is_active', true)
  if (brandFilter) query = query.ilike('name', `%${brandFilter}%`)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const brands = (data ?? []) as DipBrand[]
  if (brands.length === 0) {
    console.log('No active brands matched. Has the migration been run?')
    return
  }

  console.log(`DRY RUN — reading ${brands.length} brand(s), writing nothing.\n`)
  for (const brand of brands) {
    const adapter = getAdapter(brand.platform)
    if (!adapter) {
      console.log(`${brand.name}: no adapter for '${brand.platform}' — skipped`)
      continue
    }
    try {
      const out = await adapter.fetch(brand)
      console.log(`${brand.name}: ${out.designs.length} designs, HTTP ${out.http_status}`)
      if (out.truncated_reason) console.log(`  ⚠ ${out.truncated_reason}`)
    } catch (err: any) {
      console.log(`${brand.name}: FAILED — ${err?.message || err}`)
    }
  }
}

async function main() {
  const brandFilter = arg('brand')

  if (hasFlag('dry-run')) {
    await dryRun(brandFilter)
    return
  }

  const { ingestAll } = await import('../lib/dip/ingest')

  const started = Date.now()
  const results = await ingestAll(brandFilter)

  if (results.length === 0) {
    console.log('No active brands matched. Has the migration been run?')
    return
  }

  console.log(`DIP ingest — ${results.length} brand(s)\n`)
  for (const r of results) {
    const mark = r.status === 'success' ? '✓' : r.status === 'partial' ? '~' : '✗'
    console.log(`${mark} ${r.brand_name}`)
    console.log(`    seen ${r.designs_seen}  new ${r.designs_new}  snapshots ${r.snapshots_written}  [${r.status}]`)
    if (r.error) console.log(`    error: ${r.error}`)
  }

  const failed = results.filter(r => r.status === 'failed')
  const partial = results.filter(r => r.status === 'partial')
  console.log(`\nfinished in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  if (partial.length > 0) {
    // Partial is not success. An unread page looks exactly like a competitor
    // delisting 250 designs, so it must stay visible.
    console.log(`⚠ ${partial.length} brand(s) read only in part — designs were NOT retired for those.`)
  }
  if (failed.length > 0) {
    console.error(`✗ ${failed.length} brand(s) failed. This week has a hole for them.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
