'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, IndianRupee, Percent, Package, Users, ShoppingBag, ChevronRight, Download } from 'lucide-react'

// CSV-injection hardening: prefix a single-quote when a cell starts with a
// formula-trigger character so spreadsheets render it as text.
function csvSafe(v: any): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

type OrderRow = {
  id: string
  order_number: string
  order_date: string
  status: string
  type: string
  model: string
  quantity: number
  total_amount: number | null
  total_cogs: number | null
  margin: number | null
  partner_id: string | null
  product_id: string | null
  partner: { store_name: string; city: string | null } | null
  product: { code: string; name: string; category: string | null } | null
}

type Range = '30' | '90' | '180' | '365' | 'all'

const RANGE_OPTIONS: { id: Range; label: string }[] = [
  { id: '30',  label: 'Last 30 days' },
  { id: '90',  label: 'Last 90 days' },
  { id: '180', label: 'Last 6 months' },
  { id: '365', label: 'Last year' },
  { id: 'all', label: 'All time' },
]

function fmtPct(num: number, den: number) {
  if (!den) return '—'
  return `${(num / den * 100).toFixed(1)}%`
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export default function ProfitabilityPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range>('90')
  const [statusFilter, setStatusFilter] = useState<'realised' | 'all'>('realised')

  // Defensive client-side guard in case middleware config drifts. Master sees
  // everything; sub users need the 'profitability' module permission.
  const role = session?.user?.role
  const perms = (session?.user?.permissions as string[] | undefined) || []
  const allowed = role === 'master' || perms.includes('profitability')

  useEffect(() => {
    if (status === 'authenticated' && !allowed) {
      router.replace('/')
    }
  }, [status, allowed, router])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function load() {
      setOrders(null)
      setError('')
      let q = supabase
        .from('orders')
        .select(`
          id, order_number, order_date, status, type, model, quantity,
          total_amount, total_cogs, margin, partner_id, product_id,
          partner:partners ( store_name, city ),
          product:products ( code, name, category )
        `)
        .order('order_date', { ascending: false })

      if (range !== 'all') {
        const since = new Date()
        since.setDate(since.getDate() - parseInt(range))
        q = q.gte('order_date', since.toISOString().slice(0, 10))
      }
      const { data, error } = await q
      if (cancelled) return
      if (error) { setError(error.message); return }
      setOrders((data as any) || [])
    }
    load()
    return () => { cancelled = true }
  }, [range, allowed])

  const filtered = useMemo(() => {
    if (!orders) return []
    if (statusFilter === 'all') return orders.filter(o => o.status !== 'cancelled')
    // "Realised" = order is past production: dispatched / delivered. Admin sees
    // a more honest margin view since CADs in early stages have provisional
    // numbers.
    return orders.filter(o => ['dispatched', 'delivered'].includes(o.status))
  }, [orders, statusFilter])

  const totals = useMemo(() => {
    let revenue = 0, cogs = 0, margin = 0, withMargin = 0
    filtered.forEach(o => {
      revenue += o.total_amount || 0
      cogs    += o.total_cogs || 0
      margin  += o.margin || 0
      if ((o.margin || 0) !== 0 || (o.total_cogs || 0) !== 0) withMargin++
    })
    return { revenue, cogs, margin, count: filtered.length, withMargin }
  }, [filtered])

  const byMonth = useMemo(() => {
    const months: { key: string; label: string; revenue: number; margin: number }[] = []
    const map: Record<string, { label: string; revenue: number; margin: number }> = {}
    const monthsBack = range === 'all' ? 12 : Math.min(12, Math.ceil(parseInt(range) / 30))
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map[key] = { label: fmtMonth(d), revenue: 0, margin: 0 }
      months.push({ key, label: fmtMonth(d), revenue: 0, margin: 0 })
    }
    filtered.forEach(o => {
      const d = new Date(o.order_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (map[key]) {
        map[key].revenue += o.total_amount || 0
        map[key].margin  += o.margin || 0
      }
    })
    return months.map(m => ({ ...m, ...map[m.key] }))
  }, [filtered, range])

  const byPartner = useMemo(() => {
    const m = new Map<string, { id: string; name: string; city: string; orders: number; revenue: number; cogs: number; margin: number }>()
    filtered.forEach(o => {
      if (!o.partner_id) return
      const key = o.partner_id
      const row = m.get(key) || {
        id: key,
        name: o.partner?.store_name || '—',
        city: o.partner?.city || '',
        orders: 0, revenue: 0, cogs: 0, margin: 0,
      }
      row.orders += 1
      row.revenue += o.total_amount || 0
      row.cogs    += o.total_cogs || 0
      row.margin  += o.margin || 0
      m.set(key, row)
    })
    return Array.from(m.values()).sort((a, b) => b.margin - a.margin)
  }, [filtered])

  const byProduct = useMemo(() => {
    const m = new Map<string, { id: string; code: string; name: string; category: string; orders: number; qty: number; revenue: number; cogs: number; margin: number }>()
    filtered.forEach(o => {
      if (!o.product_id) return
      const key = o.product_id
      const row = m.get(key) || {
        id: key,
        code: o.product?.code || '—',
        name: o.product?.name || 'Custom / unknown',
        category: o.product?.category || '',
        orders: 0, qty: 0, revenue: 0, cogs: 0, margin: 0,
      }
      row.orders += 1
      row.qty    += o.quantity || 0
      row.revenue += o.total_amount || 0
      row.cogs    += o.total_cogs || 0
      row.margin  += o.margin || 0
      m.set(key, row)
    })
    return Array.from(m.values()).sort((a, b) => b.margin - a.margin)
  }, [filtered])

  const ordersSorted = useMemo(() => {
    return [...filtered].sort((a, b) => (b.margin || 0) - (a.margin || 0))
  }, [filtered])

  function downloadCsv() {
    const rows = [
      ['Order #', 'Date', 'Status', 'Type', 'Partner', 'Product', 'Qty', 'Revenue', 'COGS', 'Margin', 'Margin %'],
      ...ordersSorted.map(o => [
        o.order_number,
        o.order_date,
        o.status,
        o.type,
        o.partner?.store_name || '',
        o.product ? `${o.product.code} ${o.product.name}` : '',
        String(o.quantity ?? ''),
        String(o.total_amount ?? ''),
        String(o.total_cogs ?? ''),
        String(o.margin ?? ''),
        o.total_amount ? `${(((o.margin || 0) / o.total_amount) * 100).toFixed(2)}%` : '',
      ]),
    ]
    const csv = rows.map(r => r.map(csvSafe).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profitability-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxMonthVal = Math.max(...byMonth.map(m => m.revenue), 1)
  const marginRate = totals.revenue ? totals.margin / totals.revenue : 0

  if (status === 'loading') {
    return <div className="p-4 lg:p-7 text-center text-stone-400 pt-20">Loading...</div>
  }
  if (!allowed) {
    return (
      <div className="p-4 lg:p-7 text-center text-stone-500 pt-20">
        You do not have access to the profitability dashboard.
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Profitability</h1>
          <p className="text-stone-500 text-sm mt-0.5">Margin per order, partner and product</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none">
            <option value="realised">Dispatched / delivered only</option>
            <option value="all">All open orders (provisional)</option>
          </select>
          <select value={range} onChange={e => setRange(e.target.value as Range)}
            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none">
            {RANGE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button onClick={downloadCsv} disabled={!filtered.length}
            className="flex items-center gap-1.5 bg-white border border-stone-200 hover:border-[#C49C64] text-stone-700 px-3 py-2 rounded-lg text-sm disabled:opacity-50">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-5 lg:mb-6">
        <KpiCard label="Revenue" value={formatCurrency(totals.revenue)} icon={IndianRupee} tone="text-blue-600" bg="bg-blue-50" />
        <KpiCard label="COGS" value={formatCurrency(totals.cogs)} icon={TrendingDown} tone="text-orange-600" bg="bg-orange-50" />
        <KpiCard
          label="Margin"
          value={formatCurrency(totals.margin)}
          icon={TrendingUp}
          tone={totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}
          bg={totals.margin >= 0 ? 'bg-green-50' : 'bg-red-50'}
        />
        <KpiCard
          label="Margin %"
          value={totals.revenue ? `${(marginRate * 100).toFixed(1)}%` : '—'}
          icon={Percent}
          tone={marginRate >= 0 ? 'text-emerald-600' : 'text-red-600'}
          bg={marginRate >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
        />
        <KpiCard label="Orders" value={String(totals.count)} icon={ShoppingBag} tone="text-stone-700" bg="bg-stone-100" />
      </div>

      {/* Monthly trend */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5 lg:mb-6">
        <h2 className="font-medium text-stone-900 mb-4">Revenue vs margin by month</h2>
        {byMonth.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-3 min-w-fit" style={{ height: 180 }}>
              {byMonth.map(m => {
                const revH = (m.revenue / maxMonthVal) * 140
                const marH = (Math.max(m.margin, 0) / maxMonthVal) * 140
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1 min-w-[44px]">
                    <p className="text-[10px] text-stone-400">{m.revenue ? `₹${(m.revenue/1000).toFixed(0)}K` : ''}</p>
                    <div className="flex items-end gap-0.5" style={{ height: 140 }}>
                      <div className="w-3 bg-blue-200 rounded-t" style={{ height: `${revH}px` }} />
                      <div className="w-3 bg-[#C49C64] rounded-t" style={{ height: `${marH}px` }} />
                    </div>
                    <p className="text-xs text-stone-400">{m.label}</p>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-200 rounded-sm" /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#C49C64] rounded-sm" /> Margin</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-5 lg:mb-6">
        {/* Top partners */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-stone-400" />
            <h2 className="font-medium text-stone-900">Top partners by margin</h2>
          </div>
          <PartnerTable rows={byPartner.slice(0, 10)} />
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-stone-400" />
            <h2 className="font-medium text-stone-900">Top products by margin</h2>
          </div>
          <ProductTable rows={byProduct.slice(0, 10)} />
        </div>
      </div>

      {/* Per-order breakdown */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-medium text-stone-900">Orders ranked by margin</h2>
          <p className="text-xs text-stone-400">{ordersSorted.length} orders</p>
        </div>
        {orders === null ? (
          <p className="px-5 py-6 text-sm text-stone-400">Loading...</p>
        ) : ordersSorted.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-400">No orders match the current filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Partner</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-medium text-right">COGS</th>
                  <th className="px-4 py-2.5 font-medium text-right">Margin</th>
                  <th className="px-4 py-2.5 font-medium text-right">M%</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {ordersSorted.slice(0, 100).map(o => {
                  const m = o.margin || 0
                  const r = o.total_amount || 0
                  return (
                    <tr key={o.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-stone-800">{o.order_number}</p>
                        <p className="text-[10px] text-stone-400">{o.order_date} · {o.status?.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-4 py-2.5 text-stone-700">{o.partner?.store_name || '—'}</td>
                      <td className="px-4 py-2.5 text-stone-700">
                        {o.product ? <span><span className="text-xs text-stone-400">{o.product.code}</span> {o.product.name}</span> : <span className="text-stone-400 text-xs italic">{o.type === 'custom' ? 'Custom' : '—'}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-700">{formatCurrency(r)}</td>
                      <td className="px-4 py-2.5 text-right text-stone-500">{formatCurrency(o.total_cogs || 0)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(m)}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs ${m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmtPct(m, r)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/orders/${o.id}`} className="text-stone-300 hover:text-[#C49C64]">
                          <ChevronRight className="w-4 h-4 inline" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {ordersSorted.length > 100 && (
              <p className="px-5 py-3 text-xs text-stone-400 border-t border-stone-100">
                Showing top 100 by margin. Export the CSV for the full list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, tone, bg }: { label: string; value: string; icon: any; tone: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-stone-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${tone}`} />
        </div>
      </div>
      <p className="text-xl lg:text-2xl font-semibold text-stone-900 truncate">{value}</p>
    </div>
  )
}

function PartnerTable({ rows }: { rows: { id: string; name: string; city: string; orders: number; revenue: number; cogs: number; margin: number }[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-stone-400">No data yet.</p>
  }
  return (
    <div className="divide-y divide-stone-50">
      {rows.map((p, i) => {
        const pct = p.revenue ? (p.margin / p.revenue) * 100 : 0
        return (
          <div key={p.id} className="px-5 py-3 flex items-center gap-3">
            <span className="text-base font-semibold text-stone-200 w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800 truncate">{p.name}</p>
              <p className="text-xs text-stone-400">{p.city || '—'} · {p.orders} orders · {formatCurrency(p.revenue)} revenue</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(p.margin)}
              </p>
              <p className="text-[10px] text-stone-400">{p.revenue ? `${pct.toFixed(1)}% margin` : ''}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProductTable({ rows }: { rows: { id: string; code: string; name: string; category: string; orders: number; qty: number; revenue: number; cogs: number; margin: number }[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-stone-400">No catalog orders yet.</p>
  }
  return (
    <div className="divide-y divide-stone-50">
      {rows.map((p, i) => {
        const pct = p.revenue ? (p.margin / p.revenue) * 100 : 0
        return (
          <div key={p.id} className="px-5 py-3 flex items-center gap-3">
            <span className="text-base font-semibold text-stone-200 w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800 truncate">
                <span className="text-xs text-stone-400 mr-1">{p.code}</span>{p.name}
              </p>
              <p className="text-xs text-stone-400 capitalize">{p.category || '—'} · {p.qty} units · {formatCurrency(p.revenue)} revenue</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(p.margin)}
              </p>
              <p className="text-[10px] text-stone-400">{p.revenue ? `${pct.toFixed(1)}% margin` : ''}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
