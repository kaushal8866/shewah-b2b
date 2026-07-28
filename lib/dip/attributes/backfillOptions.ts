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

export interface BackfillResult {
  designs_seen: number
  with_karat: number
  with_colour: number
  with_either: number
  rows_written: number
  coverage_pct: number
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

  const seen = latestByDesign.size
  return {
    designs_seen: seen,
    with_karat: withKarat,
    with_colour: withColour,
    with_either: withEither,
    rows_written: written,
    coverage_pct: seen === 0 ? 0 : Math.round((withEither / seen) * 1000) / 10,
  }
}
