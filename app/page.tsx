'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import {
  Users, ShoppingBag, TrendingUp, IndianRupee,
  Clock, CheckCircle2, AlertCircle, Package
} from 'lucide-react'
import Link from 'next/link'
import { MetricsSkeleton, TableSkeleton } from './components/LoadingSkeleton'

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
    { label: 'Active Partners', value: stats.activePartners, sub: `${stats.totalPartners} total`, icon: Users },
    { label: 'Hot Leads', value: stats.hotLeads, sub: 'Need follow-up', icon: AlertCircle },
    { label: 'Open Orders', value: stats.pendingOrders, sub: `${stats.totalOrders} total`, icon: ShoppingBag },
    { label: 'Pending Revenue', value: formatCurrency(stats.pendingRevenue), sub: 'Balance due', icon: IndianRupee },
    { label: 'Total Earned', value: formatCurrency(stats.totalRevenue), sub: 'Delivered orders', icon: TrendingUp },
    { label: 'CAD Queue', value: stats.activeCadRequests, sub: 'Pending + in-progress', icon: Clock },
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
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32">
      {/* Header */}
      <div className="mb-8 lg:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="display-sm">Dashboard</h1>
          <p className="text-secondary tracking-wide mt-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {stats.goldRate24k > 0 && (
          <div className="bg-surface-highest px-4 py-3 text-right">
            <p className="label-md mb-1">Gold 24K today</p>
            <p className="headline-lg">₹{stats.goldRate24k.toLocaleString('en-IN')}/g</p>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 mb-10">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card bg-surface-low hover:bg-surface-highest transition-colors cursor-default">
            <div className="flex items-start justify-between mb-4">
              <p className="label-md">{m.label}</p>
              <m.icon className="w-5 h-5 text-secondary" />
            </div>
            <p className="display-md">{loading ? '—' : m.value}</p>
            <p className="text-xs text-secondary mt-1 tracking-wide">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 lg:gap-8">
        {/* Order pipeline */}
        <div className="lg:col-span-2 card bg-surface-low">
          <div className="pb-6 border-b ghost-border flex items-center justify-between">
            <h2 className="headline-md">Order pipeline</h2>
            <Link href="/orders" className="text-sm text-secondary hover:text-primary underline underline-offset-4">View all</Link>
          </div>

          {/* Pipeline funnel */}
          <div className="py-6 border-b ghost-border overflow-x-auto hide-scrollbar">
            <div className="flex gap-2 min-w-[600px] md:min-w-0 px-2 lg:px-0">
              {pipelineStages.map((stage) => {
                const count = recentOrders.filter(o => o.status === stage.status).length
                return (
                  <div key={stage.status} className="flex-1 text-center">
                    <div className={`py-4 text-sm font-medium ${count > 0 ? 'bg-primary text-surface-lowest' : 'bg-surface-highest text-secondary'}`}>
                      {count}
                    </div>
                    <p className="label-md mt-2 truncate">{stage.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent orders table */}
          <div className="divide-y divide-[#cfc4c5]/20 mt-4">
            {loading ? (
              <div className="py-8 text-center text-secondary text-sm">Loading...</div>
            ) : recentOrders.length === 0 ? (
              <div className="py-8 text-center text-secondary text-sm">
                No orders yet.{' '}
                <Link href="/orders" className="text-primary hover:underline">Create first order</Link>
              </div>
            ) : (
              recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}
                  className="flex items-center gap-4 py-4 hover:bg-surface-highest transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-primary">{order.order_number}</p>
                    <p className="text-sm text-secondary truncate mt-0.5">{order.partner_name} · {order.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-medium text-primary">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs text-secondary mt-0.5">{formatDate(order.order_date)}</p>
                  </div>
                  <span className={`status-pill uppercase ml-3 shrink-0 ${order.status === 'delivered' ? 'success' : order.status === 'brief_received' ? 'warning' : 'active'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick actions + hot leads */}
        <div className="space-y-1 lg:space-y-8">
          {/* Quick actions */}
          <div className="card bg-surface-low">
            <h2 className="headline-md mb-6">Quick actions</h2>
            <div className="space-y-3">
              {[
                { href: '/partners/new', label: 'Add partner', icon: Users },
                { href: '/orders/new', label: 'New order', icon: ShoppingBag },
                { href: '/cad-requests/new', label: 'New CAD request', icon: Package },
                { href: '/gold-rates', label: 'Update gold rate', icon: TrendingUp },
                { href: '/circuits/new', label: 'Plan a circuit', icon: CheckCircle2 },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-4 px-4 py-3 rounded-md text-base text-primary hover:bg-surface-highest transition-colors">
                  <Icon className="w-5 h-5 text-secondary" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Today's follow-ups */}
          <div className="card bg-surface-low">
            <h2 className="headline-md mb-6">Pending CAD (48h)</h2>
            {stats.activeCadRequests === 0 ? (
              <p className="text-secondary text-sm">No pending CAD requests</p>
            ) : (
              <Link href="/cad-requests" className="block">
                <div className="bg-surface-highest border border-outline-variant/20 p-6 text-center">
                  <p className="display-md text-primary">{stats.activeCadRequests}</p>
                  <p className="label-md mt-2">requests in queue</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
