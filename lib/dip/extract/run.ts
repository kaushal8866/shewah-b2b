import { createHash } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '../../supabaseAdmin'
import { fetchAllRows } from '../../aurora/infrastructure/fetchAllRows'
import { DIP_USER_AGENT } from '../http'
import { buildPrompt, promptHash, normaliseOutput, colourCheck, PROMPT_SCHEMA_VERSION } from './prompt'
import { GOLD_FIELDS } from '../attributes/vocabulary'

/**
 * Gemini vision extraction.
 *
 * Written to be resumable and honest about failure, because both matter more
 * than speed here: a run that dies at design 180 of 200 must not lose the 179
 * that worked, and a design that failed must never be indistinguishable from
 * one where the model looked and saw nothing.
 */

/**
 * Prompt generation. Bumped from v1 when 'none' was added to the setting
 * vocabulary — the prompt text changed, so its hash changed.
 */
const PROMPT_VERSION = 'v2'

/**
 * The version string composes the prompt generation WITH the model name.
 *
 * This was a manual constant, and it caused the bug twice. Changing the prompt
 * while keeping the name UPDATES the version row in place, leaving rows already
 * written pointing at a description of something that never produced them.
 * Switching model does the same. Both are silent, and both destroy the ability
 * to compare versions — which is the entire reason the column exists.
 *
 * Composing it means a new prompt or a new model automatically becomes a new
 * version, and the mistake is no longer available to make.
 */
function extractorVersion(modelName: string): string {
  return `vision-${PROMPT_VERSION}@${modelName}`
}
const IMAGES_PER_DESIGN = 3
const IMAGE_WIDTH = 800
// With paceModelCall gating every request, concurrency only overlaps the
// image downloads — the model calls are serialised by the pacer regardless.
const CONCURRENCY = 2
const MAX_ATTEMPTS = 3
const IMAGE_TIMEOUT_MS = 30_000
const MODEL_TIMEOUT_MS = 60_000

// gemini-2.5-flash list price, USD per token. Used for an estimate recorded on
// the run; the real invoice is the authority.
const PRICE_IN = 0.15 / 1_000_000
const PRICE_OUT = 1.25 / 1_000_000

export interface ExtractOptions {
  limit: number
  brandFilter?: string
  goldSetOnly?: boolean
  dryRun?: boolean
}

export interface ExtractSummary {
  run_id: string | null
  attempted: number
  extracted: number
  failed: number
  input_tokens: number
  output_tokens: number
  est_cost_usd: number
  colour_check: Record<string, number>
  field_confidence: Record<string, { mean: number; unsure: number }>
}

interface Target {
  design_id: string
  brand_name: string
  image_urls: string[]
  colour_options: string[] | null
}

