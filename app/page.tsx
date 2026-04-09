'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import {
  Users, ShoppingBag, TrendingUp, IndianRupee,
  Clock, CheckCircle2, AlertCircle, Package
} from 'lucide-react'
import Link from 'next/link'

type Stats = {
  totalPartners: number
  activePartners: number
  hotLeads: number
  totalOrders: number
  pendingOrders: number
  totalRevenue: number
  pendingRevenue: number
  activeCadRequests: number
  goldRate24k: number
}

type RecentOrder = {
  id: string
  order_number: string
  status: string
  total_amount: number
  order_date: string
  partner_name: string
  product_name: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalPartners: 0, activePartners: 0, hotLeads: 0,
    totalOrders: 0, pendingOrders: 0,
    totalRevenue: 0, pendingRevenue: 0,
    activeCadRequests: 0, goldRate24k: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          { count: totalPartners },
          { count: activePartners },
          { count: hotLeads },
          { data: orders },
          { count: activeCad },
          { data: goldData },
        ] = await Promise.all([
          supabase.from('partners').select('*', { count: 'exact', head: true }),
          supabase.from('partners').select('*', { count: 'exact', head: true }).eq('stage', 'active'),
          supabase.from('partners').select('*', { count: 'exact', head: true }).eq('status', 'hot'),
          supabase.from('order_pipeline').select('*').order('order_date', { ascending: false }),
          supabase.from('cad_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
          supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
        ])

        const allOrders = orders || []
        const pending = allOrders.filter(o => !['delivered'].includes(o.status))
        const totalRevenue = allOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total_amount || 0), 0)
        const pendingRevenue = pending.reduce((s, o) => s + ((o.total_amount || 0) - (o.advance_paid || 0)), 0)

        setStats({
          totalPartners: totalPartners || 0,
          activePartners: activePartners || 0,
          hotLeads: hotLeads || 0,
          totalOrders: allOrders.length,
          pendingOrders: pending.length,
          totalRevenue,
          pendingRevenue,
          activeCadRequests: activeCad || 0,
          goldRate24k: goldData?.[0]?.rate_24k || 0,
        })

        setRecentOrders(allOrders.slice(0, 8).map(o => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          total_amount: o.total_amount,
          order_date: o.order_date,
          partner_name: o.partner_name || '—',
          product_name: o.product_name || 'Custom',
        })))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const metrics = [
    { label: 'Active Partners', value: stats.activePartners, sub: `${stats.totalPartners} total`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Hot Leads', value: stats.hotLeads, sub: 'Need follow-up', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Open Orders', value: stats.pendingOrders, sub: `${stats.totalOrders} total`, icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Pending Revenue', value: formatCurrency(stats.pendingRevenue), sub: 'Balance due', icon: IndianRupee, color: 'text-gold-600', bg: 'bg-yellow-50' },
    { label: 'Total Earned', value: formatCurrency(stats.totalRevenue), sub: 'Delivered orders', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'CAD Queue', value: stats.activeCadRequests, sub: 'Pending + in-progress', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const pipelineStages = [
    { status: 'brief_received', label: 'Brief' },
    { status: 'cad_in_progress', label: 'CAD' },
    { status: 'cad_sent', label: 'Sent' },
    { status: 'design_approved', label: 'Approved' },
    { status: 'production', label: 'Production' },
    { status: 'qc', label: 'QC' },
    { status: 'dispatched', label: 'Dispatched' },
  ]

  return (
    <div className="p-7">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {stats.goldRate24k > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-lg">
            <p className="text-xs text-yellow-600 font-medium">Gold 24K today</p>
            <p className="text-lg font-semibold text-yellow-800">₹{stats.goldRate24k.toLocaleString('en-IN')}/g</p>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-7">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-stone-500">{m.label}</p>
              <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold text-stone-900">{loading ? '—' : m.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Order pipeline */}
        <div className="col-span-2 bg-white rounded-xl border border-stone-200">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-medium text-stone-900">Order pipeline</h2>
            <Link href="/orders" className="text-xs text-[#C49C64] hover:underline">View all</Link>
          </div>

          {/* Pipeline funnel */}
          <div className="px-5 py-4 border-b border-stone-100">
            <div className="flex gap-1">
              {pipelineStages.map((stage) => {
                const count = recentOrders.filter(o => o.status === stage.status).length
                return (
                  <div key={stage.status} className="flex-1 text-center">
                    <div className={`rounded py-1.5 text-xs font-medium ${count > 0 ? 'bg-[#C49C64] text-white' : 'bg-stone-100 text-stone-400'}`}>
                      {count}
                    </div>
                    <p className="text-xs text-stone-400 mt-1 truncate">{stage.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent orders table */}
          <div className="divide-y divide-stone-50">
            {loading ? (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">Loading...</div>
            ) : recentOrders.length === 0 ? (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">
                No orders yet.{' '}
                <Link href="/orders" className="text-[#C49C64] hover:underline">Create first order</Link>
              </div>
            ) : (
              recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-stone-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">{order.order_number}</p>
                    <p className="text-xs text-stone-400 truncate">{order.partner_name} · {order.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-stone-900">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs text-stone-400">{formatDate(order.order_date)}</p>
                  </div>
                  <span className={`status-pill text-xs shrink-0 ${getStatusColor(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick actions + hot leads */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Quick actions</h2>
            <div className="space-y-2">
              {[
                { href: '/partners/new', label: 'Add partner', icon: Users },
                { href: '/orders/new', label: 'New order', icon: ShoppingBag },
                { href: '/cad-requests/new', label: 'New CAD request', icon: Package },
                { href: '/gold-rates', label: 'Update gold rate', icon: TrendingUp },
                { href: '/circuits/new', label: 'Plan a circuit', icon: CheckCircle2 },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors">
                  <Icon className="w-4 h-4 text-[#C49C64]" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Today's follow-ups */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Pending CAD (48h)</h2>
            {stats.activeCadRequests === 0 ? (
              <p className="text-sm text-stone-400">No pending CAD requests</p>
            ) : (
              <Link href="/cad-requests" className="block">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-semibold text-amber-700">{stats.activeCadRequests}</p>
                  <p className="text-xs text-amber-600">requests in queue</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
