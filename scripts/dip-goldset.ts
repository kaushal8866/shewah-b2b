/**
 * Build the frozen evaluation set and its blind labelling sheet.
 *
 *   npm run dip:goldset -- --build              select, hash, write, emit sheet
 *   npm run dip:goldset -- --build --dry-run    select and report, write nothing
 *   npm run dip:goldset -- --import <file.json> load the filled labels back
 *
 * The sheet contains NO model output. See lib/dip/goldset/sheet.ts for why.
 */

import fs from 'fs'
import path from 'path'
import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'

loadEnv()
requireSupabaseEnv()

const SIZE = 40
const OUT = path.resolve(process.cwd(), 'dip-gold-set.html')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function build(dryRun: boolean) {
  const { buildGoldSet } = await import('../lib/dip/goldset/build')
  const { renderSheet } = await import('../lib/dip/goldset/sheet')

  console.log(dryRun ? 'DRY RUN — selecting only.\n' : 'Building gold set.\n')
  const r = await buildGoldSet(SIZE, dryRun)

  console.log(`ring candidates considered  ${r.candidates_considered}`)
  console.log(`selected                    ${r.rows.length}`)
  if (r.images_failed > 0) console.log(`images that would not load  ${r.images_failed}`)

  const byBrand = new Map<string, number>()
  for (const row of r.rows) byBrand.set(row.brand_name, (byBrand.get(row.brand_name) ?? 0) + 1)
  console.log('\nby brand:')
  for (const [name, n] of Array.from(byBrand.entries())) console.log(`  ${name.padEnd(20)} ${n}`)

  const prices = r.rows.map(x => x.price_local ?? 0).filter(Boolean).sort((a, b) => a - b)
  if (prices.length) {
    const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
    console.log(`\nprice spread   ${inr(prices[0])} → ${inr(prices[prices.length - 1])}` +
      `   median ${inr(prices[Math.floor(prices.length / 2)])}`)
  }

  const mb = r.rows.reduce((s, x) => s + x.bytes, 0) / 1024 / 1024
  const imgCount = r.rows.reduce((s, x) => s + x.images.length, 0)
  console.log(`images         ${imgCount} across ${r.rows.length} designs, ${mb.toFixed(1)} MB embedded`)

  if (dryRun) { console.log('\n(dry run — nothing written)'); return }

  fs.writeFileSync(OUT, renderSheet(r.rows, r.set_version))
  console.log(`\n✓ wrote ${OUT}`)
  console.log('  Open it, label all 40, then press Export JSON.')
  console.log('  Answers save to the browser as you go, so you can stop and resume.')
}

async function importLabels(file: string) {
  const { supabaseAdmin } = await import('../lib/supabaseAdmin')
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))

  const { data: set, error: setErr } = await supabaseAdmin
    .from('dip_gold_sets').select('id, set_version, frozen')
    .eq('set_version', payload.set_version).single()
  if (setErr || !set) throw new Error(`gold set ${payload.set_version} not found`)
  if (set.frozen) throw new Error(`${payload.set_version} is frozen — labels cannot be changed`)

  const labels = Array.isArray(payload.labels) ? payload.labels : []
  if (labels.length === 0) throw new Error('no labels in file')

  // The hash is the point: a label must belong to the exact image that was
  // looked at, not merely to the design.
  const { data: existing } = await supabaseAdmin
    .from('dip_gold_labels').select('design_id, image_sha256').eq('gold_set_id', set.id)
  const shaByDesign = new Map((existing ?? []).map((r: any) => [r.design_id, r.image_sha256]))

  let mismatched = 0
  const rows = labels.filter((l: any) => {
    if (shaByDesign.get(l.design_id) !== l.image_sha256) { mismatched++; return false }
    return true
  }).map((l: any) => ({
    gold_set_id: set.id,
    design_id: l.design_id,
    category: l.category, silhouette: l.silhouette,
    stone_shape: l.stone_shape, setting: l.setting,
    label_confidence: l.label_confidence,
    annotator: process.env.USER || 'operator',
    labelled_at: payload.labelled_at || new Date().toISOString(),
    label_schema_version: payload.label_schema_version,
  }))

  if (mismatched > 0) {
    console.error(`✗ ${mismatched} label(s) reference a different image than the one recorded — skipped.`)
  }

  const { error } = await supabaseAdmin
    .from('dip_gold_labels')
    .upsert(rows, { onConflict: 'gold_set_id,design_id' })
  if (error) throw new Error(`writing labels: ${error.message}`)

  console.log(`✓ imported ${rows.length} labels into ${payload.set_version}`)

  const total = shaByDesign.size
  if (rows.length === total) {
    // Freeze only when complete. A partly-labelled set that later gains rows
    // would invalidate every comparison made against it in the meantime.
    await supabaseAdmin.from('dip_gold_sets').update({ frozen: true }).eq('id', set.id)
    console.log(`✓ all ${total} labelled — set frozen. Membership can no longer change.`)
  } else {
    console.log(`  ${rows.length}/${total} labelled — not frozen yet.`)
  }
}

async function main() {
  const file = arg('import')
  if (file) return importLabels(file)
  if (process.argv.includes('--build')) return build(process.argv.includes('--dry-run'))
  console.log('Usage:\n  --build [--dry-run]\n  --import <file.json>')
}

main().catch(err => { console.error(err); process.exit(1) })
