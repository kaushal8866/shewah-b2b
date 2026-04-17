'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES } from '@/lib/supabase'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { Plus, Search, ChevronRight, AlertCircle, ShoppingBag } from 'lucide-react'
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

  const filtered = orders.filter((o: OrderRow) => {
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: orders.length,
    open: orders.filter((o: OrderRow) => o.status !== 'delivered').length,
    pending_payment: orders.filter((o: OrderRow) => (o.balance_due || 0) > 0).length,
    total_revenue: orders.filter((o: OrderRow) => o.status === 'delivered').reduce((s: number, o: OrderRow) => s + o.total_amount, 0),
  }


  const getDaysLeft = (date: string) => {
    if (!date) return null
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return diff
  }

  return (
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h1 className="display-sm">Orders</h1>
          <p className="text-secondary tracking-wide mt-2">Pipeline tracker — {orders.length} orders</p>
        </div>
        <Link href="/orders/new"
          className="flex items-center gap-2 bg-primary text-surface-lowest px-5 py-3 rounded-md text-sm font-medium hover:bg-surface-highest hover:text-primary transition-colors">
          <Plus className="w-5 h-5" />
          New order
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
        {[
          { label: 'Total orders', value: stats.total },
          { label: 'Open orders', value: stats.open },
          { label: 'Awaiting payment', value: stats.pending_payment },
          { label: 'Total revenue', value: formatCurrency(stats.total_revenue) },
        ].map(s => (
          <div key={s.label} className="bg-surface-low hover:bg-surface-highest transition-colors px-6 py-5 flex flex-col justify-center">
            <p className="label-md">{s.label}</p>
            <p className="display-sm mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban quick view */}
      <div className="bg-surface-low p-6 mb-8">
        <p className="label-md mb-4">Pipeline overview</p>
        <div className="flex overflow-x-auto gap-2 min-w-0 hide-scrollbar pb-2 sm:pb-0 snap-x">
          {ORDER_STATUSES.filter((s: any) => s.value !== 'delivered').map((stage: any) => {
            const count = orders.filter((o: OrderRow) => o.status === stage.value).length
            return (
              <button key={stage.value}
                onClick={() => setStatusFilter(stage.value === statusFilter ? 'all' : stage.value)}
                className={`snap-start shrink-0 min-w-[120px] sm:min-w-0 sm:flex-1 text-center py-4 transition-colors ${
                  statusFilter === stage.value
                    ? 'bg-primary text-surface-lowest shadow-ambient'
                    : count > 0 ? 'bg-surface-highest text-primary hover:bg-surface-lowest' : 'bg-surface text-secondary'
                }`}>
                <p className="display-sm">{count}</p>
                <p className="label-md mt-2 px-1 truncate">{stage.label}</p>
              </button>
            )
          })}

        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-8">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-secondary" />
          <input type="text" placeholder="Search order, partner, product..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm bg-surface-lowest ghost-border" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            <option>All types</option>
            <option value="catalog">Catalog</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-lowest ghost-border overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b ghost-border bg-surface-low text-secondary text-left">
              <th className="label-md px-6 py-4">Order</th>
              <th className="label-md px-4 py-4">Partner</th>
              <th className="label-md px-4 py-4">Product</th>
              <th className="label-md px-4 py-4">Status</th>
              <th className="label-md px-4 py-4 relative">Amount</th>
              <th className="label-md px-4 py-4">Delivery</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-secondary text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <ShoppingBag className="w-10 h-10 text-outline-variant mx-auto mb-4" />
                  <p className="text-secondary text-sm">No orders matching your filters</p>
                </td>
              </tr>
            ) : (
              filtered.map(o => {
                const daysLeft = getDaysLeft(o.expected_delivery)
                const isOverdue = daysLeft !== null && daysLeft < 0 && o.status !== 'delivered'
                return (
                  <tr key={o.id} className="hover:bg-surface-low transition-colors cursor-pointer"
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