function resized(url: string): string {
  if (!url.includes('cdn.shopify.com')) return url
  return url.includes('?') ? `${url}&width=${IMAGE_WIDTH}` : `${url}?width=${IMAGE_WIDTH}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Minimum gap between model calls, in ms.
 *
 * PACE, DO NOT RETRY. The first design of this pilot fired requests
 * concurrently and backed off only after being rejected. On a free-tier
 * per-minute cap that is the worst possible pattern: every rejection costs
 * 20-60s of backoff, and the retries themselves count against the same quota.
 * Measured result — 28 designs took 9,181 seconds and 19 of them still failed.
 *
 * Staying just under the limit instead means requests are never rejected, so
 * the same 28 designs take about four minutes. Default 6,500ms is ~9.2
 * requests/minute, under the 10 RPM free tier with headroom. Raise
 * DIP_RPM_INTERVAL_MS if the key is rate limited harder; lower it (or set it
 * to 0) on a paid tier.
 */
const MODEL_CALL_INTERVAL_MS = Number(process.env.DIP_RPM_INTERVAL_MS ?? 6500)

let nextCallAt = 0
/** Serialises and paces every model call across all workers. */
async function paceModelCall(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, nextCallAt - now)
  nextCallAt = Math.max(now, nextCallAt) + MODEL_CALL_INTERVAL_MS
  if (wait > 0) await sleep(wait)
}

async function fetchImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)
  try {
    const res = await fetch(resized(url), {
      signal: controller.signal,
      headers: { 'User-Agent': DIP_USER_AGENT },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null
    return { mimeType: res.headers.get('content-type') || 'image/jpeg', data: buf.toString('base64') }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Which designs to extract. Rings from gold brands, not already done. */
async function selectTargets(modelVersionId: string, opts: ExtractOptions): Promise<Target[]> {
  const { isRing } = await import('../goldset/select')

  let brandQuery = supabaseAdmin.from('dip_brands').select('id, name').eq('is_active', true).neq('product_focus', 'silver')
  if (opts.brandFilter) brandQuery = brandQuery.ilike('name', `%${opts.brandFilter}%`)
  const { data: brandRows, error: brandErr } = await brandQuery
  if (brandErr) throw new Error(`reading brands: ${brandErr.message}`)
  const brands = new Map((brandRows ?? []).map((b: any) => [b.id as string, b.name as string]))
  if (brands.size === 0) return []

  // Gold-set members first when asked — those are the ones that get verified.
  let allowed: Set<string> | null = null
  if (opts.goldSetOnly) {
    const { data: set } = await supabaseAdmin.from('dip_gold_sets').select('id').eq('set_version', 'gold_set_v1').single()
    if (!set) throw new Error('gold_set_v1 not found — build it first')
    const { data: labels } = await supabaseAdmin.from('dip_gold_labels').select('design_id').eq('gold_set_id', set.id)
    allowed = new Set((labels ?? []).map((l: any) => l.design_id))
  }

  const designRes = await fetchAllRows<{ id: string; brand_id: string; title: string; product_type: string | null }>(
    'extract.designs',
    (from, to) => supabaseAdmin.from('dip_designs')
      .select('id, brand_id, title, product_type')
      .in('brand_id', Array.from(brands.keys())).eq('is_live', true).range(from, to),
  )
  if (designRes.error) throw new Error(`reading designs: ${designRes.error}`)

  // Already extracted at THIS version — idempotent, so a resumed run skips them.
  const doneRes = await fetchAllRows<{ design_id: string; status: string }>(
    'extract.done',
    (from, to) => supabaseAdmin.from('dip_attributes')
      .select('design_id, status').eq('model_version_id', modelVersionId).range(from, to),
  )
  const done = new Set((doneRes.rows ?? []).filter(r => r.status === 'extracted').map(r => r.design_id))

  const candidates = designRes.rows.filter(d =>
    isRing(d.title, d.product_type) && !done.has(d.id) && (!allowed || allowed.has(d.id)))

  // Latest snapshot for images.
  const snapRes = await fetchAllRows<{ design_id: string; image_urls: string[]; captured_at: string }>(
    'extract.snapshots',
    (from, to) => supabaseAdmin.from('dip_snapshots')
      .select('design_id, image_urls, captured_at').order('captured_at', { ascending: false }).range(from, to),
  )
  const latest = new Map<string, string[]>()
  for (const s of snapRes.rows) if (!latest.has(s.design_id)) latest.set(s.design_id, s.image_urls ?? [])

  // Known colours, for the diagnostic check.
  const optRes = await fetchAllRows<{ design_id: string; colour_options: string[] }>(
    'extract.colours',
    (from, to) => supabaseAdmin.from('dip_attributes')
      .select('design_id, colour_options')
      .not('colour_options', 'is', null).range(from, to),
  )
  const colours = new Map(optRes.rows.map(r => [r.design_id, r.colour_options]))

  const targets: Target[] = []
  for (const d of candidates) {
    const urls = (latest.get(d.id) ?? []).slice(0, IMAGES_PER_DESIGN)
    if (urls.length === 0) continue
    targets.push({
      design_id: d.id,
      brand_name: brands.get(d.brand_id) ?? '',
      image_urls: urls,
      colour_options: colours.get(d.id) ?? null,
    })
    if (targets.length >= opts.limit) break
  }
  return targets
}

/** Ensure the extractor version row exists and describes this exact run. */
async function ensureVersion(modelName: string): Promise<string> {
  const payload = {
    kind: 'vision_model',
    version: extractorVersion(modelName),
    provider: 'google',
    model_name: modelName,
    temperature: 0,
    max_output_tokens: 1024,
    prompt_hash: promptHash(),
    schema_version: PROMPT_SCHEMA_VERSION,
    normalizer_version: 'norm-v1',
    git_commit: process.env.GIT_COMMIT ?? null,
    config: { images_per_design: IMAGES_PER_DESIGN, image_width: IMAGE_WIDTH },
    notes: 'Closed-vocabulary attribute extraction from up to 3 product images.',
  }
  const { data, error } = await supabaseAdmin
    .from('dip_model_versions').upsert(payload, { onConflict: 'kind,version' }).select('id').single()
  if (error || !data) throw new Error(`writing model version: ${error?.message ?? 'no row'}`)
  return data.id as string
}

export async function runExtraction(opts: ExtractOptions): Promise<ExtractSummary> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  const modelVersionId = await ensureVersion(modelName)
  const targets = await selectTargets(modelVersionId, opts)

  const summary: ExtractSummary = {
    run_id: null, attempted: targets.length, extracted: 0, failed: 0,
    input_tokens: 0, output_tokens: 0, est_cost_usd: 0,
    colour_check: {}, field_confidence: {},
  }
  if (targets.length === 0 || opts.dryRun) return summary

  const { data: runRow, error: runErr } = await supabaseAdmin
    .from('dip_extraction_runs')
    .insert({
      model_version_id: modelVersionId, status: 'running',
      market: 'IN', category: 'ring',
      selection_query: `rings, gold brands${opts.goldSetOnly ? ', gold_set_v1 only' : ''}, limit ${opts.limit}`,
      design_ids: targets.map(t => t.design_id),
      image_variant: `first${IMAGES_PER_DESIGN}@width=${IMAGE_WIDTH}`,
      model_name: modelName, prompt_hash: promptHash(), git_commit: process.env.GIT_COMMIT ?? null,
      model_config: { temperature: 0, images_per_design: IMAGES_PER_DESIGN },
    })
    .select('id').single()
  if (runErr || !runRow) throw new Error(`opening run: ${runErr?.message ?? 'no row'}`)
  summary.run_id = runRow.id as string

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json' },
  })
  const prompt = buildPrompt()

  const confAcc: Record<string, { sum: number; n: number; unsure: number }> = {}

  async function extractOne(t: Target): Promise<void> {
    let failureReason: string | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const images = []
        for (const url of t.image_urls) {
          const img = await fetchImage(url)
          if (img) images.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
        }
        if (images.length === 0) { failureReason = 'image_download'; break }   // not retryable

        const withTimeout = <T,>(p: Promise<T>) => Promise.race([
          p,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('model_timeout')), MODEL_TIMEOUT_MS)),
        ])
        // Wait for our slot before calling, rather than being told off after.
        await paceModelCall()
        const result = await withTimeout(model.generateContent([prompt, ...images]))

        const usage = (result.response as any).usageMetadata
        summary.input_tokens += usage?.promptTokenCount ?? 0
        summary.output_tokens += usage?.candidatesTokenCount ?? 0

        const parsed = normaliseOutput(JSON.parse(result.response.text()))
        const check = colourCheck(parsed.image_colour_observed, t.colour_options)
        summary.colour_check[check] = (summary.colour_check[check] ?? 0) + 1

        for (const f of GOLD_FIELDS) {
          confAcc[f] ??= { sum: 0, n: 0, unsure: 0 }
          confAcc[f].sum += parsed.confidence[f] ?? 0
          confAcc[f].n += 1
          if (parsed[f as keyof typeof parsed] === 'unsure') confAcc[f].unsure += 1
        }

        const evidence: Record<string, unknown> = {}
        for (const f of GOLD_FIELDS) {
          evidence[f] = {
            origin: 'vision', model_version_id: modelVersionId,
            image_urls: t.image_urls, image_count: images.length,
            confidence: parsed.confidence[f] ?? 0,
          }
        }

        // Written per design, not batched — this is what makes a killed run
        // resumable rather than a total loss.
        const { error } = await supabaseAdmin.from('dip_attributes').upsert({
          design_id: t.design_id, model_version_id: modelVersionId, run_id: summary.run_id,
          status: 'extracted', attempts: attempt,
          category: parsed.category, silhouette: parsed.silhouette,
          stone_shape: parsed.stone_shape, setting: parsed.setting,
          image_colour_observed: parsed.image_colour_observed,
          colour_check_status: check,
          evidence, raw_model_output: parsed,
        }, { onConflict: 'design_id,model_version_id' })
        if (error) throw new Error(error.message)

        summary.extracted++
        return
      } catch (err: any) {
        const msg = String(err?.message ?? err)
        failureReason = msg.includes('model_timeout') ? 'model_timeout'
          : /429|quota|rate/i.test(msg) ? 'rate_limit'
          : /JSON|parse/i.test(msg) ? 'parse'
          : 'model_error'
        if (attempt < MAX_ATTEMPTS) {
          // 2s, 4s, 8s. Rate limits get longer.
          await sleep(failureReason === 'rate_limit' ? 15_000 * attempt : 2_000 * Math.pow(2, attempt - 1))
        }
      }
    }

    // A failure is a recorded state. Never an absent row — that would be
    // indistinguishable from "the model looked and found nothing".
    summary.failed++
    await supabaseAdmin.from('dip_attributes').upsert({
      design_id: t.design_id, model_version_id: modelVersionId, run_id: summary.run_id,
      status: 'failed', failure_reason: failureReason, attempts: MAX_ATTEMPTS,
    }, { onConflict: 'design_id,model_version_id' })
  }

  // Bounded concurrency.
  const queue = [...targets]
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const next = queue.shift()
      if (!next) return
      await extractOne(next)
    }
  }))

  summary.est_cost_usd = summary.input_tokens * PRICE_IN + summary.output_tokens * PRICE_OUT
  for (const [f, a] of Object.entries(confAcc)) {
    summary.field_confidence[f] = {
      mean: a.n ? Math.round((a.sum / a.n) * 100) / 100 : 0,
      unsure: a.n ? Math.round((a.unsure / a.n) * 1000) / 10 : 0,
    }
  }

  await supabaseAdmin.from('dip_extraction_runs').update({
    finished_at: new Date().toISOString(),
    status: summary.failed === 0 ? 'success' : summary.extracted > 0 ? 'partial' : 'failed',
    designs_attempted: summary.attempted,
    designs_extracted: summary.extracted,
    designs_failed: summary.failed,
    input_tokens: summary.input_tokens,
    output_tokens: summary.output_tokens,
    est_cost_usd: summary.est_cost_usd,
  }).eq('id', summary.run_id)

  return summary
}
