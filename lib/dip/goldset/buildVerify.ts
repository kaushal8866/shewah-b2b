import { createHash } from 'crypto'
import { supabaseAdmin } from '../../supabaseAdmin'
import { fetchAllRows } from '../../aurora/infrastructure/fetchAllRows'
import { DIP_USER_AGENT } from '../http'
import { VOCAB, GOLD_FIELDS } from '../attributes/vocabulary'
import type { VerifyRow } from './verify'

/**
 * Assemble the verification sheet from rows the extractor has already written.
 *
 * The order is deliberately the reverse of a classic gold set: extract first,
 * then have a human confirm. That is the only version of this the operator can
 * actually do — he does not know the gemological vocabulary, and recognition
 * needs no vocabulary while recall does.
 */

const IMAGE_WIDTH = 800
/** Roughly one in six, so a distracted pass is detectable but the set stays useful. */
const PLANT_RATE = 6

function resized(url: string): string {
  if (!url.includes('cdn.shopify.com')) return url
  return url.includes('?') ? `${url}&width=${IMAGE_WIDTH}` : `${url}?width=${IMAGE_WIDTH}`
}

async function toDataUri(url: string): Promise<{ uri: string; sha: string } | null> {
  try {
    const res = await fetch(resized(url), { headers: { 'User-Agent': DIP_USER_AGENT } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    const type = res.headers.get('content-type') || 'image/jpeg'
    return {
      uri: `data:${type};base64,${buf.toString('base64')}`,
      sha: createHash('sha256').update(buf).digest('hex'),
    }
  } catch { return null }
}

/**
 * Swap one answer for a different, plausible value from the same vocabulary.
 *
 * Plausible matters: replacing "prong6" with "unsure" would be spotted by
 * anyone skimming, and would test nothing. Replacing it with "bezel" requires
 * actually looking at the photograph.
 */
function plant(field: string, current: string): string {
  const options = (VOCAB[field as keyof typeof VOCAB] ?? [])
    .filter(v => v !== current && v !== 'unsure' && v !== 'other')
  if (options.length === 0) return current
  return options[Math.floor(Math.random() * options.length)]
}

export interface VerifyBuild {
  rows: VerifyRow[]
  planted: Array<{ design_id: string; field: string; shown: string; truth: string }>
  extracted_available: number
}

export async function buildVerifySheet(size: number): Promise<VerifyBuild> {
  // Latest extractor version only — verifying an older version's answers would
  // measure a prompt that is no longer in use.
  const { data: version, error: vErr } = await supabaseAdmin
    .from('dip_model_versions')
    .select('id, version')
    .eq('kind', 'vision_model')
    .order('created_at', { ascending: false })
    .limit(1).single()
  if (vErr || !version) throw new Error('no vision extractor version found — run dip:extract first')

  const attrRes = await fetchAllRows<any>(
    'verify.attrs',
    (from, to) => supabaseAdmin.from('dip_attributes')
      .select('design_id, category, silhouette, stone_shape, setting, raw_model_output, evidence')
      .eq('model_version_id', version.id).eq('status', 'extracted').range(from, to),
  )
  if (attrRes.error) throw new Error(`reading attributes: ${attrRes.error}`)
  if (attrRes.rows.length === 0) {
    throw new Error(`no extracted rows at ${version.version} — run dip:extract first`)
  }

  const ids = attrRes.rows.map(r => r.design_id)
  const designRes = await fetchAllRows<{ id: string; brand_id: string }>(
    'verify.designs',
    (from, to) => supabaseAdmin.from('dip_designs').select('id, brand_id').in('id', ids).range(from, to),
  )
  const { data: brandRows } = await supabaseAdmin.from('dip_brands').select('id, name')
  const brandName = new Map((brandRows ?? []).map((b: any) => [b.id, b.name]))
  const brandOf = new Map(designRes.rows.map(d => [d.id, brandName.get(d.brand_id) ?? '']))

  const snapRes = await fetchAllRows<{ design_id: string; image_urls: string[]; price_local: number | null; captured_at: string }>(
    'verify.snaps',
    (from, to) => supabaseAdmin.from('dip_snapshots')
      .select('design_id, image_urls, price_local, captured_at')
      .in('design_id', ids).order('captured_at', { ascending: false }).range(from, to),
  )
  const latest = new Map<string, { urls: string[]; price: number | null }>()
  for (const s of snapRes.rows) {
    if (!latest.has(s.design_id)) latest.set(s.design_id, { urls: s.image_urls ?? [], price: s.price_local })
  }

  const rows: VerifyRow[] = []
  const planted: VerifyBuild['planted'] = []

  for (const a of attrRes.rows.slice(0, size)) {
    const snap = latest.get(a.design_id)
    if (!snap || snap.urls.length === 0) continue

    const uris: string[] = []
    for (const url of snap.urls.slice(0, 3)) {
      const img = await toDataUri(url)
      if (img) uris.push(img.uri)
      await new Promise(r => setTimeout(r, 200))
    }
    if (uris.length === 0) continue

    const answers: Record<string, string> = {}
    for (const f of GOLD_FIELDS) answers[f] = a[f] ?? 'unsure'
    const confidence = (a.raw_model_output?.confidence ?? {}) as Record<string, number>

    const row: VerifyRow = {
      design_id: a.design_id,
      brand_name: brandOf.get(a.design_id) ?? '',
      price_local: snap.price,
      image_data_uris: uris,
      answers: { ...answers },
      confidence,
      notes: a.raw_model_output?.notes ?? '',
    }

    // Attention check. The TRUE value is kept out of the HTML entirely — it
    // lives only in the returned manifest, so the sheet cannot leak it.
    if (rows.length > 0 && rows.length % PLANT_RATE === 0) {
      const field = GOLD_FIELDS[Math.floor(Math.random() * GOLD_FIELDS.length)]
      const truth = answers[field]
      const shown = plant(field, truth)
      if (shown !== truth) {
        row.answers[field] = shown
        row.planted_field = field
        planted.push({ design_id: a.design_id, field, shown, truth })
      }
    }

    rows.push(row)
  }

  return { rows, planted, extracted_available: attrRes.rows.length }
}
