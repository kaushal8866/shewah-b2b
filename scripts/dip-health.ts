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

import { supabaseAdmin } from '../lib/supabaseAdmin'

const DAY = 24 * 60 * 60 * 1000

async function main() {
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
    const lastSuccess = history.find((r: any) => r.status === 'success')

    if (!lastSuccess) {
      anyRed = true
      console.log(`✗ ${b.name} — NEVER succeeded (${history.length} run(s) recorded)`)
      const last = history[0]
      if (last?.error) console.log(`    last error: ${last.error}`)
      continue
    }

    const ageDays = (Date.now() - new Date(lastSuccess.started_at).getTime()) / DAY
    worstAgeDays = Math.max(worstAgeDays, ageDays)

    // Weekly cadence: 8 days is a missed run, 15 is two.
    const mark = ageDays > 15 ? '✗' : ageDays > 8 ? '⚠' : '✓'
    if (ageDays > 8) anyRed = true

    console.log(`${mark} ${b.name} — last success ${ageDays.toFixed(1)}d ago, ` +
      `${lastSuccess.designs_seen} designs (${lastSuccess.designs_new} new)`)

    // Consecutive failures since the last success are the leading indicator.
    const sinceSuccess = history.slice(0, history.indexOf(lastSuccess))
    const failures = sinceSuccess.filter((r: any) => r.status === 'failed')
    if (failures.length > 0) {
      anyRed = true
      console.log(`    ${failures.length} failed run(s) since: ${failures[0].error ?? 'no message'}`)
    }
    const partials = history.filter((r: any) => r.status === 'partial')
    if (partials.length > 0) {
      console.log(`    ${partials.length}/${history.length} recent run(s) partial — ${partials[0].truncated_reason}`)
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
  console.log('\n✓ All active brands ingested within the last week.')
}

main().catch(err => { console.error(err); process.exit(1) })
