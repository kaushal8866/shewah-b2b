'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Layers, ExternalLink, Link2, X, Search } from 'lucide-react'

const PRESETS = [
  { key: '30',  label: 'Last 30 days' },
  { key: '90',  label: 'Last 90 days' },
  { key: '180', label: 'Last 6 months' },
  { key: '365', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
]

function startDateFor(preset: string): string | null {
  if (preset === 'all') return null
  const days = parseInt(preset, 10)
  if (!days || isNaN(days)) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function fmtG(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return `${Number(v).toFixed(3)}g`
}

export default function ReconciliationPage() {
  const params = useParams()
  const partnerId = params.id as string

  const [partner, setPartner] = useState<any>(null)
  const [preset, setPreset] = useState('90')
  const [transactions, setTransactions] = useState<any[]>([])
  const [orders, setOrders] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  // Attach-order modal state
  const [attachingTx, setAttachingTx] = useState<any>(null)
  const [partnerOrders, setPartnerOrders] = useState<any[] | null>(null)
  const [partnerOrdersLoading, setPartnerOrdersLoading] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [attachSavingId, setAttachSavingId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('manufacturing_partners').select('id,name,city').eq('id', partnerId).single()
      .then(({ data }: { data: any }) => setPartner(data))
  }, [partnerId])

  useEffect(() => { load() }, [partnerId, preset])

  // Reset attach-modal cache if the partner changes (avoid stale cross-partner orders)
  useEffect(() => {
    setPartnerOrders(null)
    setAttachingTx(null)
    setOrderSearch('')
  }, [partnerId])

  async function load() {
    setLoading(true)
    const since = startDateFor(preset)

    let q = supabase.from('material_transactions')
      .select('id, transaction_type, quantity, unit, date, order_id, creates_negative_balance, notes, reference, material_float(material_type)')
      .eq('manufacturing_partner_id', partnerId)
      .eq('transaction_type', 'consumption')
      .order('date', { ascending: false })

    if (since) q = q.gte('date', since)

    const { data: txs } = await q
    const list = txs || []

    // Resolve order details for any linked orders
    const orderIds = Array.from(new Set(list.map((t: any) => t.order_id).filter(Boolean)))
    let orderMap: Record<string, any> = {}
    if (orderIds.length) {
      const { data: ords } = await supabase.from('orders')
        .select('id, order_number, gold_weight_estimated, gold_weight_actual, gold_karat, status')
        .in('id', orderIds)
      orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]))
    }

    setTransactions(list)
    setOrders(orderMap)
    setLoading(false)
  }

  // Per-order rollup (only rows that have an order_id)
  const perOrder = useMemo(() => {
    const groups: Record<string, { order: any, consumed: number, count: number, anyNegative: boolean }> = {}
    for (const t of transactions) {
      if (!t.order_id) continue
      const g = groups[t.order_id] ||= { order: orders[t.order_id], consumed: 0, count: 0, anyNegative: false }
      g.consumed += Number(t.quantity) || 0
      g.count += 1
      if (t.creates_negative_balance) g.anyNegative = true
    }
    return Object.entries(groups).map(([orderId, g]) => {
      const est = g.order?.gold_weight_estimated != null ? Number(g.order.gold_weight_estimated) : null
      const act = g.order?.gold_weight_actual != null ? Number(g.order.gold_weight_actual) : null
      const benchmark = act ?? est
      const variance = benchmark != null ? g.consumed - benchmark : null
      return { orderId, ...g, estimated: est, actual: act, variance }
    }).sort((a, b) => Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0))
  }, [transactions, orders])

  const unlinked = useMemo(() => transactions.filter(t => !t.order_id), [transactions])
  const negativeFlagged = useMemo(() => transactions.filter(t => t.creates_negative_balance), [transactions])

  const agg = useMemo(() => {
    let estTotal = 0, actTotal = 0, consumedTotal = 0, varianceTotal = 0
    let withBenchmark = 0
    for (const r of perOrder) {
      consumedTotal += r.consumed
      if (r.estimated != null) estTotal += r.estimated
      if (r.actual != null) actTotal += r.actual
      if (r.variance != null) { varianceTotal += r.variance; withBenchmark++ }
    }
    const unlinkedConsumed = unlinked.reduce((s, t) => s + (Number(t.quantity) || 0), 0)
    return { estTotal, actTotal, consumedTotal, varianceTotal, withBenchmark, unlinkedConsumed }
  }, [perOrder, unlinked])

  async function openAttachModal(tx: any) {
    setAttachingTx(tx)
    setOrderSearch('')
    if (partnerOrders !== null) return
    setPartnerOrdersLoading(true)
    // Orders this partner is working on, via manufacturing_orders link
    const { data: mfgRows } = await supabase
      .from('manufacturing_orders')
      .select('customer_order_id')
      .eq('manufacturing_partner_id', partnerId)
      .not('customer_order_id', 'is', null)
    const idsFromMfg = (mfgRows || []).map((r: any) => r.customer_order_id).filter(Boolean)
    // Plus orders that already have transactions for this partner
    const idsFromTx = Object.keys(orders)
    const allIds = Array.from(new Set([...idsFromMfg, ...idsFromTx]))
    if (allIds.length === 0) {
      setPartnerOrders([])
      setPartnerOrdersLoading(false)
      return
    }
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, gold_karat, gold_weight_estimated, gold_weight_actual, order_date')
      .in('id', allIds)
      .order('order_date', { ascending: false })
    setPartnerOrders(data || [])
    setPartnerOrdersLoading(false)
  }

  function closeAttachModal() {
    setAttachingTx(null)
    setOrderSearch('')
  }

  async function attachOrderToTx(orderId: string) {
    if (!attachingTx) return
    setAttachSavingId(orderId)
    const { error } = await supabase
      .from('material_transactions')
      .update({ order_id: orderId })
      .eq('id', attachingTx.id)
      .eq('manufacturing_partner_id', partnerId)
    setAttachSavingId(null)
    if (error) { alert('Could not attach order: ' + error.message); return }
    closeAttachModal()
    load()
  }

  const filteredPartnerOrders = useMemo(() => {
    if (!partnerOrders) return []
    const q = orderSearch.trim().toLowerCase()
    if (!q) return partnerOrders
    return partnerOrders.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.status || '').toLowerCase().includes(q)
    )
  }, [partnerOrders, orderSearch])

  function VarianceCell({ v }: { v: number | null }) {
    if (v == null) return <span className="text-stone-400">—</span>
    if (Math.abs(v) < 0.001) return (
      <span className="inline-flex items-center gap-1 text-stone-500"><Minus className="w-3.5 h-3.5" />0.000g</span>
    )
    if (v > 0) return (
      <span className="inline-flex items-center gap-1 text-red-600 font-medium">
        <ArrowUpRight className="w-3.5 h-3.5" />+{v.toFixed(3)}g
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
        <ArrowDownRight className="w-3.5 h-3.5" />{v.toFixed(3)}g
      </span>
    )
  }

  return (
    <div className="p-4 lg:p-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/manufacturing/partners/${partnerId}`} className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">Gold reconciliation</h1>
          <p className="text-stone-500 text-sm truncate">{partner?.name || '—'}{partner?.city ? ` · ${partner.city}` : ''}</p>
        </div>
        <Link href={`/manufacturing/partners/${partnerId}/float`}
          className="hidden sm:flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
          <Layers className="w-4 h-4" /> Float
        </Link>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-xl border border-stone-200 p-3 mb-5 flex flex-wrap gap-1">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key ? 'bg-[#1E3A5F] text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Aggregate cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Consumed (this period)</p>
          <p className="text-2xl font-semibold text-stone-900 mt-1">{agg.consumedTotal.toFixed(3)}g</p>
          <p className="text-xs text-stone-400 mt-1">{perOrder.length} order{perOrder.length === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Order benchmark (actual·est)</p>
          <p className="text-2xl font-semibold text-stone-900 mt-1">{(agg.actTotal + Math.max(0, agg.estTotal - agg.actTotal)).toFixed(3)}g</p>
          <p className="text-xs text-stone-400 mt-1">actual {agg.actTotal.toFixed(3)}g · est {agg.estTotal.toFixed(3)}g</p>
        </div>
        <div className={`rounded-xl border p-4 ${agg.varianceTotal > 0.001 ? 'border-red-200 bg-red-50' : agg.varianceTotal < -0.001 ? 'border-emerald-200 bg-emerald-50' : 'bg-white border-stone-200'}`}>
          <p className="text-xs text-stone-500">Net variance</p>
          <p className={`text-2xl font-semibold mt-1 ${agg.varianceTotal > 0.001 ? 'text-red-700' : agg.varianceTotal < -0.001 ? 'text-emerald-700' : 'text-stone-900'}`}>
            {agg.varianceTotal > 0 ? '+' : ''}{agg.varianceTotal.toFixed(3)}g
          </p>
          <p className="text-xs text-stone-500 mt-1">consumed − benchmark, {agg.withBenchmark} order{agg.withBenchmark === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-xl border p-4 ${(unlinked.length + negativeFlagged.length) > 0 ? 'border-amber-200 bg-amber-50' : 'bg-white border-stone-200'}`}>
          <p className="text-xs text-stone-500">Audit flags</p>
          <p className={`text-2xl font-semibold mt-1 ${(unlinked.length + negativeFlagged.length) > 0 ? 'text-amber-700' : 'text-stone-900'}`}>
            {unlinked.length + negativeFlagged.length}
          </p>
          <p className="text-xs text-stone-500 mt-1">{unlinked.length} unlinked · {negativeFlagged.length} negative</p>
        </div>
      </div>

      {/* Per-order table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-medium text-stone-900 text-sm">Per-order reconciliation</h2>
          <span className="text-xs text-stone-400">{perOrder.length} order{perOrder.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-stone-400 text-center">Loading…</p>
        ) : perOrder.length === 0 ? (
          <p className="px-4 py-8 text-sm text-stone-400 text-center">No order-linked consumption in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Order</th>
                  <th className="text-right px-4 py-2 font-medium">Estimated</th>
                  <th className="text-right px-4 py-2 font-medium">Actual</th>
                  <th className="text-right px-4 py-2 font-medium">Consumed</th>
                  <th className="text-right px-4 py-2 font-medium">Variance</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {perOrder.map(r => (
                  <tr key={r.orderId} className={r.anyNegative ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/orders/${r.orderId}`} className="text-[#1E3A5F] hover:underline font-medium">
                          {r.order?.order_number || r.orderId.slice(0, 8)}
                        </Link>
                        {r.anyNegative && (
                          <span title="At least one consumption row pushed balance negative"
                            className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase font-medium">neg</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {r.order?.gold_karat ? `${r.order.gold_karat}K` : '—'}
                        {r.order?.status ? ` · ${r.order.status.replace(/_/g, ' ')}` : ''}
                        {' · '}{r.count} txn{r.count === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-700">{fmtG(r.estimated)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-700">{fmtG(r.actual)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-900 font-medium">{r.consumed.toFixed(3)}g</td>
                    <td className="px-4 py-2.5 text-right"><VarianceCell v={r.variance} /></td>
                    <td className="px-2 py-2.5">
                      <Link href={`/orders/${r.orderId}`} className="text-stone-300 hover:text-stone-600">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit flags */}
      {(unlinked.length > 0 || negativeFlagged.length > 0) && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-medium text-amber-900 text-sm">Audit flags</h2>
            <span className="text-xs text-amber-700">{unlinked.length + negativeFlagged.length} row{unlinked.length + negativeFlagged.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-stone-50">
            {[...negativeFlagged, ...unlinked.filter(u => !negativeFlagged.find(n => n.id === u.id))].map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-800">
                      {t.material_float?.material_type?.replace(/_/g, ' ') || 'consumption'}
                    </span>
                    {t.creates_negative_balance && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase font-medium">negative balance</span>
                    )}
                    {!t.order_id && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full uppercase font-medium">no order link</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 truncate mt-0.5">
                    {formatDate(t.date)}
                    {t.order_id && orders[t.order_id] && (
                      <> · <Link href={`/orders/${t.order_id}`} className="text-[#1E3A5F] hover:underline">{orders[t.order_id].order_number}</Link></>
                    )}
                    {t.reference && ` · ${t.reference}`}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-semibold text-red-500">-{Number(t.quantity).toFixed(3)}{t.unit === 'carats' ? 'ct' : 'g'}</p>
                  {!t.order_id && (
                    <button
                      onClick={() => openAttachModal(t)}
                      className="inline-flex items-center gap-1 text-xs text-[#1E3A5F] border border-stone-200 hover:border-[#1E3A5F] hover:bg-stone-50 rounded-lg px-2 py-1 font-medium"
                    >
                      <Link2 className="w-3 h-3" /> Attach order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachingTx && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
             onClick={closeAttachModal}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
               onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-900 text-sm">Attach to order</h3>
                <p className="text-xs text-stone-500 truncate">
                  {attachingTx.material_float?.material_type?.replace(/_/g, ' ') || 'consumption'}
                  {' · '}-{Number(attachingTx.quantity).toFixed(3)}{attachingTx.unit === 'carats' ? 'ct' : 'g'}
                  {' · '}{formatDate(attachingTx.date)}
                </p>
              </div>
              <button onClick={closeAttachModal} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-stone-100">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Search order # or status…"
                  className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {partnerOrdersLoading ? (
                <p className="px-4 py-8 text-sm text-stone-400 text-center">Loading orders…</p>
              ) : filteredPartnerOrders.length === 0 ? (
                <p className="px-4 py-8 text-sm text-stone-400 text-center">
                  {partnerOrders && partnerOrders.length === 0
                    ? 'No orders are assigned to this partner yet.'
                    : 'No orders match that search.'}
                </p>
              ) : (
                <ul className="divide-y divide-stone-50">
                  {filteredPartnerOrders.map(o => {
                    const benchmark = o.gold_weight_actual ?? o.gold_weight_estimated
                    const isSaving = attachSavingId === o.id
                    return (
                      <li key={o.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">{o.order_number}</p>
                          <p className="text-xs text-stone-500 truncate">
                            {o.gold_karat ? `${o.gold_karat}K` : '—'}
                            {benchmark != null ? ` · benchmark ${Number(benchmark).toFixed(3)}g` : ''}
                            {o.status ? ` · ${o.status.replace(/_/g, ' ')}` : ''}
                            {o.order_date ? ` · ${formatDate(o.order_date)}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => attachOrderToTx(o.id)}
                          disabled={isSaving || attachSavingId !== null}
                          className="text-xs bg-[#1E3A5F] text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-50 hover:bg-[#172d49]"
                        >
                          {isSaving ? 'Attaching…' : 'Attach'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
