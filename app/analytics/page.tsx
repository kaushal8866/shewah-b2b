'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { BarChart2, TrendingUp, Users, ShoppingBag } from 'lucide-react'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    revenueByMonth: { month: string; revenue: number; orders: number }[]
    partnersByStage: { stage: string; count: number }[]
    partnersByCircuit: { circuit: string; count: number }[]
    ordersByStatus: { status: string; count: number; value: number }[]
    topPartners: { store_name: string; city: string; orders: number; revenue: number }[]
    conversionFunnel: { visited: number; contacted: number; sample: number; active: number }
    modelSplit: { model: string; count: number; revenue: number }[]
    cadStats: { total: number; avgTurnaround: number; approvalRate: number }
    governance: { approved: number; denied: number; pending: number }
    circuitROI: { budget: number; revenue: number; circuits: number }
  }>({
    revenueByMonth: [],
    partnersByStage: [],
    partnersByCircuit: [],
    ordersByStatus: [],
    topPartners: [],
    conversionFunnel: { visited: 0, contacted: 0, sample: 0, active: 0 },
    modelSplit: [],
    cadStats: { total: 0, avgTurnaround: 0, approvalRate: 0 },
    governance: { approved: 0, denied: 0, pending: 0 },
    circuitROI: { budget: 0, revenue: 0, circuits: 0 }
  })

  useEffect(() => { loadAnalytics() }, [])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const [
        { data: orders },
        { data: partners },
        { data: cadReqs },
        { data: circuits }
      ] = await Promise.all([
        supabase.from('order_pipeline').select('*'),
        supabase.from('partners').select('*'),
        supabase.from('cad_requests').select('*'),
        supabase.from('circuits').select('*')
      ])

      const allOrders: any[] = orders || []
      const allPartners: any[] = partners || []
      const allCAD: any[] = cadReqs || []
      const allCircuits: any[] = circuits || []

      // Governance
      const governance = {
        approved: allOrders.filter((o: any) => o.gov_status === 'owner_approved' || o.gov_status === 'auto_approved').length,
        denied: allOrders.filter((o: any) => o.gov_status === 'denied').length,
        pending: allOrders.filter((o: any) => o.gov_status === 'pending_approval').length,
      }

      // Circuit ROI
      const circuitROI = {
        budget: allCircuits.reduce((s: number, c: any) => s + (c.budget_inr || 0), 0),
        revenue: allOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
        circuits: allCircuits.length
      }


      // ... existing calculations ...
      // Revenue by month (last 6 months)
      const monthMap: Record<string, { revenue: number; orders: number }> = {}
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i)
        const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        months.push(key)
        monthMap[key] = { revenue: 0, orders: 0 }
      }
      allOrders.forEach((o: any) => {
        const key = new Date(o.order_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        if (monthMap[key]) {
          monthMap[key].revenue += o.total_amount || 0
          monthMap[key].orders += 1
        }
      })
      const revenueByMonth = months.map(m => ({ month: m, ...monthMap[m] }))

      // Partners by stage
      const stageCount: Record<string, number> = {}
      allPartners.forEach((p: any) => { stageCount[p.stage] = (stageCount[p.stage] || 0) + 1 })
      const partnersByStage = Object.entries(stageCount).map(([stage, count]) => ({ stage, count }))

      // Partners by circuit
      const circuitCount: Record<string, number> = {}
      allPartners.forEach((p: any) => {
        const c = p.circuit || 'Unassigned'
        circuitCount[c] = (circuitCount[c] || 0) + 1
      })
      const partnersByCircuit = Object.entries(circuitCount).map(([circuit, count]) => ({ circuit, count }))

      // Orders by status
      const statusMap: Record<string, { count: number; value: number }> = {}
      allOrders.forEach((o: any) => {
        if (!statusMap[o.status]) statusMap[o.status] = { count: 0, value: 0 }
        statusMap[o.status].count++
        statusMap[o.status].value += o.total_amount || 0
      })
      const ordersByStatus = Object.entries(statusMap).map(([status, v]) => ({ status, ...v }))

      // Top partners
      const partnerRevMap: Record<string, { store_name: string; city: string; orders: number; revenue: number }> = {}
      allOrders.forEach((o: any) => {
        if (!o.partner_name) return
        const key = o.partner_name
        if (!partnerRevMap[key]) partnerRevMap[key] = { store_name: o.partner_name, city: o.partner_city, orders: 0, revenue: 0 }
        partnerRevMap[key].orders++
        partnerRevMap[key].revenue += o.total_amount || 0
      })
      const topPartners = Object.values(partnerRevMap).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)

      // Conversion funnel
      const conversionFunnel = {
        visited: allPartners.length,
        contacted: allPartners.filter((p: any) => ['contacted', 'sample_sent', 'active'].includes(p.stage)).length,
        sample: allPartners.filter((p: any) => ['sample_sent', 'active'].includes(p.stage)).length,
        active: allPartners.filter((p: any) => p.stage === 'active').length,
      }

      // Model split
      const modelMap: Record<string, { count: number; revenue: number }> = {}
      allOrders.forEach((o: any) => {
        const m = o.model || 'unknown'
        if (!modelMap[m]) modelMap[m] = { count: 0, revenue: 0 }
        modelMap[m].count++
        modelMap[m].revenue += o.total_amount || 0
      })
      const modelSplit = Object.entries(modelMap).map(([model, v]) => ({ model, ...v }))

      // CAD stats
      const approved = allCAD.filter((c: any) => c.status === 'approved').length
      const cadStats = {
        total: allCAD.length,
        avgTurnaround: 0,
        approvalRate: allCAD.length ? Math.round((approved / allCAD.length) * 100) : 0,
      }

      setData({ revenueByMonth, partnersByStage, partnersByCircuit, ordersByStatus, topPartners, conversionFunnel, modelSplit, cadStats, governance, circuitROI })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const maxRevenue = Math.max(...data.revenueByMonth.map((m: any) => m.revenue), 1)

  const stageColors: Record<string, string> = {
    prospect: 'bg-gray-200', contacted: 'bg-blue-300',
    sample_sent: 'bg-yellow-400', active: 'bg-green-500', inactive: 'bg-red-300'
  }

  if (loading) return (
    <div className="p-7 text-center text-stone-400 pt-20">Loading analytics...</div>
  )

  const totalRevenue = data.revenueByMonth.reduce((s: number, m: any) => s + m.revenue, 0)
  const totalOrders = data.revenueByMonth.reduce((s: number, m: any) => s + m.orders, 0)


  return (
    <div className="p-4 lg:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Analytics</h1>
        <p className="text-stone-500 text-sm mt-0.5">Business performance overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {[
          { label: '6-month revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total orders', value: totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Circuit ROI', value: `${((data.circuitROI.revenue / (data.circuitROI.budget || 1)) * 100).toFixed(0)}%`, icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Gov. Health', value: `${((data.governance.approved / ((data.governance.approved + data.governance.denied) || 1)) * 100).toFixed(0)}%`, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-400">{m.label}</p>
              <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Monthly revenue</h2>
          <div className="flex items-end gap-2 h-32">
            {data.revenueByMonth.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs text-stone-400">{m.revenue > 0 ? `₹${(m.revenue/1000).toFixed(0)}K` : ''}</p>
                <div className="w-full bg-stone-100 rounded-t overflow-hidden flex flex-col justify-end" style={{ height: '80px' }}>
                  <div className="w-full bg-[#C49C64] rounded-t transition-all"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%` }} />
                </div>
                <p className="text-xs text-stone-400">{m.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Partner conversion funnel</h2>
          <div className="space-y-2">
            {[
              { label: 'Total partners added', value: data.conversionFunnel.visited, color: 'bg-blue-200' },
              { label: 'Contacted / met', value: data.conversionFunnel.contacted, color: 'bg-blue-400' },
              { label: 'Sample sent', value: data.conversionFunnel.sample, color: 'bg-yellow-400' },
              { label: 'Active partners', value: data.conversionFunnel.active, color: 'bg-green-500' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-32 text-right">
                  <p className="text-xs text-stone-500">{step.label}</p>
                </div>
                <div className="flex-1 h-7 bg-stone-50 rounded overflow-hidden">
                  <div className={`h-full ${step.color} rounded flex items-center px-2`}
                    style={{ width: `${data.conversionFunnel.visited > 0 ? (step.value / data.conversionFunnel.visited) * 100 : 0}%`, minWidth: step.value > 0 ? '32px' : '0' }}>
                    <span className="text-xs font-medium text-white">{step.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {data.conversionFunnel.visited > 0 && (
            <p className="text-xs text-stone-400 mt-3">
              Partner conversion rate: {Math.round((data.conversionFunnel.active / data.conversionFunnel.visited) * 100)}%
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top partners */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-medium text-stone-900">Top partners by revenue</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {data.topPartners.length === 0 ? (
              <p className="px-5 py-4 text-sm text-stone-400">No order data yet</p>
            ) : (
              data.topPartners.map((p, i) => (
                <div key={p.store_name} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-lg font-semibold text-stone-200 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{p.store_name}</p>
                    <p className="text-xs text-stone-400">{p.city} · {p.orders} orders</p>
                  </div>
                  <p className="text-sm font-semibold text-stone-700 shrink-0">{formatCurrency(p.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Model split */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Revenue by model</h2>
          {data.modelSplit.length === 0 ? (
            <p className="text-sm text-stone-400">No order data yet</p>
          ) : (
            <div className="space-y-3">
              {data.modelSplit.map(m => (
                <div key={m.model}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-600 capitalize">{m.model.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-stone-700">{formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C49C64] rounded-full"
                      style={{ width: `${(m.revenue / Math.max(...data.modelSplit.map(x => x.revenue))) * 100}%` }} />
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{m.count} orders</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partners by circuit */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Partners by circuit</h2>
          {data.partnersByCircuit.length === 0 ? (
            <p className="text-sm text-stone-400">No partner data yet</p>
          ) : (
            <div className="space-y-3">
              {data.partnersByCircuit.map(c => (
                <div key={c.circuit} className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">{c.circuit}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${(c.count / Math.max(...data.partnersByCircuit.map(x => x.count))) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-stone-700 w-6 text-right">{c.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
