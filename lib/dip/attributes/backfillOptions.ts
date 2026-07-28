import { supabaseAdmin } from '../../supabaseAdmin'
import { fetchAllRows } from '../../aurora/infrastructure/fetchAllRows'
import { parseOptions } from './options'

/**
 * Write karat and colour for every design, from the payload already stored.
 *
 * No network. `options` survived `trimRaw` when the corpus was built — only
 * the variants array was dropped — so the whole 8,042-design backfill runs
 * against `dip_snapshots.raw`. This is exactly what keeping the raw payload
 * was for, and it is the first time that decision has paid off.
 *
 * Idempotent: upserts on (design_id, model_version_id), so re-running after a
 * normaliser fix corrects rows in place rather than duplicating them.
 */

const PARSER_KIND = 'structured_parser'
const PARSER_VERSION = 'shopify-options-v1'
const CHUNK = 500

export interface BrandCoverage {
  brand_name: string
  product_focus: string
  designs: number
  with_karat: number
  with_colour: number
  karat_pct: number
}

export interface BackfillResult {
  designs_seen: number
  with_karat: number
  with_colour: number
  with_either: number
  rows_written: number
  /**
   * Coverage over GOLD designs only.
   *
   * Measuring across every brand conflates two different things. A silver
   * catalogue has no karat, so parsing nothing from it is the correct result,
   * not a miss — and averaging it in produced 41% and looked like a broken
   * parser when the gold brands were at 98.5% and 100%.
   */
  gold_coverage_pct: number
  gold_designs: number
  by_brand: BrandCoverage[]
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function backfillOptions(dryRun = false): Promise<BackfillResult> {
  const { data: version, error: versionErr } = await supabaseAdmin
    .from('dip_model_versions')
    .select('id')
    .eq('kind', PARSER_KIND)
    .eq('version', PARSER_VERSION)
    .single()

  if (versionErr || !version) {
    throw new Error(
      `parser version ${PARSER_VERSION} not found — has migrate_dip_attributes.sql been run? ` +
      `(${versionErr?.message ?? 'no row'})`,
    )
  }
  const modelVersionId = version.id as string

  // Latest snapshot per design that actually carries a payload. `raw` is null
  // on snapshots where nothing changed since the previous week, so the most
  // recent NON-NULL one is the design's current payload.
  const snapRes = await fetchAllRows<{
    id: string; design_id: string; raw: unknown; captured_at: string
  }>(
    'backfill.snapshots',
    (from, to) => supabaseAdmin
      .from('dip_snapshots')
      .select('id, design_id, raw, captured_at')
      .not('raw', 'is', null)
      .order('captured_at', { ascending: false })
      .range(from, to),
  )
  if (snapRes.error) throw new Error(`reading snapshots: ${snapRes.error}`)

  // Ordered newest first, so the first sighting of a design_id is its latest.
  const latestByDesign = new Map<string, { id: string; raw: unknown; captured_at: string }>()
  for (const s of snapRes.rows) {
    if (!latestByDesign.has(s.design_id)) {
      latestByDesign.set(s.design_id, { id: s.id, raw: s.raw, captured_at: s.captured_at })
    }
  }

  // Brand of each design, and whether that brand sells gold at all — needed to
  // report coverage against the right denominator.
  const designRes = await fetchAllRows<{ id: string; brand_id: string }>(
    'backfill.designs',
    (from, to) => supabaseAdmin.from('dip_designs').select('id, brand_id').range(from, to),
  )
  if (designRes.error) throw new Error(`reading designs: ${designRes.error}`)
  const brandOfDesign = new Map(designRes.rows.map(d => [d.id, d.brand_id]))

  const { data: brandRows, error: brandErr } = await supabaseAdmin
    .from('dip_brands')
    .select('id, name, product_focus')
  if (brandErr) throw new Error(`reading brands: ${brandErr.message}`)
  const brands = new Map(
    (brandRows ?? []).map((b: any) => [b.id as string, { name: b.name as string, focus: b.product_focus as string }]),
  )

  const perBrand = new Map<string, { designs: number; karat: number; colour: number }>()

  const rows: Array<Record<string, unknown>> = []
  let withKarat = 0
  let withColour = 0
  let withEither = 0

  for (const [designId, snap] of Array.from(latestByDesign.entries())) {
    const parsed = parseOptions(snap.raw)
    const hasKarat = parsed.karat_options.length > 0
    const hasColour = parsed.colour_options.length > 0
    if (hasKarat) withKarat++
    if (hasColour) withColour++
    if (hasKarat || hasColour) withEither++

    const brandId = brandOfDesign.get(designId)
    if (brandId) {
      const acc = perBrand.get(brandId) ?? { designs: 0, karat: 0, colour: 0 }
      acc.designs++
      if (hasKarat) acc.karat++
      if (hasColour) acc.colour++
      perBrand.set(brandId, acc)
    }

    rows.push({
      design_id: designId,
      model_version_id: modelVersionId,
      // 'extracted' even when both sets are empty: the parser ran and found
      // nothing, which is a determined result. 'failed' would imply it could
      // not run, and the two must stay distinguishable.
      status: 'extracted',
      karat_options: parsed.karat_options,
      colour_options: parsed.colour_options,
      evidence: {
        karat_options: {
          origin: 'shopify_options',
          snapshot_id: snap.id,
          source_path: parsed.source_paths[0] ?? null,
          captured_at: snap.captured_at,
          confidence: hasKarat ? 1 : 0,
        },
        colour_options: {
          origin: 'shopify_options',
          snapshot_id: snap.id,
          source_path: parsed.source_paths[parsed.source_paths.length - 1] ?? null,
          captured_at: snap.captured_at,
          confidence: hasColour ? 1 : 0,
        },
      },
    })
  }

  let written = 0
  if (!dryRun) {
    for (const batch of chunk(rows, CHUNK)) {
      const { error } = await supabaseAdmin
        .from('dip_attributes')
        .upsert(batch, { onConflict: 'design_id,model_version_id' })
      if (error) throw new Error(`writing attributes: ${error.message}`)
      written += batch.length
    }
  }

  const byBrand: BrandCoverage[] = Array.from(perBrand.entries())
    .map(([brandId, acc]) => {
      const brand = brands.get(brandId)
      return {
        brand_name: brand?.name ?? brandId,
        product_focus: brand?.focus ?? 'unknown',
        designs: acc.designs,
        with_karat: acc.karat,
        with_colour: acc.colour,
        karat_pct: acc.designs === 0 ? 0 : Math.round((acc.karat / acc.designs) * 1000) / 10,
      }
    })
    .sort((a, b) => b.designs - a.designs)

  // Silver brands are design REFERENCE under the spec, not product-comparable,
  // and silver has no karat. Including them in the denominator measures the
  // catalogue mix rather than the parser.
  const gold = byBrand.filter(b => b.product_focus !== 'silver')
  const goldDesigns = gold.reduce((sum, b) => sum + b.designs, 0)
  const goldKarat = gold.reduce((sum, b) => sum + b.with_karat, 0)

  return {
    designs_seen: latestByDesign.size,
    with_karat: withKarat,
    with_colour: withColour,
    with_either: withEither,
    rows_written: written,
    gold_designs: goldDesigns,
    gold_coverage_pct: goldDesigns === 0 ? 0 : Math.round((goldKarat / goldDesigns) * 1000) / 10,
    by_brand: byBrand,
  }
}
