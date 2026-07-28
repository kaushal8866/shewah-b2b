/**
 * Backfill karat and colour for every design, from stored payloads.
 *
 *   npm run dip:backfill-options -- --dry-run   parse and report, write nothing
 *   npm run dip:backfill-options                write
 *
 * Reads no network. Safe to re-run: upserts on (design_id, model_version_id).
 */

import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'

// Before importing anything that builds a Supabase client at module scope.
loadEnv()
requireSupabaseEnv()

const COVERAGE_TARGET = 95

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { backfillOptions } = await import('../lib/dip/attributes/backfillOptions')

  console.log(dryRun ? 'DRY RUN — parsing only, writing nothing.\n' : 'Backfilling karat and colour.\n')

  const started = Date.now()
  const r = await backfillOptions(dryRun)

  console.log(`designs with a stored payload  ${r.designs_seen}`)
  console.log(`  karat parsed                 ${r.with_karat}`)
  console.log(`  colour parsed                ${r.with_colour}`)
  if (!dryRun) console.log(`rows written                   ${r.rows_written}`)

  console.log('\nby brand:')
  for (const b of r.by_brand) {
    const note = b.product_focus === 'silver' ? '  (silver — no karat expected)' : ''
    console.log(
      `  ${b.brand_name.padEnd(20)} ${String(b.designs).padStart(5)} designs   ` +
      `karat ${String(b.with_karat).padStart(5)}  colour ${String(b.with_colour).padStart(5)}   ` +
      `${String(b.karat_pct).padStart(5)}%${note}`,
    )
  }

  console.log(`\nfinished in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  // Measured against GOLD designs only. A silver catalogue has no karat, so
  // parsing nothing from it is the correct result — including it in the
  // denominator measures the catalogue mix, not the parser.
  if (r.gold_coverage_pct < COVERAGE_TARGET) {
    console.error(
      `\n✗ gold-brand coverage ${r.gold_coverage_pct}% (of ${r.gold_designs}) is below ` +
      `the ${COVERAGE_TARGET}% target. Inspect the option names actually present.`,
    )
    process.exit(1)
  }
  console.log(
    `✓ gold-brand coverage ${r.gold_coverage_pct}% of ${r.gold_designs} designs ` +
    `meets the ${COVERAGE_TARGET}% target.`,
  )
}

main().catch(err => { console.error(err); process.exit(1) })
