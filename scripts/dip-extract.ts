/**
 * Gemini vision attribute extraction.
 *
 *   npm run dip:extract -- --goldset            the 40 verification designs
 *   npm run dip:extract -- --limit=200          pilot volume
 *   npm run dip:extract -- --limit=200 --dry-run  count targets, call nothing
 *
 * Resumable: designs already extracted at this model version are skipped, so
 * re-running after a crash continues rather than starting over.
 */

import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'

loadEnv()
requireSupabaseEnv()

function num(name: string, fallback: number): number {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  const n = hit ? Number(hit.split('=')[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}
function str(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : undefined
}

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY is not set. Locally it comes from .env.local.')
  }

  const goldSetOnly = process.argv.includes('--goldset')
  const dryRun = process.argv.includes('--dry-run')
  const limit = num('limit', goldSetOnly ? 100 : 200)

  const { runExtraction } = await import('../lib/dip/extract/run')

  console.log(
    `${dryRun ? 'DRY RUN — ' : ''}extracting${goldSetOnly ? ' the gold set' : ''}, ` +
    `limit ${limit}, model ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}\n`,
  )

  const started = Date.now()
  const s = await runExtraction({ limit, brandFilter: str('brand'), goldSetOnly, dryRun })

  if (s.attempted === 0) {
    console.log('Nothing to extract — everything at this model version is already done.')
    return
  }
  if (dryRun) {
    console.log(`${s.attempted} design(s) would be extracted. No model calls made.`)
    return
  }

  console.log(`attempted   ${s.attempted}`)
  console.log(`extracted   ${s.extracted}`)
  console.log(`failed      ${s.failed}`)

  console.log('\nper-field confidence (mean, and how often it answered "unsure"):')
  for (const [field, v] of Object.entries(s.field_confidence)) {
    console.log(`  ${field.padEnd(14)} ${v.mean.toFixed(2)}   unsure ${v.unsure}%`)
  }

  console.log('\ncolour check (photo vs the colours the merchant offers):')
  for (const [status, n] of Object.entries(s.colour_check)) {
    console.log(`  ${status.padEnd(10)} ${n}`)
  }
  const mismatch = s.colour_check.mismatch ?? 0
  const checked = (s.colour_check.pass ?? 0) + mismatch
  if (checked > 0) {
    const pct = Math.round((mismatch / checked) * 1000) / 10
    console.log(`  → ${pct}% mismatch` + (pct > 10
      ? '  ⚠ above 10% — inspect the causes before drawing conclusions (two-tone pieces, studio lighting, one colourway photographed of three)'
      : ''))
  }

  console.log(`\ntokens      ${s.input_tokens.toLocaleString()} in, ${s.output_tokens.toLocaleString()} out`)
  console.log(`est. cost   $${s.est_cost_usd.toFixed(4)}  ($${(s.est_cost_usd / Math.max(s.extracted, 1)).toFixed(5)}/design)`)
  console.log(`            → $${((s.est_cost_usd / Math.max(s.extracted, 1)) * 8042).toFixed(2)} for all 8,042 designs`)
  console.log(`\nfinished in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

main().catch(err => { console.error(err); process.exit(1) })
