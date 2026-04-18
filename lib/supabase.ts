import { createClient } from '@supabase/supabase-js'

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
  diamond_cost?: number
  making_charges?: number
  igi_cert_cost?: number
  trade_price?: number
  mrp_suggested?: number
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
  notes?: string
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
  return {
    rate_24k: rate24k,
    rate_22k: Math.round(rate24k * 0.916),
    rate_18k: Math.round(rate24k * 0.750),
    rate_14k: Math.round(rate24k * 0.585),
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
  const karatMultipliers: Record<number, number> = { 24: 1, 22: 0.916, 18: 0.750, 14: 0.585 }
  const goldCost = goldWeightG * goldRatePerGram * (karatMultipliers[goldKarat] || 0.75)
  const cogs = diamondCost + goldCost + makingCharges + igiCost
  return Math.round(cogs * marginMultiplier)
}

// Compute COGS + margin for an order using actual gold weight, gold-rate at order,
// karat purity, making charges, CAD cost and stone cost. Returns 0 when actuals
// are missing.
export function computeOrderCogs(opts: {
  gold_weight_actual?: number | null
  gold_rate_at_order?: number | null
  gold_karat?: number | null
  making_charges?: number | null
  cad_cost?: number | null
  stone_cost?: number | null
  total_amount?: number | null
  trade_price?: number | null
}) {
  const karatMultipliers: Record<number, number> = { 24: 1, 22: 0.916, 18: 0.750, 14: 0.585, 10: 0.417, 9: 0.375 }
  const w = Number(opts.gold_weight_actual) || 0
  const rate = Number(opts.gold_rate_at_order) || 0
  const karat = Number(opts.gold_karat) || 18
  const mult = karatMultipliers[karat] ?? 0.75
  const goldCost = w * rate * mult
  const total_cogs = goldCost
    + (Number(opts.making_charges) || 0)
    + (Number(opts.cad_cost) || 0)
    + (Number(opts.stone_cost) || 0)
  const sellingPrice = Number(opts.total_amount ?? opts.trade_price) || 0
  const margin = sellingPrice - total_cogs
  return { gold_cost: goldCost, total_cogs, margin }
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
