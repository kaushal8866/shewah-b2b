import { createHash } from 'crypto'
import { supabaseAdmin } from '../../supabaseAdmin'
import { fetchAllRows } from '../../aurora/infrastructure/fetchAllRows'
import { DIP_USER_AGENT } from '../http'
import { isRing, stratify, type Candidate } from './select'
import { VOCAB_VERSION, GOLD_FIELDS } from '../attributes/vocabulary'
import { sizedImageUrl } from '../images'

/**
 * Build a frozen evaluation set and the blind labelling sheet.
 *
 * Images are downloaded, hashed and EMBEDDED in the sheet as data URIs rather
 * than linked. Linking would mean the sheet shows whatever the CDN serves at
 * labelling time, which may not be what was hashed — and a label pinned to a
 * hash it does not match is worse than no label. Embedding makes the labelled
 * image and the recorded hash provably the same bytes.
 */

const SET_VERSION = 'gold_set_v1'

/**
 * How many images the labeller and the extractor both see.
 *
 * Not one. Building the first sheet showed image[0] is frequently a LIFESTYLE
 * shot — a model wearing the ring at a distance where setting and stone shape
 * are simply not visible. A human cannot label that image either, so a pilot
 * run on it would measure image luck rather than extraction quality. Filenames
 * carry no usable signal, so there is no safe heuristic for "the product shot".
 *
 * Three is what a shopper glances at, and at ~$0.0004 per image the cost of
 * not choosing is irrelevant.
 */
export const IMAGES_PER_DESIGN = 3

export interface BuiltImage {
  url: string
  sha256: string
  data_uri: string
  bytes: number
}

export interface BuiltRow extends Candidate {
  /** Primary first. Empty designs are dropped before this point. */
  images: BuiltImage[]
  image_sha256: string        // primary, for the pinned column
  bytes: number               // total across all images
}

/** Download, hash and inline. Sizing is shared via lib/dip/images.ts. */
async function downloadImage(url: string): Promise<{ sha256: string; dataUri: string; bytes: number } | null> {
  try {
    const res = await fetch(sizedImageUrl(url), { headers: { 'User-Agent': DIP_USER_AGENT } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    const sha256 = createHash('sha256').update(buf).digest('hex')
    const type = res.headers.get('content-type') || 'image/jpeg'
    return { sha256, dataUri: `data:${type};base64,${buf.toString('base64')}`, bytes: buf.length }
  } catch {
    return null
  }
}

/** Collect ring candidates from the gold-focus brands. */
export async function collectCandidates(): Promise<Candidate[]> {
  const { data: brandRows, error: brandErr } = await supabaseAdmin
    .from('dip_brands')
    .select('id, name, product_focus')
    .eq('is_active', true)
    .neq('product_focus', 'silver')
  if (brandErr) throw new Error(`reading brands: ${brandErr.message}`)

  const brands = new Map((brandRows ?? []).map((b: any) => [b.id as string, b.name as string]))
  if (brands.size === 0) throw new Error('no active gold brands')

  const designRes = await fetchAllRows<{
    id: string; brand_id: string; title: string; product_type: string | null
  }>(
    'goldset.designs',
    (from, to) => supabaseAdmin
      .from('dip_designs')
      .select('id, brand_id, title, product_type')
      .in('brand_id', Array.from(brands.keys()))
      .eq('is_live', true)
      .range(from, to),
  )
  if (designRes.error) throw new Error(`reading designs: ${designRes.error}`)

  const rings = designRes.rows.filter(d => isRing(d.title, d.product_type))

  // Latest snapshot per ring, for price and image.
  const snapRes = await fetchAllRows<{
    id: string; design_id: string; price_local: number | null; image_urls: string[]; captured_at: string
  }>(
    'goldset.snapshots',
    (from, to) => supabaseAdmin
      .from('dip_snapshots')
      .select('id, design_id, price_local, image_urls, captured_at')
      .order('captured_at', { ascending: false })
      .range(from, to),
  )
  if (snapRes.error) throw new Error(`reading snapshots: ${snapRes.error}`)

  const latest = new Map<string, typeof snapRes.rows[number]>()
  for (const s of snapRes.rows) if (!latest.has(s.design_id)) latest.set(s.design_id, s)

  const candidates: Candidate[] = []
  for (const d of rings) {
    const snap = latest.get(d.id)
    const image = snap?.image_urls?.[0]
    if (!snap || !image) continue          // no image, nothing to label
    candidates.push({
      design_id: d.id,
      brand_id: d.brand_id,
      brand_name: brands.get(d.brand_id) ?? d.brand_id,
      title: d.title,
      product_type: d.product_type,
      price_local: snap.price_local,
      image_url: image,
      all_image_urls: snap.image_urls ?? [],
      snapshot_id: snap.id,
    })
  }
  return candidates
}

export async function buildGoldSet(size: number, dryRun = false): Promise<{
  set_version: string
  rows: BuiltRow[]
  candidates_considered: number
  images_failed: number
}> {
  const candidates = await collectCandidates()
  const picked = stratify(candidates, size)

  const rows: BuiltRow[] = []
  let failed = 0
  for (const c of picked) {
    const urls = (c.all_image_urls.length > 0 ? c.all_image_urls : [c.image_url!])
      .slice(0, IMAGES_PER_DESIGN)

    const images: BuiltImage[] = []
    for (const url of urls) {
      const img = await downloadImage(url)
      if (img) images.push({ url, sha256: img.sha256, data_uri: img.dataUri, bytes: img.bytes })
      await new Promise(r => setTimeout(r, 250))   // polite, same as the crawler
    }

    // A design whose images all failed cannot be labelled or extracted.
    if (images.length === 0) { failed++; continue }

    rows.push({
      ...c,
      images,
      image_sha256: images[0].sha256,
      bytes: images.reduce((s, i) => s + i.bytes, 0),
    })
  }

  if (dryRun) {
    return { set_version: SET_VERSION, rows, candidates_considered: candidates.length, images_failed: failed }
  }

  // The set row. `frozen` stays false until labelling is imported — the
  // membership is only meaningful once it can no longer change.
  const { data: setRow, error: setErr } = await supabaseAdmin
    .from('dip_gold_sets')
    .upsert({
      set_version: SET_VERSION,
      purpose: 'Vision extractor accuracy, India rings pilot',
      field_list: GOLD_FIELDS as unknown as string[],
      label_schema_version: VOCAB_VERSION,
      frozen: false,
      notes: `${rows.length} rings across gold brands, stratified by price. Images pinned by sha256.`,
    }, { onConflict: 'set_version' })
    .select('id')
    .single()
  if (setErr || !setRow) throw new Error(`writing gold set: ${setErr?.message ?? 'no row'}`)

  const labelRows = rows.map(r => ({
    gold_set_id: setRow.id,
    design_id: r.design_id,
    snapshot_id: r.snapshot_id,
    // Primary stays pinned singly — a merchant re-shooting image[0] is the
    // strongest change signal — while the arrays pin the full evidence shown.
    image_url: r.images[0].url,
    image_sha256: r.images[0].sha256,
    image_index: 0,
    image_urls: r.images.map(i => i.url),
    image_shas: r.images.map(i => i.sha256),
    annotator: 'pending',
    label_schema_version: VOCAB_VERSION,
  }))

  const { error: labelErr } = await supabaseAdmin
    .from('dip_gold_labels')
    .upsert(labelRows, { onConflict: 'gold_set_id,design_id' })
  if (labelErr) throw new Error(`writing gold labels: ${labelErr.message}`)

  return { set_version: SET_VERSION, rows, candidates_considered: candidates.length, images_failed: failed }
}
