import { supabaseAdmin } from './supabaseAdmin'
import { istDayStart, istDayEnd } from './period'
import { fetchAllRows } from './fetchAll'

// ── Revenue recognition ────────────────────────────────────────────────────
// These sets are the P&L's definition of "earned". They are named constants
// rather than inline arrays because changing them changes reported profit.
//
// Previously the reseller set included `payment_pending` and the pre-payment
// CAD stages — while app/api/cron/cleanup-unpaid-orders auto-cancels
// payment_pending orders past their deadline. The P&L was therefore booking
// revenue on orders the system was about to cancel.

/** Formal orders count once they enter production and money is committed. */
export const RECOGNISED_ORDER_STATUSES = [
  'production', 'qc', 'dispatched', 'delivered',
] as const

/** Reseller orders count only once payment is confirmed. */
export const RECOGNISED_RESELLER_STATUSES = [
  'confirmed', 'production', 'qc', 'dispatched', 'delivered',
] as const

/** Cash categories treated as realised sales revenue. */
export const CASH_SALE_CATEGORIES = [
  'jewelry_cash_sale', 'jewelry_upi_sale', 'gold_sale', 'ready_to_ship_sale',
] as const

/**
 * Money received against an order rather than earned in the period. Excluded
 * from revenue so it is not double counted against the order itself.
 */
export const ADVANCE_CATEGORIES = ['order_advance', 'balance_collection'] as const

export interface PnLPeriod {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

export interface PnLStatement {
  period: PnLPeriod

  // ─── REVENUE ───────────────────────────────────────
  formal_order_revenue: number        // sum(orders.total_amount) for RECOGNISED_ORDER_STATUSES
  reseller_order_revenue: number      // sum(reseller_orders.reseller_cost_paise / 100) for RECOGNISED_RESELLER_STATUSES
  cash_sales_income: number           // cash_transactions income in CASH_SALE_CATEGORIES
  advance_income: number              // received against orders — reported, NOT in gross_revenue
  other_income: number                // commissions, recoveries, etc.
  gross_revenue: number               // formal + reseller + cash_sales + other_income (NOT advances)

  // ─── DIRECT COSTS (COGS) ───────────────────────────
  formal_order_cogs: number           // sum(orders.total_cogs) for same orders
  lot_based_order_cogs: number        // sum(orders.lot_based_cogs) for same orders (fallback to total_cogs if null)
  cogs_variance: number               // lot_based_order_cogs - formal_order_cogs
  cash_raw_material: number           // gold, diamond, silver, findings purchases
  cash_manufacturing: number          // karigar labour, CAD, casting, polishing
  cash_certification: number          // IGI, BIS, etc.
  cash_packaging_logistics: number    // box, courier, insurance
  karigar_material_returns: number    // (negative COGS — deducted)
  total_cogs: number                  // lot_based_order_cogs + all cash COGS - returns

  // ─── GROSS PROFIT ──────────────────────────────────
  gross_profit: number                // gross_revenue - total_cogs
  gross_margin_pct: number            // (gross_profit / gross_revenue) × 100

  // ─── GOLD REPLACEMENT VARIANCE ─────────────────────
  gold_replacement_variance: number   // sum(replenishment_offsets.delta) for period

  // ─── ADJUSTED GROSS PROFIT ─────────────────────────
  adjusted_gross_profit: number       // gross_profit - gold_replacement_variance
  adjusted_gross_margin_pct: number   // (adjusted_gross_profit / gross_revenue) × 100

  // ─── OPERATING EXPENSES (OPEX) ─────────────────────
  opex_by_group: Record<string, number>  // { office: X, staff: Y, travel: Z, ... }
  total_opex: number

  // ─── NET PROFIT ────────────────────────────────────
  net_profit: number                  // adjusted_gross_profit - total_opex
  net_margin_pct: number              // (net_profit / gross_revenue) × 100

