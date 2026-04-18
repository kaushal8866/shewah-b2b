'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, ExternalLink } from 'lucide-react'
import { supabase, computeOrderCogs, type Order } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

type Bucket = { name: string; revenue: number; cogs: number; margin: number; orders: number }
type LossOrder = {
  id: string
  order_number: string
  partner_name: string
  total_amount: number
  total_cogs: number
  margin: number
  order_date: string
}

const PRESETS = [
  { days: 30,  label: 'Last 30 days' },
  { days: 90,  label: 'Last 90 days' },
  { days: 180, label: 'Last 6 months' },
  { days: 365, label: 'Last 12 months' },
]

const PIE_COLORS = ['#C49C64', '#6B7280', '#10B981', '#F59E0B']

export default function ProfitabilityDashboard() {
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    totalRevenue: number
    totalCogs: number
    totalMargin: number
    marginPct: number
    deliveredCount: number
    byPartner: Bucket[]
    byProduct: Bucket[]
    byGoldSource: Bucket[]
    lossOrders: LossOrder[]
  }>({
    totalRevenue: 0, totalCogs: 0, totalMargin: 0, marginPct: 0, deliveredCount: 0,
    byPartner: [], byProduct: [], byGoldSource: [], lossOrders: [],
  })

  useEffect(() => { load() /* eslint-disable-next-line */ }, [days])

  async function load() {
    setLoading(true)
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = since.toISOString().slice(0, 10)

      const [
        { data: orders },
        { data: partners },
        { data: products },
      ] = await Promise.all([
        supabase.from('orders').select('*')
          .eq('status', 'delivered')
          .gte('order_date', sinceStr),
        supabase.from('partners').select('id, store_name'),
        supabase.from('products').select('id, name, code'),
      ])

      const allOrders: Order[] = orders || []
      const partnerMap: Record<string, string> = {}
      ;(partners || []).forEach((p: any) => { partnerMap[p.id] = p.store_name })
      const productMap: Record<string, string> = {}
      ;(products || []).forEach((p: any) => { productMap[p.id] = p.name || p.code })

      let totalRevenue = 0, totalCogs = 0, totalMargin = 0
      const byPartner: Record<string, Bucket> = {}
      const byProduct: Record<string, Bucket> = {}
      const byGoldSource: Record<string, Bucket> = {}
      const lossOrders: LossOrder[] = []

      allOrders.forEach(o => {
        const revenue = Number(o.total_amount) || 0
        // Prefer stored cogs/margin; fall back to compute when missing
        let cogs = Number(o.total_cogs)
        let margin = Number(o.margin)
        if (!Number.isFinite(cogs) || cogs <= 0 || !Number.isFinite(margin)) {
          const c = computeOrderCogs({
            gold_weight_actual: o.gold_weight_actual,
            gold_rate_at_order: o.gold_rate_at_order,
            gold_karat: undefined,
            making_charges: o.making_charges,
            cad_cost: o.cad_cost,
            stone_cost: o.stone_cost,
            total_amount: o.total_amount,
            trade_price: o.trade_price,
          })
          cogs = c.total_cogs
          margin = c.margin
        }
        // Skip orders with no cogs data at all – they distort margin metrics
        if (!cogs && !margin) return

        totalRevenue += revenue
        totalCogs += cogs
        totalMargin += margin

        const pName = (o.partner_id && partnerMap[o.partner_id]) || 'Unknown partner'
        if (!byPartner[pName]) byPartner[pName] = { name: pName, revenue: 0, cogs: 0, margin: 0, orders: 0 }
        byPartner[pName].revenue += revenue
        byPartner[pName].cogs += cogs
        byPartner[pName].margin += margin
        byPartner[pName].orders += 1

        const prName = (o.product_id && productMap[o.product_id]) || (o.type === 'custom' ? 'Custom design' : 'Unknown product')
        if (!byProduct[prName]) byProduct[prName] = { name: prName, revenue: 0, cogs: 0, margin: 0, orders: 0 }
        byProduct[prName].revenue += revenue
        byProduct[prName].cogs += cogs
        byProduct[prName].margin += margin
        byProduct[prName].orders += 1

        const gs = o.gold_source === 'manufacturer' ? 'Manufacturer' : 'Self'
        if (!byGoldSource[gs]) byGoldSource[gs] = { name: gs, revenue: 0, cogs: 0, margin: 0, orders: 0 }
        byGoldSource[gs].revenue += revenue
        byGoldSource[gs].cogs += cogs
        byGoldSource[gs].margin += margin
        byGoldSource[gs].orders += 1

        if (margin < 0) {
          lossOrders.push({
            id: o.id,
            order_number: o.order_number,
            partner_name: pName,
            total_amount: revenue,
            total_cogs: cogs,
            margin,
            order_date: o.order_date,
          })
        }
      })

      const sortByMargin = (a: Bucket, b: Bucket) => b.margin - a.margin

      setData({
        totalRevenue,
        totalCogs,
        totalMargin,
        marginPct: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0,
        deliveredCount: allOrders.length,
        byPartner: Object.values(byPartner).sort(sortByMargin).slice(0, 10),
        byProduct: Object.values(byProduct).sort(sortByMargin).slice(0, 10),
        byGoldSource: Object.values(byGoldSource),
        lossOrders: lossOrders.sort((a, b) => a.margin - b.margin),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const kpiCards = useMemo(() => ([
    { label: 'Revenue',   value: formatCurrency(data.totalRevenue), color: 'text-stone-900', bg: 'bg-stone-50' },
    { label: 'COGS',      value: formatCurrency(data.totalCogs),    color: 'text-stone-900', bg: 'bg-stone-50' },
    { label: 'Margin',    value: formatCurrency(data.totalMargin),  color: data.totalMargin >= 0 ? 'text-green-700' : 'text-red-700', bg: data.totalMargin >= 0 ? 'bg-green-50' : 'bg-red-50' },
    { label: 'Margin %',  value: `${data.marginPct.toFixed(1)}%`,   color: data.marginPct >= 0 ? 'text-green-700' : 'text-red-700', bg: data.marginPct >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ]), [data])

  return (
    <section className="mt-6 lg:mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg lg:text-xl font-semibold text-stone-900">Profitability</h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Revenue, COGS and margin from delivered orders
          </p>
        </div>
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                days === p.days ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-sm text-stone-400">
          Loading profitability...
        </div>
      ) : data.deliveredCount === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-sm text-stone-400">
          No delivered orders in this period.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
            {kpiCards.map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-stone-400">{k.label}</p>
                  <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                    {k.label === 'Margin' || k.label === 'Margin %' ? (
                      data.totalMargin >= 0
                        ? <TrendingUp className="w-4 h-4 text-green-600" />
                        : <TrendingDown className="w-4 h-4 text-red-600" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-stone-500" />
                    )}
                  </div>
                </div>
                <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
                {k.label === 'Revenue' && (
                  <p className="text-xs text-stone-400 mt-1">{data.deliveredCount} delivered orders</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-5">
            {/* Margin by partner */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-medium text-stone-900 mb-4">Margin by partner (top 10)</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={data.byPartner} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1ef" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#78716c' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#57534e' }} interval={0} />
                    <Tooltip
                      formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#C49C64" />
                    <Bar dataKey="margin"  name="Margin"  fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Margin by product */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-medium text-stone-900 mb-4">Margin by product (top 10)</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={data.byProduct} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1ef" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#78716c' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#57534e' }} interval={0} />
                    <Tooltip
                      formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#C49C64" />
                    <Bar dataKey="margin"  name="Margin"  fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Gold source breakdown */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-medium text-stone-900 mb-4">Margin by gold source</h3>
              {data.byGoldSource.length === 0 ? (
                <p className="text-sm text-stone-400">No data</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={data.byGoldSource}
                          dataKey="margin"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {data.byGoldSource.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {data.byGoldSource.map((g, i) => {
                      const pct = g.revenue > 0 ? (g.margin / g.revenue) * 100 : 0
                      return (
                        <div key={g.name} className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-medium text-stone-800">{g.name}</span>
                            <span className="text-xs text-stone-400 ml-auto">{g.orders} orders</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs text-stone-500 pl-4">
                            <div>
                              <p className="text-stone-400">Revenue</p>
                              <p className="text-stone-700 font-medium">{formatCurrency(g.revenue)}</p>
                            </div>
                            <div>
                              <p className="text-stone-400">Margin</p>
                              <p className={`font-medium ${g.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(g.margin)}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-400">Margin %</p>
                              <p className={`font-medium ${pct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {pct.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Loss-making orders */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-medium text-stone-900">Loss-making orders</h3>
                <span className="ml-auto text-xs text-stone-400">{data.lossOrders.length} found</span>
              </div>
              {data.lossOrders.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-stone-400">
                  No loss-making orders in this period.
                </div>
              ) : (
                <div className="divide-y divide-stone-50 max-h-80 overflow-y-auto">
                  {data.lossOrders.slice(0, 20).map(o => (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800 truncate">{o.order_number}</p>
                          <ExternalLink className="w-3 h-3 text-stone-300" />
                        </div>
                        <p className="text-xs text-stone-400 truncate">
                          {o.partner_name} · {new Date(o.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-red-700">{formatCurrency(o.margin)}</p>
                        <p className="text-xs text-stone-400">
                          {formatCurrency(o.total_amount)} − {formatCurrency(o.total_cogs)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
