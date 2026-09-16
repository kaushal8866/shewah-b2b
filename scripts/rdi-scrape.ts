/**
 * Scrape the RDI Diamonds public inventory listing.
 *
 *   npm run rdi:scrape                          natural diamonds (default)
 *   npm run rdi:scrape -- --lab                 lab-grown listing
 *   npm run rdi:scrape -- --shape=oval          one shape only
 *   npm run rdi:scrape -- --limit=200           stop early, for a smoke test
 *   npm run rdi:scrape -- --out=scratch/rdi     where the CSV/JSON land
 *
 * How it works: the listing is a Laravel Livewire component. The first page of
 * rows is already sitting in the `wire:snapshot` attribute of the initial HTML,
 * fully decoded (shape/colour/clarity come through as labels, not FK ids). The
 * page's own infinite scroll appends the next 100 by dispatching an
 * `add_items_on_scroll` event, so we replay exactly that call and feed each
 * response snapshot into the next request.
 *
 * The server returns the whole accumulated array every time, so the last
 * response is the complete set — but we still stop on "no growth" rather than
 * trusting num_results, since inventory shifts under us mid-crawl.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE = 'https://rdidiamonds.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
const PAGE_SIZE = 100

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : undefined
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`)

/** A row as the listing hands it to us, after label decoding. */
type Diamond = {
  stockid: string
  shape_type_id: string
  carat_weight: string
  color_grade_type_id: string
  clarity_grade_type_id: string
  cut_type_id: string
  polish_type_id: string
  symmetry_type_id: string
  fluorescence_type_id: string
  depth: number | null
  diamond_table: number | null
  measurements: string | null
  certification_type_id: string
  price: number | null
  price_per_carat: number | null
  percent_rap: number | null
  on_hand: string | null
  display_image: string | null
  [k: string]: unknown
}

/** Output column order — reads like the table on the site, left to right. */
const COLUMNS = [
  ['stock_id', 'stockid'],
  ['shape', 'shape_type_id'],
  ['carat', 'carat_weight'],
  ['color', 'color_grade_type_id'],
  ['clarity', 'clarity_grade_type_id'],
  ['cut', 'cut_type_id'],
  ['polish', 'polish_type_id'],
  ['symmetry', 'symmetry_type_id'],
  ['fluorescence', 'fluorescence_type_id'],
  ['depth_pct', 'depth'],
  ['table_pct', 'diamond_table'],
  ['measurements', 'measurements'],
  ['cert', 'certification_type_id'],
  ['total_price_usd', 'price'],
  ['price_per_carat_usd', 'price_per_carat'],
  ['percent_rap', 'percent_rap'],
  ['availability', 'on_hand'],
  ['image_url', 'display_image'],
] as const

function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Livewire serialises arrays as [value, {s:'arr'}] tuples. Rows arrive wrapped
 * the same way, so unwrap one level when we see it.
 */
function unwrap<T>(v: unknown): T {
  return (Array.isArray(v) ? v[0] : v) as T
}

type Session = { cookie: string; token: string; snapshot: string }

/** Accumulate cookies across responses — Livewire needs the Laravel session. */
function mergeCookies(existing: string, res: Response): string {
  const jar = new Map<string, string>()
  for (const pair of existing.split('; ').filter(Boolean)) {
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
  // getSetCookie is the only way to see multiple Set-Cookie headers intact.
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const c of raw) {
    const first = c.split(';')[0]
    const i = first.indexOf('=')
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1))
  }
  return Array.from(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function openListing(url: string): Promise<Session & { total: number; rows: Diamond[] }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`listing page returned HTTP ${res.status}`)
  const cookie = mergeCookies('', res)
  const html = await res.text()

  const tokenMatch = html.match(/csrf-token"\s+content="([^"]+)"/)
  const snapMatch = html.match(/wire:snapshot="([^"]*)"/)
  if (!tokenMatch || !snapMatch) {
    throw new Error('could not find csrf-token or wire:snapshot — the page markup changed')
  }

  const snapshot = unescapeHtml(snapMatch[1])
  const parsed = JSON.parse(snapshot)
  return {
    cookie,
    token: tokenMatch[1],
    snapshot,
    total: Number(parsed.data.num_results) || 0,
    rows: unwrap<unknown[]>(parsed.data.items).map(r => unwrap<Diamond>(r)),
  }
}

