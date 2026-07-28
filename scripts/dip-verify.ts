/**
 * Build the verification sheet, and import the verdicts.
 *
 *   npm run dip:verify -- --build [--size=24]
 *   npm run dip:verify -- --import <verdicts.json>
 *
 * The model has already answered; the human confirms. See
 * lib/dip/goldset/verify.ts for why this replaced blind labelling.
 */
import fs from 'fs'
import path from 'path'
import { loadEnv, requireSupabaseEnv } from '../lib/dip/loadEnv'

loadEnv()
requireSupabaseEnv()

const OUT = path.resolve(process.cwd(), 'dip-verify.html')
const MANIFEST = path.resolve(process.cwd(), '.dip-planted.json')

function num(name: string, fallback: number): number {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  const n = hit ? Number(hit.split('=')[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function build() {
  const { buildVerifySheet } = await import('../lib/dip/goldset/buildVerify')
  const { renderVerifySheet } = await import('../lib/dip/goldset/verify')

  const size = num('size', 24)
  const r = await buildVerifySheet(size)

  fs.writeFileSync(OUT, renderVerifySheet(r.rows, 'gold_set_v1'))
  // The truth for planted cards is written HERE, never into the sheet.
  fs.writeFileSync(MANIFEST, JSON.stringify(r.planted, null, 2))

  console.log(`extracted rows available   ${r.extracted_available}`)
  console.log(`cards in sheet             ${r.rows.length}`)
  console.log(`attention checks planted   ${r.planted.length}`)
  console.log(`\n✓ wrote ${OUT}`)
  console.log(`  (planted answers recorded separately in ${path.basename(MANIFEST)} — do not open it)`)
}

async function importVerdicts(file: string) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const planted: any[] = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : []
  const plantedBy = new Map(planted.map(p => [p.design_id, p]))

  const verdicts: any[] = payload.verdicts ?? []
  let ok = 0, wrong = 0, skip = 0
  const fieldWrong: Record<string, number> = {}

  for (const v of verdicts) {
    if (v.verdict === 'ok') ok++
    else if (v.verdict === 'skip') skip++
    else wrong++
    for (const f of Object.keys(v.corrections ?? {})) fieldWrong[f] = (fieldWrong[f] ?? 0) + 1
  }

  // Did the attention checks work? This decides whether anything above counts.
  let caught = 0, missed = 0
  for (const p of planted) {
    const v = verdicts.find((x: any) => x.design_id === p.design_id)
    if (!v) continue
    if (v.verdict === 'wrong' && Object.prototype.hasOwnProperty.call(v.corrections ?? {}, p.field)) caught++
    else if (v.verdict === 'ok') missed++
  }

  console.log(`verdicts        ${verdicts.length}`)
  console.log(`  all correct   ${ok}`)
  console.log(`  corrections   ${wrong}`)
  console.log(`  can't tell    ${skip}`)
  console.log('\nfields marked wrong:')
  for (const f of Object.keys(fieldWrong).sort((a, b) => fieldWrong[b] - fieldWrong[a])) {
    console.log(`  ${f.padEnd(14)} ${fieldWrong[f]}`)
  }

  console.log(`\nattention checks: ${caught} caught, ${missed} missed (of ${planted.length})`)
  if (planted.length > 0 && caught === 0) {
    console.log('⚠ NONE of the deliberately wrong answers were caught.')
    console.log('  The verification did not discriminate — treat every number above as unmeasured.')
  } else if (missed > caught) {
    console.log('⚠ More planted errors were missed than caught. Discount these results heavily.')
  } else if (planted.length > 0) {
    console.log('✓ The check discriminates — the verdicts above can be trusted.')
  }
}

async function main() {
  const file = arg('import')
  if (file) return importVerdicts(file)
  if (process.argv.includes('--build')) return build()
  console.log('Usage:\n  --build [--size=24]\n  --import <verdicts.json>')
}

main().catch(err => { console.error(err); process.exit(1) })