  // ─── TRANSACTION COUNTS (for audit reference) ──────
  total_cash_txns: number
  voided_count: number
}

export async function computePnL(period: PnLPeriod): Promise<PnLStatement> {
  // 1. Fetch formal order revenue and COGS (including lot_based_cogs)
  const orderData = await fetchAllRows<any>('pnl.orders', (from, to) =>
    supabaseAdmin
      .from('orders')
      .select('total_amount, total_cogs, lot_based_cogs')
      .gte('order_date', period.from)
      .lte('order_date', period.to)
      .in('status', RECOGNISED_ORDER_STATUSES as unknown as string[])
      .not('total_amount', 'is', null)
      .range(from, to))

  const formal_order_revenue = sum(orderData, 'total_amount')
  const formal_order_cogs    = sum(orderData, 'total_cogs')

  // Sum lot_based_cogs, falling back to total_cogs if null (e.g. for historic uncosted orders)
  const lot_based_order_cogs = orderData
    ? orderData.reduce((acc, row) => acc + Number(row.lot_based_cogs ?? row.total_cogs ?? 0), 0)
    : 0

  const cogs_variance = lot_based_order_cogs - formal_order_cogs

  // Fetch reseller order revenue (sum of reseller_cost_paise / 100 where status is confirmed/dispatched/delivered)
  // IST day boundaries. `created_at` is a timestamptz, so filtering on
  // `${to}T23:59:59Z` actually ran the window to 05:29 the next morning IST.
  const resellerOrderData = await fetchAllRows<any>('pnl.resellerOrders', (from, to) =>
    supabaseAdmin
      .from('reseller_orders')
      .select('reseller_cost_paise')
      .gte('created_at', istDayStart(period.from))
      .lte('created_at', istDayEnd(period.to))
      .in('status', RECOGNISED_RESELLER_STATUSES as unknown as string[])
      .not('reseller_cost_paise', 'is', null)
      .range(from, to))

  const reseller_order_revenue = resellerOrderData
    ? resellerOrderData.reduce((acc, row) => acc + (Number(row.reseller_cost_paise ?? 0) / 100), 0)
    : 0

  // 2. Fetch all non-voided cash transactions in period
  const txns = await fetchAllRows<any>('pnl.cashTxns', (from, to) =>
    supabaseAdmin
      .from('cash_transactions')
      .select('txn_type, category_group, category, amount, is_cogs')
      .gte('txn_date', period.from)
      .lte('txn_date', period.to)
      .eq('is_void', false)
      .range(from, to))

  // 3. Split and sum
  const incomes  = txns?.filter(t => t.txn_type === 'income')  ?? []
  const expenses = txns?.filter(t => t.txn_type === 'expense') ?? []

  const isCashSale  = (t: any) => (CASH_SALE_CATEGORIES as readonly string[]).includes(t.category)
  const isAdvance   = (t: any) => (ADVANCE_CATEGORIES  as readonly string[]).includes(t.category)

  const cash_sales_income = sumWhere(incomes, isCashSale)
  // Collected against an order, not earned in this period. Reported for cash
  // visibility but deliberately excluded from gross_revenue — the order itself
  // is already recognised above, so counting both would double count it.
  const advance_income = sumWhere(incomes, isAdvance)
  const karigar_material_returns = sumWhere(incomes, t => t.is_cogs === true)
  const other_income = sumWhere(incomes, t => !isCashSale(t) && !isAdvance(t) && !t.is_cogs)

  const gross_revenue = formal_order_revenue + reseller_order_revenue + cash_sales_income + other_income

  // COGS from cash
  const cogsExpenses = expenses.filter(t => t.is_cogs)
  const cash_raw_material        = sumWhere(cogsExpenses, t => t.category_group === 'raw_material')
  const cash_manufacturing       = sumWhere(cogsExpenses, t => t.category_group === 'manufacturing')
  const cash_certification       = sumWhere(cogsExpenses, t => t.category_group === 'certification')
  const cash_packaging_logistics = sumWhere(cogsExpenses, t =>
    ['packaging','logistics'].includes(t.category_group)
  )

  // Use lot_based_order_cogs instead of formal_order_cogs
  const total_cogs = lot_based_order_cogs
    + cash_raw_material + cash_manufacturing
    + cash_certification + cash_packaging_logistics
    - karigar_material_returns  // returns reduce COGS

  const gross_profit     = gross_revenue - total_cogs
  const gross_margin_pct = gross_revenue > 0
    ? parseFloat(((gross_profit / gross_revenue) * 100).toFixed(2))
    : 0

  // 4. Fetch Gold Replacement Variance (sum(replenishment_offsets.delta))
  const offsets = await fetchAllRows<any>('pnl.offsets', (from, to) =>
    supabaseAdmin
      .from('replenishment_offsets')
      .select('delta')
      .gte('offset_date', period.from)
      .lte('offset_date', period.to)
      .range(from, to))

  const gold_replacement_variance = offsets?.reduce((acc, row) => acc + Number(row.delta ?? 0), 0) ?? 0

  const adjusted_gross_profit = gross_profit - gold_replacement_variance
  const adjusted_gross_margin_pct = gross_revenue > 0
    ? parseFloat(((adjusted_gross_profit / gross_revenue) * 100).toFixed(2))
    : 0

  // OPEX from cash
  const opexExpenses = expenses.filter(t => !t.is_cogs)
  const opex_by_group: Record<string, number> = {}
  for (const txn of opexExpenses) {
    opex_by_group[txn.category_group] = (opex_by_group[txn.category_group] ?? 0) + Number(txn.amount)
  }
  const total_opex = Object.values(opex_by_group).reduce((a, b) => a + b, 0)

  // Net Profit is calculated on top of Adjusted Gross Profit
  const net_profit     = adjusted_gross_profit - total_opex
  const net_margin_pct = gross_revenue > 0
    ? parseFloat(((net_profit / gross_revenue) * 100).toFixed(2))
    : 0

  // Audit counts
  const { count: total_cash_txns } = await supabaseAdmin
    .from('cash_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('txn_date', period.from)
    .lte('txn_date', period.to)

  const { count: voided_count } = await supabaseAdmin
    .from('cash_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('txn_date', period.from)
    .lte('txn_date', period.to)
    .eq('is_void', true)

  return {
    period,
    formal_order_revenue, reseller_order_revenue, cash_sales_income, advance_income, other_income, gross_revenue,
    formal_order_cogs, lot_based_order_cogs, cogs_variance,
    cash_raw_material, cash_manufacturing, cash_certification,
    cash_packaging_logistics, karigar_material_returns, total_cogs,
    gross_profit, gross_margin_pct,
    gold_replacement_variance,
    adjusted_gross_profit, adjusted_gross_margin_pct,
    opex_by_group, total_opex,
    net_profit, net_margin_pct,
    total_cash_txns: total_cash_txns ?? 0,
    voided_count: voided_count ?? 0,
  }
}

function sum(arr: any[] | null, key: string): number {
  return (arr ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0)
}
function sumWhere(arr: any[], predicate: (t: any) => boolean): number {
  return arr.filter(predicate).reduce((acc, t) => acc + Number(t.amount), 0)
}
