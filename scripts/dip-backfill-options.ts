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
  console.log(`  at least one                 ${r.with_either}  (${r.coverage_pct}%)`)
  if (!dryRun) console.log(`rows written                   ${r.rows_written}`)
  console.log(`\nfinished in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  if (r.coverage_pct < COVERAGE_TARGET) {
    // Below target the parse is wrong, not the data — every sampled product on
    // all three brands carried both a Purity and a Color option.
    console.error(
      `\n✗ coverage ${r.coverage_pct}% is below the ${COVERAGE_TARGET}% target. ` +
      `Inspect the option names actually present before accepting this.`,
    )
    process.exit(1)
  }
  console.log(`✓ coverage ${r.coverage_pct}% meets the ${COVERAGE_TARGET}% target.`)
}

main().catch(err => { console.error(err); process.exit(1) })
