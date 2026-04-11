'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES } from '@/lib/supabase'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { Plus, Search, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type OrderRow = {
  id: string
  order_number: string
  status: string
  type: string
  model: string
  trade_price: number
  total_amount: number
  advance_paid: number
  balance_due: number
  order_date: string
  expected_delivery: string
  partner_name: string
  partner_city: string
  product_name: string
  product_code: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState<'table' | 'kanban'>('table')

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('order_pipeline')
      .select('*')
      .order('order_date', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: orders.length,
    open: orders.filter(o => o.status !== 'delivered').length,
    pending_payment: orders.filter(o => (o.balance_due || 0) > 0).length,
    total_revenue: orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0),
  }

  const getDaysLeft = (date: string) => {
    if (!date) return null
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return diff
  }

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Orders</h1>
          <p className="text-stone-500 text-sm mt-0.5">Pipeline tracker — {orders.length} orders</p>
        </div>
        <Link href="/orders/new"
          className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
          <Plus className="w-4 h-4" />
          New order
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total orders', value: stats.total },
          { label: 'Open orders', value: stats.open },
          { label: 'Awaiting payment', value: stats.pending_payment },
          { label: 'Total revenue', value: formatCurrency(stats.total_revenue) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-400">{s.label}</p>
            <p className="text-xl font-semibold text-stone-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban quick view */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-4">
        <p className="text-xs text-stone-400 mb-3 font-medium">Pipeline overview</p>
        <div className="flex overflow-x-auto gap-2 pb-2 sm:pb-0 snap-x">
          {ORDER_STATUSES.filter(s => s.value !== 'delivered').map(stage => {
            const count = orders.filter(o => o.status === stage.value).length
            return (
              <button key={stage.value}
                onClick={() => setStatusFilter(stage.value === statusFilter ? 'all' : stage.value)}
                className={`snap-start shrink-0 min-w-[100px] sm:min-w-0 sm:flex-1 text-center rounded-lg py-2 text-xs font-medium transition-colors ${
                  statusFilter === stage.value
                    ? 'bg-[#C49C64] text-white'
                    : count > 0 ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' : 'bg-stone-50 text-stone-300'
                }`}>
                <p className="text-lg font-semibold">{count}</p>
                <p className="text-xs mt-0.5 truncate px-1">{stage.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search order, partner, product..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="flex-1 sm:flex-none text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            <option>All types</option>
            <option value="catalog">Catalog</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left text-xs text-stone-400 font-medium px-5 py-3">Order</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Partner</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Product</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Status</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Amount</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Delivery</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                {orders.length === 0 ? 'No orders yet — create your first order' : 'No orders match filters'}
              </td></tr>
            ) : (
              filtered.map(o => {
                const daysLeft = getDaysLeft(o.expected_delivery)
                const isOverdue = daysLeft !== null && daysLeft < 0 && o.status !== 'delivered'
                return (
                  <tr key={o.id} className="hover:bg-stone-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/orders/${o.id}`)}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-stone-900">{o.order_number}</p>
                      <p className="text-xs text-stone-400 capitalize">{o.type} · {o.model?.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-stone-700">{o.partner_name || '—'}</p>
                      <p className="text-xs text-stone-400">{o.partner_city}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-stone-700">{o.product_name || 'Custom design'}</p>
                      <p className="text-xs text-stone-400">{o.product_code}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`status-pill ${getStatusColor(o.status)}`}>
                        {o.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-stone-900">{formatCurrency(o.total_amount)}</p>
                      {(o.balance_due || 0) > 0 && (
                        <p className="text-xs text-red-500">₹{o.balance_due?.toLocaleString('en-IN')} due</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {o.expected_delivery ? (
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertCircle className="w-3 h-3 text-red-500" />}
                          <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-stone-500'}`}>
                            {formatDate(o.expected_delivery)}
                          </span>
                        </div>
                      ) : <span className="text-xs text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="w-4 h-4 text-stone-300" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
