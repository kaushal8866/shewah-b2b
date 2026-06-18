import { createClient } from '@supabase/supabase-js'
import { KARAT_FACTORS, SELLABLE_KARATS, computeKaratPricing, startsFrom } from './karat'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Used for non-DB features (storage, auth, realtime). DB operations route through /api/db.
const baseClient = createClient(supabaseUrl, supabaseAnonKey)

type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

class QueryBuilder implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private filters: any[] = []
  private orderList: any[] = []
  private limitN: number | undefined
  private rangeFromTo: { from: number; to: number } | undefined
  private selectCols: string | undefined
  private singleRow = false
  private maybeSingleRow = false
  private returning = false
  private headOnly = false
  private countMode: 'exact' | 'planned' | 'estimated' | undefined
  private executed: Promise<any> | null = null

  constructor(
    private table: string,
    private op: Op,
    private values: any = undefined,
    private opts: any = undefined
  ) {}

  // Filters
  eq(col: string, val: any) { this.filters.push({ type: 'eq', col, val }); return this }
  neq(col: string, val: any) { this.filters.push({ type: 'neq', col, val }); return this }
  gt(col: string, val: any) { this.filters.push({ type: 'gt', col, val }); return this }
  gte(col: string, val: any) { this.filters.push({ type: 'gte', col, val }); return this }
  lt(col: string, val: any) { this.filters.push({ type: 'lt', col, val }); return this }
  lte(col: string, val: any) { this.filters.push({ type: 'lte', col, val }); return this }
  in(col: string, val: any[]) { this.filters.push({ type: 'in', col, val }); return this }
  is(col: string, val: any) { this.filters.push({ type: 'is', col, val }); return this }
  like(col: string, val: any) { this.filters.push({ type: 'like', col, val }); return this }
  ilike(col: string, val: any) { this.filters.push({ type: 'ilike', col, val }); return this }
  contains(col: string, val: any) { this.filters.push({ type: 'contains', col, val }); return this }
  containedBy(col: string, val: any) { this.filters.push({ type: 'containedBy', col, val }); return this }
  match(obj: Record<string, any>) { this.filters.push({ type: 'match', col: '__match__', val: obj }); return this }
  or(filters: string) { this.filters.push({ type: 'or', col: '__or__', val: filters }); return this }
  not(col: string, opr: string, val: any) { this.filters.push({ type: 'not', col, opr, val }); return this }

  // Modifiers
  select(cols?: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this.op === 'select') {
      this.selectCols = cols || '*'
    } else {
      this.returning = true
      this.selectCols = cols || '*'
    }
    if (opts?.count) this.countMode = opts.count
    if (opts?.head) this.headOnly = true
    return this
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderList.push({ col, ascending: opts?.ascending !== false, nullsFirst: opts?.nullsFirst })
    return this
  }
  limit(n: number) { this.limitN = n; return this }
  range(from: number, to: number) { this.rangeFromTo = { from, to }; return this }
  single() { this.singleRow = true; return this }
  maybeSingle() { this.maybeSingleRow = true; return this }

  private exec(): Promise<{ data: any; error: any; count?: number | null }> {
    if (this.executed) return this.executed
    this.executed = (async () => {
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            table: this.table,
            op: this.op,
            values: this.values,
            opts: this.opts,
            filters: this.filters,
            select: this.selectCols,
            order: this.orderList,
            limit: this.limitN,
            range: this.rangeFromTo,
            single: this.singleRow,
            maybeSingle: this.maybeSingleRow,
            returning: this.returning,
            head: this.headOnly,
            count: this.countMode,
          }),
        })
        let json: any = null
        try { json = await res.json() } catch { /* non-json */ }
        if (!res.ok) {
          return {
            data: null,
            error: { message: json?.error?.message || `Request failed (${res.status})`, status: res.status },
          }
        }
        return { data: json?.data ?? null, error: json?.error ?? null, count: json?.count ?? null }
      } catch (err: any) {
        return { data: null, error: { message: err?.message || 'Network error' } }
      }
    })()
    return this.executed
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected)
  }
  catch(onrejected: any) { return this.exec().catch(onrejected) }
  finally(onfinally: any) { return this.exec().finally(onfinally) }
}

class TableProxy {
  constructor(private table: string) {}

  select(cols: string = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    const b = new QueryBuilder(this.table, 'select')
    b.select(cols, opts)
    return b
  }
  insert(values: any) { return new QueryBuilder(this.table, 'insert', values) }
  update(values: any) { return new QueryBuilder(this.table, 'update', values) }
  delete() { return new QueryBuilder(this.table, 'delete') }
  upsert(values: any, opts?: any) { return new QueryBuilder(this.table, 'upsert', values, opts) }
}

