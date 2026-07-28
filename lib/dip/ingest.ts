import { createHash } from 'crypto'
import { supabaseAdmin } from '../supabaseAdmin'
import { fetchAllRows } from '../aurora/infrastructure/fetchAllRows'
import { getAdapter } from './adapters'
import type { DipBrand, IngestResult, RawDesign } from './types'

/**
 * DIP ingest orchestrator.
 *
 * Three invariants, each of which exists because violating it corrupts the
 * time series in a way that cannot be detected later:
 *
 *  1. A run row is opened BEFORE any work and closed in `finally`. A crashed
 *     run must leave evidence — "no data for week 12" and "week 12 failed" are
 *     different facts, and only one of them is a competitor signal.
 *
 *  2. `is_live=false` is only ever applied after a run that read the catalogue
 *     in FULL. A partial read marking the unread half as delisted would
 *     manufacture the largest fake signal the corpus could produce.
 *
 *  3. Snapshots are inserted, never updated. The database enforces this too,
 *     but the code should not be trying.
 */

const SNAPSHOT_CHUNK = 500

function hashRaw(raw: unknown): string {
  return createHash('sha256').update(JSON.stringify(raw ?? null)).digest('hex')
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Ingest one brand. Never throws — a failure is a recorded outcome. */
export async function ingestBrand(brand: DipBrand): Promise<IngestResult> {
  const startedAt = new Date().toISOString()

  const result: IngestResult = {
    brand_id: brand.id,
    brand_name: brand.name,
    status: 'failed',
    http_status: null,
    designs_seen: 0,
    designs_new: 0,
    snapshots_written: 0,
    error: null,
    started_at: startedAt,
    finished_at: startedAt,
  }

  // Open the run row first, so a hard crash still leaves provenance.
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from('dip_ingest_runs')
    .insert({ brand_id: brand.id, started_at: startedAt, status: 'running' })
    .select('id')
    .single()

  if (runErr || !runRow) {
    result.error = `could not open run row: ${runErr?.message ?? 'no row returned'}`
    result.finished_at = new Date().toISOString()
    return result
  }
  const runId = runRow.id as string

  let truncatedReason: string | null = null

  try {
    const adapter = getAdapter(brand.platform)
    if (!adapter) {
      throw new Error(`no adapter for platform '${brand.platform}'`)
    }

    const out = await adapter.fetch(brand)
    result.http_status = out.http_status
    truncatedReason = out.truncated_reason
    result.designs_seen = out.designs.length

    if (out.designs.length === 0) {
      throw new Error('adapter returned zero designs')
    }

    const { newCount, snapshotCount } = await persist(brand, runId, out.designs)
    result.designs_new = newCount
    result.snapshots_written = snapshotCount

    // Only a complete read may retire designs. See invariant 2.
    if (!truncatedReason) {
      await retireUnseen(brand.id, startedAt)
      result.status = 'success'
    } else {
      result.status = 'partial'
    }
  } catch (err: any) {
    result.error = err?.message || String(err)
    result.status = 'failed'
  } finally {
    result.finished_at = new Date().toISOString()
    await supabaseAdmin
      .from('dip_ingest_runs')
      .update({
        finished_at: result.finished_at,
        status: result.status,
        http_status: result.http_status,
        designs_seen: result.designs_seen,
        designs_new: result.designs_new,
        snapshots_written: result.snapshots_written,
        truncated_reason: truncatedReason,
        error: result.error,
      })
      .eq('id', runId)
  }

  return result
}

/** Upsert design identities, then append one snapshot each. */
async function persist(
  brand: DipBrand,
  runId: string,
  designs: RawDesign[],
): Promise<{ newCount: number; snapshotCount: number }> {
  const seenAt = new Date().toISOString()

  // Which of these already exist, and what raw payload did they last carry?
  //
  // MUST paginate. GIVA alone is 4,712 designs and PostgREST caps an unbounded
  // select at 1,000 rows WITHOUT an error — the exact failure fetchAllRows was
  // written for. Truncating here would silently treat every design past the
  // first 1,000 as brand new, every single week: `designs_new` would be
  // permanently inflated and `launch_rate`, the whole point of the corpus,
  // would be fiction.
  const existingRes = await fetchAllRows<{ id: string; external_id: string; last_raw_hash: string | null }>(
    `dip_designs.${brand.name}`,
    (from, to) => supabaseAdmin
      .from('dip_designs')
      .select('id, external_id, last_raw_hash')
      .eq('brand_id', brand.id)
      .range(from, to),
  )
  if (existingRes.error) throw new Error(`reading existing designs: ${existingRes.error}`)

  const existing = new Map(existingRes.rows.map(r => [r.external_id, r]))
  const newCount = designs.filter(d => !existing.has(d.external_id)).length

  // Upsert identity. `last_seen` moves; `first_seen` is left to its default so
  // an existing row keeps the date it was actually first observed — that span
  // is the listing_survival signal.
  const rows = designs.map(d => ({
    brand_id: brand.id,
    external_id: d.external_id,
    handle: d.handle,
    title: d.title,
    product_type: d.product_type,
    source_url: d.source_url,
    last_seen: seenAt,
    is_live: true,
    last_raw_hash: hashRaw(d.raw),
  }))

  for (const batch of chunk(rows, SNAPSHOT_CHUNK)) {
    const { error } = await supabaseAdmin
      .from('dip_designs')
      .upsert(batch, { onConflict: 'brand_id,external_id' })
    if (error) throw new Error(`upserting designs: ${error.message}`)
  }

  // Re-read to get ids for everything, including rows just created. Paginated
  // for the same reason as above.
  const idRes = await fetchAllRows<{ id: string; external_id: string }>(
    `dip_designs.ids.${brand.name}`,
    (from, to) => supabaseAdmin
      .from('dip_designs')
      .select('id, external_id')
      .eq('brand_id', brand.id)
      .range(from, to),
  )
  if (idRes.error) throw new Error(`reading design ids: ${idRes.error}`)

  const idByExternal = new Map(idRes.rows.map(r => [r.external_id, r.id]))

  const snapshots = designs.map(d => {
    const rawHash = hashRaw(d.raw)
    const previousHash = existing.get(d.external_id)?.last_raw_hash
    return {
      design_id: idByExternal.get(d.external_id),
      run_id: runId,
      captured_at: seenAt,
      price_local: d.price_local,
      currency: d.currency,
      compare_at_price: d.compare_at_price,
      is_discounted: d.compare_at_price !== null && d.price_local !== null
        && d.compare_at_price > d.price_local,
      available: d.available,
      variant_count: d.variant_count,
      grams: d.grams,
      tags: d.tags,
      image_urls: d.image_urls,
      // Written only when the payload actually changed. Most designs are
      // unchanged most weeks; storing an identical blob 52 times a year buys
      // nothing and was the difference between 1.9 GB/year and fitting the
      // plan. To reconstruct a payload at any date, take the most recent
      // non-null raw at or before it.
      raw: previousHash === rawHash ? null : d.raw,
      raw_hash: rawHash,
    }
  }).filter(s => s.design_id)

  let snapshotCount = 0
  for (const batch of chunk(snapshots, SNAPSHOT_CHUNK)) {
    const { error } = await supabaseAdmin.from('dip_snapshots').insert(batch)
    if (error) throw new Error(`inserting snapshots: ${error.message}`)
    snapshotCount += batch.length
  }

  return { newCount, snapshotCount }
}

/**
 * Mark designs this run did not see as no longer live.
 *
 * Called only after a complete read. Uses `last_seen` rather than an id list
 * because the id list can run to thousands and would not fit in a URL filter.
 */
async function retireUnseen(brandId: string, runStartedAt: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('dip_designs')
    .update({ is_live: false })
    .eq('brand_id', brandId)
    .eq('is_live', true)
    .lt('last_seen', runStartedAt)
  if (error) throw new Error(`retiring unseen designs: ${error.message}`)
}

/** Ingest every active brand. One brand's failure never stops the others. */
export async function ingestAll(brandFilter?: string): Promise<IngestResult[]> {
  let query = supabaseAdmin.from('dip_brands').select('*').eq('is_active', true)
  if (brandFilter) query = query.ilike('name', `%${brandFilter}%`)

  const { data, error } = await query
  if (error) throw new Error(`reading brands: ${error.message}`)

  const brands = (data ?? []) as DipBrand[]
  const results: IngestResult[] = []
  for (const brand of brands) {
    results.push(await ingestBrand(brand))
  }
  return results
}
