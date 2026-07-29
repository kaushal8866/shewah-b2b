'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ShoppingBag, ChevronRight, Plus, Clock } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  brief_received: 'bg-blue-100 text-blue-700',
  cad_in_progress: 'bg-purple-100 text-purple-700',
  cad_approved: 'bg-purple-100 text-purple-700',
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

export default function RetailerHome() {
  const [orders, setOrders] = useState<any[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/portal/retailer/orders?limit=5')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setOrders(d.orders || [])
      })
      .catch(e => setError(e.message))
  }, [])

  const open = (orders || []).filter(o => !['delivered', 'cancelled'].includes(o.status))

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Welcome</h1>
        <p className="text-stone-500 text-sm">Browse the catalog or track your orders</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link href="/portal/retailer/catalog"
          className="bg-white border border-stone-200 hover:border-stone-800 rounded-xl p-4 flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-stone-800/15 text-stone-800 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-stone-800 text-sm">Browse catalog</p>
            <p className="text-xs text-stone-400">View products and place orders</p>
          </div>
        </Link>
        <Link href="/portal/retailer/custom"
          className="bg-white border border-stone-200 hover:border-stone-800 rounded-xl p-4 flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-stone-800/15 text-stone-800 flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-stone-800 text-sm">Custom design</p>
            <p className="text-xs text-stone-400">Send a brief and reference images</p>
          </div>
        </Link>
        <Link href="/portal/retailer/orders"
          className="bg-white border border-stone-200 hover:border-stone-800 rounded-xl p-4 flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-stone-800/15 text-stone-800 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-stone-800 text-sm">My orders</p>
            <p className="text-xs text-stone-400">{open.length} in progress</p>
          </div>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-stone-900">Recent orders</h2>
        <Link href="/portal/retailer/orders" className="text-xs text-stone-800 hover:text-stone-900">View all →</Link>
      </div>

      {orders === null ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm mb-3">No orders yet.</p>
          <Link href="/portal/retailer/catalog"
            className="inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Package className="w-4 h-4" /> Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <Link key={o.id} href={`/portal/retailer/orders/${o.id}`}
              className="block bg-white border border-stone-200 hover:border-stone-800 rounded-xl px-4 py-3.5 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-stone-900 text-sm">{o.order_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] || 'bg-stone-100 text-stone-600'}`}>
                      {o.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 truncate">
                    {o.product?.name || o.brief_text || 'Custom order'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-stone-400">
                    {o.quantity > 1 && <span>Qty {o.quantity}</span>}
                    {o.expected_delivery && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {fmtDate(o.expected_delivery)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