export const supabase: any = {
  from(table: string) { return new TableProxy(table) },
  storage: baseClient.storage,
  auth: baseClient.auth,
  rpc: baseClient.rpc.bind(baseClient),
  channel: baseClient.channel.bind(baseClient),
  removeChannel: baseClient.removeChannel.bind(baseClient),
  removeAllChannels: baseClient.removeAllChannels.bind(baseClient),
}

// ── Type definitions ──────────────────────────────────────

export type Partner = {
  id: string
  created_at: string
  store_name: string
  owner_name: string
  phone: string
  email?: string
  city: string
  state: string
  circuit?: string
  address?: string
  sarafa_bazaar?: string
  store_type?: string
  annual_revenue?: string
  current_products?: string[]
  model_preference?: string
  status: 'hot' | 'warm' | 'cold'
  stage: 'prospect' | 'contacted' | 'sample_sent' | 'active' | 'inactive'
  source?: string
  notes?: string
  tags?: string[]
}

export type Visit = {
  id: string
  created_at: string
  partner_id: string
  visit_date: string
  circuit?: string
  city?: string
  outcome?: string
  notes?: string
  sample_offered?: boolean
  catalog_left?: boolean
  next_action?: string
  next_action_date?: string
}

export type Product = {
  id: string
  code: string
  name: string
  description?: string
  category: string
  diamond_weight?: number
  diamond_shape?: string
  diamond_quality?: string
  diamond_color?: string
  diamond_type: string
  gold_karat?: number
  gold_weight_g?: number
  // Per-karat gross weights for the same physical piece (Task #71). The
  // 22kt slot is the canonical input; the others derive from it.
  gold_weight_22k?: number
  gold_weight_18k?: number
  gold_weight_14k?: number
  gold_weight_10k?: number
  gold_weight_9k?: number
  // Cached price breakdown per karat — refreshed on every gold-rate save.
  // Shape: { "22": { weight, goldCost, labourCost, cogs, trade, mrp }, ... }
  karat_pricing?: Record<string, { weight: number; goldCost: number; labourCost: number; cogs: number; trade: number; mrp: number }>
  diamond_cost?: number
  making_charges?: number
  igi_cert_cost?: number
  trade_price?: number
  mrp_suggested?: number
  // When the cached karat_pricing/trade_price/mrp_suggested were last
  // recomputed, and at what 24K rate. Refreshed automatically on every
  // new gold_rates row (Task #72).
  priced_at_rate?: number
  priced_at?: string
  photo_urls?: string[]
  is_active: boolean
  delivery_days?: number
  models_available?: string[]
  tags?: string[]
}

export type Order = {
  id: string
  order_number: string
  partner_id?: string
  product_id?: string
  type: 'catalog' | 'custom'
  model: 'wholesale' | 'design_make' | 'white_label'
  quantity: number
  ring_size?: string
  special_notes?: string
  brief_text?: string
  brief_images?: string[]
  cad_request_id?: string
  gold_rate_at_order?: number
  trade_price: number
  total_amount: number
  advance_paid: number
  balance_due?: number
  status: string
  order_date: string
  expected_delivery?: string
  actual_delivery?: string
  tracking_number?: string
  courier?: string
  dispatch_date?: string
  internal_notes?: string
  // COGS / gold ledger
  gold_source?: 'self' | 'manufacturer'
  gold_weight_estimated?: number
  gold_weight_actual?: number
  making_charges?: number
  cad_cost?: number
  stone_cost?: number
  total_cogs?: number
  margin?: number
  assigned_manufacturer_id?: string
}

export type CADRequest = {
  id: string
  request_number: string
  partner_id?: string
  order_id?: string
  brief_text?: string
  reference_images?: string[]
  diamond_shape?: string
  diamond_weight?: string
  gold_karat?: number
  setting_type?: string
  special_requests?: string
  status: string
  priority: 'normal' | 'urgent'
  cad_files?: string[]
  render_images?: string[]
  received_date: string
  due_date?: string
  sent_date?: string
  approved_date?: string
  revision_notes?: string
  partner_feedback?: string
}

