'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package
} from 'lucide-react'

const ORDER_STATUS_LABELS: Record<string, string> = {
  customer_placed: 'Storefront Order',
  payment_pending: 'Payment Pending',
  brief_received: 'Order Received',
  cad_in_progress: 'CAD in Progress',
  cad_sent: 'CAD Sent',
  design_approved: 'Design Approved',
  production: 'In Production',
  qc: 'Quality Check',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_CLASSES: Record<string, string> = {
  customer_placed: 'bg-indigo-50 text-indigo-700 border-indigo-150',
  payment_pending: 'bg-red-50 text-red-700 border-red-150',
  brief_received: 'bg-blue-50 text-blue-700 border-blue-150',
  cad_in_progress: 'bg-purple-50 text-purple-700 border-purple-150',
  cad_sent: 'bg-purple-50 text-purple-700 border-purple-150',
  design_approved: 'bg-green-50 text-green-700 border-green-150',
  production: 'bg-amber-50 text-amber-700 border-amber-150',
  qc: 'bg-amber-50 text-amber-700 border-amber-150',
  dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-150',
  delivered: 'bg-green-50 text-green-700 border-green-150',
  cancelled: 'bg-stone-100 text-stone-500 border-stone-200',
}

export default function ResellerOrdersList() {
  const [orders, setOrders] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters state
  const [search, setSearch] = useState('')
  const [tabFilter, setTabFilter] = useState('all') // 'all', 'pending_payment', 'production', 'completed'

  useEffect(() => {
    fetch('/api/portal/reseller/orders')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setOrders(data.orders || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading orders...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const filteredOrders = (orders || []).filter(o => {
    // Search filter
    const matchesSearch =
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.shipping_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.products?.code || '').toLowerCase().includes(search.toLowerCase())

    // Tab filter
    if (tabFilter === 'customer_placed') {
      return matchesSearch && o.status === 'customer_placed'
    }
    if (tabFilter === 'pending_payment') {
      return matchesSearch && o.status === 'payment_pending'
    }
    if (tabFilter === 'production') {
      return matchesSearch && ['brief_received', 'cad_in_progress', 'cad_sent', 'design_approved', 'production', 'qc'].includes(o.status)
    }
    if (tabFilter === 'completed') {
      return matchesSearch && ['dispatched', 'delivered'].includes(o.status)
    }
    return matchesSearch
  })

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <ShoppingBag className="w-5.5 h-5.5 text-amber-600" />
          My Orders Ledger
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Track customer delivery timelines, submit proof of payments, and view your profits.
        </p>
      </div>

      {/* Search and Tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
            placeholder="Search by order #, SKU, or recipient..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tab Filters */}
        <div className="flex border-b border-stone-100 overflow-x-auto gap-2">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'customer_placed', label: 'Storefront Queue' },
            { id: 'pending_payment', label: 'Payment Pending' },
            { id: 'production', label: 'In Production' },
            { id: 'completed', label: 'Shipped / Completed' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTabFilter(t.id)}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                tabFilter === t.id
                  ? 'border-amber-600 text-stone-950'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Orders Found</p>
          <p className="text-stone-400 text-xs mt-1">Try adjusting your search filters or browse catalog to place orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(o => {
            const coverImg = o.products?.photo_urls?.[0]
            const pCode = o.products?.code || '—'
            const pName = o.products?.name || 'Jewelry Piece'
            const isOverdue = o.status === 'payment_pending' && new Date(o.payment_deadline) < new Date()

            return (
              <Link
                key={o.id}
                href={`/portal/reseller/orders/${o.id}`}
                className="block bg-white border border-stone-200 hover:border-amber-600 rounded-2xl p-4 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-4">
                  {coverImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImg}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-stone-150 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 border border-stone-150 text-stone-400 font-bold text-xs uppercase">
                      SKU
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-stone-900 text-sm font-mono">{o.order_number}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${STATUS_CLASSES[o.status] || 'bg-stone-50 border-stone-250'}`}>
                        {ORDER_STATUS_LABELS[o.status] || o.status}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-stone-850 truncate">{pCode} · {pName}</p>
                    <p className="text-[10px] text-stone-450 mt-1">
                      Qty: {o.quantity} · Customer: {o.shipping_name} · Ordered: {new Date(o.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Selling Price</p>
                    <p className="text-sm font-black text-green-650 mt-1">₹{(o.customer_selling_price_paise / 100).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-stone-450 mt-0.5">Profit: ₹{(o.reseller_earnings_paise / 100).toLocaleString('en-IN')}</p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-600 transition-colors shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
