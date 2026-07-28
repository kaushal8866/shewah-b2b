/**
 * DIP signal health.
 *
 * The spec's own rule: if this surface is red, ignore the others. A corpus
 * whose cadence has quietly broken is worse than no corpus, because the gaps
 * read as competitor behaviour rather than as missing data.
 *
 * This is also the only thing that will catch GitHub disabling the scheduled
 * workflow, which it does automatically after 60 days of repository
 * inactivity — a silent, total failure of the pipeline.
 *
 *   npm run dip:health
 */

import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'

// Before importing anything that builds a Supabase client at module scope.
loadEnv()
requireSupabaseEnv()

const DAY = 24 * 60 * 60 * 1000

async function main() {
  const { supabaseAdmin } = await import('../lib/supabaseAdmin')

  const { data: brands, error: brandErr } = await supabaseAdmin
    .from('dip_brands')
    .select('id, name, market, platform, is_active')
    .order('is_active', { ascending: false })
    .order('name')
  if (brandErr) throw new Error(brandErr.message)

  const active = (brands ?? []).filter((b: any) => b.is_active)
  const inactive = (brands ?? []).filter((b: any) => !b.is_active)

  console.log(`DIP corpus health — ${new Date().toISOString().slice(0, 10)}\n`)
  console.log(`${active.length} active brand(s), ${inactive.length} awaiting an adapter\n`)

  let worstAgeDays = 0
  let anyRed = false

  for (const b of active as any[]) {
    const { data: runs, error } = await supabaseAdmin
      .from('dip_ingest_runs')
      .select('started_at, status, designs_seen, designs_new, snapshots_written, truncated_reason, error')
      .eq('brand_id', b.id)
      .order('started_at', { ascending: false })
      .limit(8)
    if (error) throw new Error(error.message)

    const history = runs ?? []

    // FRESHNESS and COMPLETENESS are different health questions and were
    // previously conflated: a brand whose reads are always partial was
    // reported as "NEVER succeeded", which reads as "we have no data" when in
    // fact thousands of designs were captured. A partial run writes snapshots;
    // what it does not do is authorise retiring designs.
    const lastWithData = history.find((r: any) => r.status === 'success' || r.status === 'partial')
    const lastComplete = history.find((r: any) => r.status === 'success')

    if (!lastWithData) {
      anyRed = true
      const runCount = history.length
      console.log(`✗ ${b.name} — no data ever captured (${runCount} run(s) recorded)`)
      if (history[0]?.error) console.log(`    last error: ${history[0].error}`)
      continue
    }

    const ageDays = (Date.now() - new Date(lastWithData.started_at).getTime()) / DAY
    worstAgeDays = Math.max(worstAgeDays, ageDays)

    // Weekly cadence: 8 days is a missed run, 15 is two.
    const stale = ageDays > 8
    const mark = ageDays > 15 ? '✗' : stale ? '⚠' : lastComplete ? '✓' : '~'
    if (stale) anyRed = true

    console.log(`${mark} ${b.name} — last data ${ageDays.toFixed(1)}d ago, ` +
      `${lastWithData.designs_seen} designs (${lastWithData.designs_new} new)`)

    // Completeness, reported separately from freshness.
    const partials = history.filter((r: any) => r.status === 'partial')
    if (!lastComplete) {
      console.log(`    ⚠ never read in FULL — every run so far was partial, so no design has`)
      console.log(`      been retired and listing_survival is not yet measurable for this brand.`)
      console.log(`      reason: ${lastWithData.truncated_reason ?? 'unknown'}`)
    } else if (partials.length > 0) {
      console.log(`    ${partials.length}/${history.length} recent run(s) partial — ${partials[0].truncated_reason}`)
    }

    // Failures since the last run that produced data are the leading indicator.
    const sinceData = history.slice(0, history.indexOf(lastWithData))
    const failures = sinceData.filter((r: any) => r.status === 'failed')
    if (failures.length > 0) {
      anyRed = true
      console.log(`    ${failures.length} failed run(s) since: ${failures[0].error ?? 'no message'}`)
    }
  }

  // Corpus depth. Until there are ~26 weekly snapshots the spec's own
  // confidence rule caps everything downstream at MED at best.
  const { count: snapCount } = await supabaseAdmin
    .from('dip_snapshots').select('*', { count: 'exact', head: true })
  const { count: designCount } = await supabaseAdmin
    .from('dip_designs').select('*', { count: 'exact', head: true })
  const { data: oldest } = await supabaseAdmin
    .from('dip_snapshots').select('captured_at').order('captured_at').limit(1)

  console.log()
  console.log(`designs tracked   ${designCount ?? 0}`)
  console.log(`snapshots stored  ${snapCount ?? 0}`)
  if (oldest?.[0]) {
    const weeks = (Date.now() - new Date(oldest[0].captured_at).getTime()) / (7 * DAY)
    console.log(`corpus depth      ${weeks.toFixed(1)} weeks`)
    if (weeks < 26) {
      console.log(`                  (below 26 weeks — confidence caps at MED per the spec)`)
    }
  }

  if (inactive.length > 0) {
    console.log(`\nawaiting an adapter: ${inactive.map((b: any) => b.name).join(', ')}`)
  }

  if (anyRed) {
    console.log('\n⚠ Cadence is broken for at least one brand. Downstream signals are not trustworthy.')
    process.exit(1)
  }
  console.log('\n✓ All active brands captured data within the last week.')
}

main().catch(err => { console.error(err); process.exit(1) })