export type GoldRate = {
  id: string
  recorded_at: string
  source: string
  rate_24k: number
  rate_22k?: number
  rate_18k?: number
  rate_14k?: number
  rate_10k?: number
  rate_9k?: number
  // Per-karat retail labour ₹/g — used to price catalog SKUs in each karat
  // (Task #71). Distinct from per-partner labour rates introduced in #68.
  retail_labour_22k?: number
  retail_labour_18k?: number
  retail_labour_14k?: number
  retail_labour_10k?: number
  retail_labour_9k?: number
  notes?: string
}

// ── Manufacturing partner type + per-karat labour helper ──────────────────
// Used by both the issue-mfg-order screen and the customer-order COGS path
// (Task #68). Centralised so both sites avoid `any` casts on dynamic
// `labour_rate_{karat}k` field lookups.

export type ManufacturingPartnerLite = {
  id: string
  name: string
  city?: string | null
  phone?: string | null
  email?: string | null
  status?: string | null
  material_policy?: string | null
  min_labour_grams?: number | null
  labour_rate_9k?: number | null
  labour_rate_10k?: number | null
  labour_rate_14k?: number | null
  labour_rate_18k?: number | null
  labour_rate_22k?: number | null
}

export function partnerLabourRate(
  partner: ManufacturingPartnerLite | undefined | null,
  karat: number,
): number {
  if (!partner) return 0
  const k = Number(karat)
  if (k === 9) return Number(partner.labour_rate_9k) || 0
  if (k === 10) return Number(partner.labour_rate_10k) || 0
  if (k === 14) return Number(partner.labour_rate_14k) || 0
  if (k === 18) return Number(partner.labour_rate_18k) || 0
  if (k === 22) return Number(partner.labour_rate_22k) || 0
  return 0
}

export type Circuit = {
  id: string
  created_at: string
  name: string
  region?: string
  cities?: string[]
  start_date?: string
  end_date?: string
  status: 'planned' | 'in_progress' | 'completed'
  target_visits?: number
  target_samples?: number
  target_partners?: number
  actual_visits: number
  actual_samples: number
  actual_partners: number
  budget_inr?: number
  spent_inr: number
  notes?: string
}

// ── Helper functions ──────────────────────────────────────

export function calculateGoldRates(rate24k: number) {
  // Single source of truth — KARAT_FACTORS from lib/karat.ts.
  return {
    rate_24k: rate24k,
    rate_22k: Math.round(rate24k * KARAT_FACTORS[22]),
    rate_18k: Math.round(rate24k * KARAT_FACTORS[18]),
    rate_14k: Math.round(rate24k * KARAT_FACTORS[14]),
  }
}

export function calculateTradePrice(
  diamondCost: number,
  goldKarat: number,
  goldWeightG: number,
  goldRatePerGram: number,
  makingCharges: number,
  igiCost: number,
  marginMultiplier = 1.28
) {
  const mult = (KARAT_FACTORS as Record<number, number>)[goldKarat] || KARAT_FACTORS[18]
  const goldCost = goldWeightG * goldRatePerGram * mult
  const cogs = diamondCost + goldCost + makingCharges + igiCost
  return Math.round(cogs * marginMultiplier)
}

// Compute COGS + margin for an order. Material cost stays invariant in
// 24kt-pure terms (gold_weight × rate × karat purity = pure-24kt mass × rate).
// Labour cost is computed separately — Task #68 wires it from the assigned
// karigar's per-karat rate × gross weight (with a min-charge floor). When the
// partner rate isn't available, the callers can pass a flat `making_charges`
// fallback. Returns the explicit labour breakdown so the UI can render it.
export function computeOrderCogs(opts: {
  gold_weight_actual?: number | null
  gold_rate_at_order?: number | null
  gold_karat?: number | null
  metal_type?: string | null
  // Task #68 inputs — preferred path when an assigned partner exists:
  labour_per_gram?: number | null
  gross_weight?: number | null
  min_labour_grams?: number | null
  // Legacy / manual-override fallback when no partner rate is available:
  making_charges?: number | null
  cad_cost?: number | null
  stone_cost?: number | null
  total_amount?: number | null
  trade_price?: number | null
}) {
  const w = Number(opts.gold_weight_actual) || 0
  const rate = Number(opts.gold_rate_at_order) || 0
  const isSilver = opts.metal_type === 'silver' || String(opts.gold_karat).toLowerCase() === 'silver'
  const goldCost = isSilver
    ? w * rate
    : w * rate * ((KARAT_FACTORS as Record<number, number>)[Number(opts.gold_karat) || 18] ?? KARAT_FACTORS[18])

  const labourPerG = Number(opts.labour_per_gram) || 0
  const grossW = Number(opts.gross_weight ?? opts.gold_weight_actual) || 0
  const minG = Number(opts.min_labour_grams) || 1
  const labourCost = labourPerG > 0
    ? labourPerG * Math.max(grossW, minG)
    : (Number(opts.making_charges) || 0)

  const total_cogs = goldCost
    + labourCost
    + (Number(opts.cad_cost) || 0)
    + (Number(opts.stone_cost) || 0)
  const sellingPrice = Number(opts.total_amount ?? opts.trade_price) || 0
  const margin = sellingPrice - total_cogs
  return { gold_cost: goldCost, labour_cost: labourCost, total_cogs, margin }
}

