'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingBag, ChevronRight, Clock } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  brief_received: 'Brief received',
  cad_in_progress: 'CAD in progress',
  cad_sent: 'CAD ready to review',
  cad_approved: 'CAD approved',
  design_approved: 'Design approved',
  in_production: 'In production',
  qc: 'Quality check',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  brief_received: 'bg-blue-100 text-blue-700',
  cad_in_progress: 'bg-purple-100 text-purple-700',
  cad_sent: 'bg-purple-100 text-purple-700',
  cad_approved: 'bg-purple-100 text-purple-700',
  design_approved: 'bg-purple-100 text-purple-700',
  in_production: 'bg-amber-100 text-amber-700',
  qc: 'bg-amber-100 text-amber-700',
  dispatched: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

type Row = {
  id: string
  order_number: string
  type: string
  quantity: number
  status: string
  total_amount: number
  balance_due: number
  order_date: string
  expected_delivery: string
  brief_text?: string | null
  product?: { code: string; name: string; photo_urls?: string[] } | null
}

export default function RetailerOrdersPage() {
  const [orders, setOrders] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'open' | 'delivered' | 'all'>('open')

  useEffect(() => {
    fetch('/api/portal/retailer/orders')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setOrders(d.orders || [])
      })
      .catch(e => setError(e.message))
  }, [])

  const filtered = (orders || []).filter(o => {
    if (filter === 'open') return !['delivered', 'cancelled'].includes(o.status)
    if (filter === 'delivered') return o.status === 'delivered'
    return true
  })

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/15 text-[#1E3A5F] flex items-center justify-center">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">My orders</h1>
          <p className="text-stone-500 text-sm">Track every order placed by your store</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-5 w-fit">
        {[
          { id: 'open' as const, label: `Open (${(orders || []).filter(o => !['delivered', 'cancelled'].includes(o.status)).length})` },
          { id: 'delivered' as const, label: `Delivered (${(orders || []).filter(o => o.status === 'delivered').length})` },
          { id: 'all' as const, label: `All (${(orders || []).length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {orders === null ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm mb-3">No orders to show.</p>
          <Link href="/portal/retailer" className="text-sm text-[#1E3A5F] hover:underline">Browse the catalog →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const photo = o.product?.photo_urls?.[0]
            return (
              <Link key={o.id} href={`/portal/retailer/orders/${o.id}`}
                className="flex items-center gap-3 bg-white border border-stone-200 hover:border-[#1E3A5F] rounded-xl p-3 transition-colors">
                <div className="w-14 h-14 rounded-lg bg-stone-50 overflow-hidden shrink-0 flex items-center justify-center">
                  {photo ? (
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-stone-300">◆</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-medium text-stone-900 text-sm">{o.order_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] || 'bg-stone-100 text-stone-600'}`}>
                      {STATUS_LABEL[o.status] || o.status?.replace(/_/g, ' ')}
                    </span>
                    {o.type === 'custom' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">CUSTOM</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-700 truncate">
                    {o.product ? `${o.product.code} — ${o.product.name}` : (o.brief_text || 'Custom design request')}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-stone-400">
                    <span>Qty {o.quantity}</span>
                    <span>₹{(o.total_amount || 0).toLocaleString('en-IN')}</span>
                    {o.balance_due > 0 && (
                      <span className="text-amber-600">₹{o.balance_due.toLocaleString('en-IN')} due</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due {fmtDate(o.expected_delivery)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