/** Replay one infinite-scroll tick. Returns the next snapshot and full row set. */
async function loadMore(
  s: Session,
  referer: string
): Promise<{ snapshot: string; cookie: string; rows: Diamond[] }> {
  const body = {
    _token: s.token,
    components: [
      {
        snapshot: s.snapshot,
        updates: {},
        calls: [{ path: '', method: '__dispatch', params: ['add_items_on_scroll', {}] }],
      },
    ],
  }

  const res = await fetch(`${BASE}/livewire-14437e87/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Livewire': '1',
      'X-CSRF-TOKEN': s.token,
      'User-Agent': UA,
      Referer: referer,
      Cookie: s.cookie,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`livewire update returned HTTP ${res.status}`)

  const json = (await res.json()) as { components: { snapshot: string }[] }
  const next = json.components?.[0]?.snapshot
  if (!next) throw new Error('livewire response had no component snapshot')

  const parsed = JSON.parse(next)
  return {
    snapshot: next,
    cookie: mergeCookies(s.cookie, res),
    rows: unwrap<unknown[]>(parsed.data.items).map(r => unwrap<Diamond>(r)),
  }
}

function toCsv(rows: Diamond[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [COLUMNS.map(([label]) => label).join(',')]
  for (const r of rows) lines.push(COLUMNS.map(([, key]) => cell(r[key])).join(','))
  return lines.join('\n') + '\n'
}

async function main() {
  const shape = arg('shape')
  const listing = hasFlag('lab') ? 'lab-grown' : 'diamonds'
  const url = arg('url') ?? `${BASE}/products/${listing}${shape ? `/${shape}` : ''}`
  const outDir = arg('out') ?? 'scratch/rdi'
  const limit = Number(arg('limit')) || Infinity
  const delayMs = Number(arg('delay')) || 1200

  console.log(`Scraping ${url}`)
  const start = await openListing(url)
  let session: Session = { cookie: start.cookie, token: start.token, snapshot: start.snapshot }
  let rows = start.rows
  const target = Math.min(start.total, limit)
  console.log(`  ${start.total} listed, ${rows.length} on the first page`)

  // The site itself caps out at num_results; the +3 absorbs inventory that gets
  // added mid-crawl without letting a stuck response spin forever.
  const maxCalls = Math.ceil(target / PAGE_SIZE) + 3

  for (let i = 0; i < maxCalls && rows.length < target; i++) {
    await new Promise(r => setTimeout(r, delayMs))
    const before = rows.length
    const next = await loadMore(session, url)
    session = { ...session, snapshot: next.snapshot, cookie: next.cookie }
    rows = next.rows
    if (rows.length === before) {
      console.log(`  stopped early: server returned no new rows at ${rows.length}`)
      break
    }
    console.log(`  ${rows.length}/${target}`)
  }

  if (rows.length > limit) rows = rows.slice(0, limit)

  // Guard against a repeated page silently inflating the count.
  const unique = new Map(rows.map(r => [r.stockid, r]))
  if (unique.size !== rows.length) {
    console.log(`  note: dropped ${rows.length - unique.size} duplicate stock ids`)
    rows = Array.from(unique.values())
  }

  mkdirSync(outDir, { recursive: true })
  const slug = `rdi-${listing}${shape ? `-${shape}` : ''}`
  const csvPath = join(outDir, `${slug}.csv`)
  const jsonPath = join(outDir, `${slug}.json`)
  writeFileSync(csvPath, toCsv(rows))
  writeFileSync(jsonPath, JSON.stringify(rows, null, 2))

  console.log(`\n${rows.length} rows -> ${csvPath}`)
  console.log(`${rows.length} rows -> ${jsonPath}`)

  if (rows.length < target) {
    console.log(`\nWARNING: expected ${target}, got ${rows.length}.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`rdi-scrape failed: ${err?.message || err}`)
  process.exit(1)
})