// Recompute every active product's trade_price (and mrp_suggested) using the
// supplied 24K rate. Same formula as `app/catalog/[id]/page.tsx` (post-#81):
//   netGoldWeight = gold_weight_22k (the raw user input — not karat-purity'd)
//   per-karat 24kt-pure mass = pureMassByKarat(netGoldWeight)[k]
//                            = netGoldWeight × KARAT_FACTORS[k]
//   goldCost[k]  = mass[k] × rate24k             (gold trades at 24K rate)
//   labourCost[k]= retailLabour[k] × max(netGoldWeight, 1g)
//   diamondCost  = sum(diamond_specs[].cost × pieces)  — fallback to diamond_cost
//   cogs[k]      = goldCost[k] + labourCost[k] + diamondCost + making_charges + igi_cert_cost
//   trade_price  = round(cogs[22] × 1.28)        (default karat is 22)
//   mrp_suggested= round(trade_price × 1.40)
//
// Returns { updated, skipped, failed, error } so callers can surface partial
// failures instead of silently reporting success. Designed to be safe to
// re-run; only writes when the new price differs.
export async function recomputeCatalogPrices(rate24k: number): Promise<{
  updated: number; skipped: number; failed: number; pricedAt?: string; error?: string
}> {
  if (!rate24k || rate24k <= 0) return { updated: 0, skipped: 0, failed: 0, error: 'Invalid gold rate' }

  // Pull the current per-karat retail labour from the latest gold_rates row.
  const { data: rateRow } = await supabase
    .from('gold_rates')
    .select('retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
    .order('recorded_at', { ascending: false })
    .limit(1)
  const pricedAt = new Date().toISOString()
  const labour: Record<number, number> = {
    22: Number(rateRow?.[0]?.retail_labour_22k) || 0,
    18: Number(rateRow?.[0]?.retail_labour_18k) || 0,
    14: Number(rateRow?.[0]?.retail_labour_14k) || 0,
    10: Number(rateRow?.[0]?.retail_labour_10k) || 0,
    9:  Number(rateRow?.[0]?.retail_labour_9k)  || 0,
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, gold_karat, gold_weight_g, gold_weight_22k, gold_weight_18k, gold_weight_14k, gold_weight_10k, gold_weight_9k, diamond_cost, diamond_specs, making_charges, igi_cert_cost, trade_price, mrp_suggested, karat_pricing, metal_type')
    .eq('is_active', true)
  if (error) return { updated: 0, skipped: 0, failed: 0, error: error.message }
  if (!products) return { updated: 0, skipped: 0, failed: 0 }

  let updated = 0, skipped = 0, failed = 0
  for (const p of products) {
    if ((p as any).metal_type === 'silver') {
      skipped++
      continue
    }
    // Resolve the single net-gold-weight input for this product. Catalog form
    // saves it into `gold_weight_22k` (numerically the user-entered value).
    // For super-legacy rows that only have gold_weight_g + gold_karat, we
    // approximate by reading gold_weight_g as the net input.
    let netGoldWeight = Number(p.gold_weight_22k) || 0
    if (!netGoldWeight) {
      const legacyW = Number(p.gold_weight_g) || 0
      const legacyK = Number(p.gold_karat) || 22
      if (legacyW > 0 && KARAT_FACTORS[legacyK]) {
        netGoldWeight = legacyW
      } else {
        skipped++
        continue
      }
    }

    let diamondCost = 0
    if (Array.isArray((p as any).diamond_specs) && (p as any).diamond_specs.length > 0) {
      diamondCost = ((p as any).diamond_specs as any[]).reduce(
        (s, d) => s + (Number(d?.cost) || 0) * (Number(d?.pieces) || 1), 0
      )
    } else {
      diamondCost = Number(p.diamond_cost) || 0
    }

    const pricing = computeKaratPricing({
      netGoldWeight,
      rate24k,
      retailLabour: labour,
      diamondCost,
      makingCharges: Number(p.making_charges) || 0,
      igiCost: Number(p.igi_cert_cost) || 0,
    })

    // Stash full breakdown as jsonb for the retailer portal to read directly.
    const karat_pricing: Record<string, any> = {}
    for (const row of pricing) karat_pricing[String(row.karat)] = row

    // Canonical scalar prices represent the 22kt default selection so any
    // legacy code path that reads `trade_price` keeps working.
    const default22 = pricing.find(p => p.karat === 22)
    const newTrade = default22?.trade ?? Math.min(...pricing.map(p => p.trade).filter(t => t > 0)) ?? 0
    const newMrp = default22?.mrp ?? Math.round(newTrade * 1.40)

    const prevPricing = (p as any).karat_pricing || null
    const same = newTrade === Number(p.trade_price)
      && newMrp === Number(p.mrp_suggested)
      && JSON.stringify(prevPricing) === JSON.stringify(karat_pricing)

    // Even when the resulting prices are unchanged we still refresh the
    // priced_at_rate / priced_at stamp so the "Last priced at …" indicator
    // reflects the most recent recompute event, not a stale older one.
    if (same) {
      const { error: stampErr } = await supabase
        .from('products')
        .update({ priced_at_rate: rate24k, priced_at: pricedAt })
        .eq('id', p.id)
      // If the migration hasn't been applied yet, silently treat as skipped.
      if (stampErr && !/priced_at|column .* does not exist/i.test(stampErr.message || '')) {
        failed++
      } else {
        skipped++
      }
      continue
    }

    const { error: upErr } = await supabase
      .from('products')
      .update({
        trade_price: newTrade,
        mrp_suggested: newMrp,
        karat_pricing,
        priced_at_rate: rate24k,
        priced_at: pricedAt,
      })
      .eq('id', p.id)
    if (upErr) {
      // Tolerate missing priced_at_* columns when the migration hasn't been
      // applied yet — fall back to the legacy 3-column update so existing
      // installs keep working until task-72 SQL is run.
      const msg = (upErr as any)?.message || ''
      if (/priced_at|column .* does not exist/i.test(msg)) {
        const { error: legacyErr } = await supabase
          .from('products')
          .update({ trade_price: newTrade, mrp_suggested: newMrp, karat_pricing })
          .eq('id', p.id)
        if (legacyErr) { failed++ } else { updated++ }
      } else {
        failed++
      }
    } else { updated++ }
  }
  return { updated, skipped, failed, pricedAt }
}

/**
 * Convenience: pick the cheapest karat row from a product's `karat_pricing`
 * cache. Used by the retailer catalog list to show "Starts from ₹X (9kt)".
 */
export function startsFromKarat(p: Pick<Product, 'karat_pricing' | 'trade_price'>) {
  const kp = p.karat_pricing
  if (!kp) return p.trade_price ? { karat: 22, trade: p.trade_price } : null
  const rows = Object.values(kp).filter(r => r && r.trade > 0)
  if (rows.length === 0) return null
  return rows.reduce((min, r) => (r.trade < min.trade ? r : min))
}

export const ORDER_STATUSES = [
  { value: 'brief_received',   label: 'Brief Received',   color: 'bg-blue-100 text-blue-800' },
  { value: 'cad_in_progress',  label: 'CAD In Progress',  color: 'bg-yellow-100 text-yellow-800' },
  { value: 'cad_sent',         label: 'CAD Sent',         color: 'bg-purple-100 text-purple-800' },
  { value: 'design_approved',  label: 'Design Approved',  color: 'bg-indigo-100 text-indigo-800' },
  { value: 'production',       label: 'In Production',    color: 'bg-orange-100 text-orange-800' },
  { value: 'qc',               label: 'Quality Check',    color: 'bg-amber-100 text-amber-800' },
  { value: 'dispatched',       label: 'Dispatched',       color: 'bg-teal-100 text-teal-800' },
  { value: 'delivered',        label: 'Delivered',        color: 'bg-green-100 text-green-800' },
]

export const PARTNER_STAGES = [
  { value: 'prospect',     label: 'Prospect',      color: 'bg-gray-100 text-gray-700' },
  { value: 'contacted',    label: 'Contacted',      color: 'bg-blue-100 text-blue-800' },
  { value: 'sample_sent',  label: 'Sample Sent',    color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active',       label: 'Active Partner', color: 'bg-green-100 text-green-800' },
  { value: 'inactive',     label: 'Inactive',       color: 'bg-red-100 text-red-700' },
]
