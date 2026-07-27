import { supabaseAdmin } from './supabaseAdmin'

export interface PnLPeriod {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

export interface PnLStatement {
  period: PnLPeriod

  // ─── REVENUE ───────────────────────────────────────
  formal_order_revenue: number        // sum(orders.total_amount) for completed/dispatched/delivered
  reseller_order_revenue: number      // sum(reseller_orders.reseller_cost_paise / 100) for confirmed/dispatched/delivered
  cash_sales_income: number           // cash_transactions income where is_cogs = false and group = 'sales'
  advance_income: number              // advances received (tracked separately — not real revenue yet)
  other_income: number                // commissions, recoveries, etc.
  gross_revenue: number               // formal + cash_sales + other_income (NOT advances)

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
  const { data: orderData } = await supabaseAdmin
    .from('orders')
    .select('total_amount, total_cogs, lot_based_cogs')
    .gte('order_date', period.from)
    .lte('order_date', period.to)
    .in('status', ['production', 'qc', 'dispatched', 'delivered'])  // exclude cancelled/brief_received
    .not('total_amount', 'is', null)

  const formal_order_revenue = sum(orderData, 'total_amount')
  const formal_order_cogs    = sum(orderData, 'total_cogs')

  // Sum lot_based_cogs, falling back to total_cogs if null (e.g. for historic uncosted orders)
  const lot_based_order_cogs = orderData
    ? orderData.reduce((acc, row) => acc + Number(row.lot_based_cogs ?? row.total_cogs ?? 0), 0)
    : 0

  const cogs_variance = lot_based_order_cogs - formal_order_cogs

  // Fetch reseller order revenue (sum of reseller_cost_paise / 100 where status is confirmed/dispatched/delivered)
  const { data: resellerOrderData } = await supabaseAdmin
    .from('reseller_orders')
    .select('reseller_cost_paise')
    .gte('created_at', period.from + 'T00:00:00Z')
    .lte('created_at', period.to + 'T23:59:59Z')
    .in('status', [
      'confirmed', 'dispatched', 'delivered', 'payment_pending', 'brief_received',
      'cad_in_progress', 'cad_sent', 'design_approved', 'production', 'qc'
    ])
    .not('reseller_cost_paise', 'is', null)

  const reseller_order_revenue = resellerOrderData
    ? resellerOrderData.reduce((acc, row) => acc + (Number(row.reseller_cost_paise ?? 0) / 100), 0)
    : 0

  // 2. Fetch all non-voided cash transactions in period
  const { data: txns } = await supabaseAdmin
    .from('cash_transactions')
    .select('txn_type, category_group, category, amount, is_cogs')
    .gte('txn_date', period.from)
    .lte('txn_date', period.to)
    .eq('is_void', false)

  // 3. Split and sum
  const incomes  = txns?.filter(t => t.txn_type === 'income')  ?? []
  const expenses = txns?.filter(t => t.txn_type === 'expense') ?? []

  const cash_sales_income = sumWhere(incomes, t =>
    ['jewelry_cash_sale','jewelry_upi_sale','gold_sale','ready_to_ship_sale'].includes(t.category)
  )
  const advance_income = sumWhere(incomes, t =>
    ['order_advance','balance_collection'].includes(t.category)
  )
  const karigar_material_returns = sumWhere(incomes, t => t.is_cogs === true)
  const other_income = sumWhere(incomes, t =>
    !['jewelry_cash_sale','jewelry_upi_sale','gold_sale','ready_to_ship_sale',
      'order_advance','balance_collection'].includes(t.category) && !t.is_cogs
  )

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
  const { data: offsets } = await supabaseAdmin
    .from('replenishment_offsets')
    .select('delta')
    .gte('offset_date', period.from)
    .lte('offset_date', period.to)

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
