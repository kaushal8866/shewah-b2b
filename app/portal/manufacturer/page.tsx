'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Factory, ChevronRight, Clock } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  quality_check: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  returned: 'bg-stone-200 text-stone-700',
  cancelled: 'bg-red-100 text-red-700',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

export default function ManufacturerPortalHome() {
  const [orders, setOrders] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'open' | 'all' | 'completed'>('open')

  useEffect(() => {
    fetch('/api/portal/manufacturer/orders')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setOrders(d.orders || [])
      })
      .catch(e => setError(e.message))
  }, [])

  const filtered = (orders || []).filter(o => {
    if (filter === 'open') return !['completed', 'cancelled', 'returned'].includes(o.status)
    if (filter === 'completed') return o.status === 'completed'
    return true
  })

  const counts = {
    open: (orders || []).filter(o => !['completed', 'cancelled', 'returned'].includes(o.status)).length,
    completed: (orders || []).filter(o => o.status === 'completed').length,
    all: (orders || []).length,
  }

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/15 text-[#1E3A5F] flex items-center justify-center">
          <Factory className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Your orders</h1>
          <p className="text-stone-500 text-sm">Manufacturing orders assigned to your workshop</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-5 w-fit">
        {[
          { id: 'open' as const, label: `Open (${counts.open})` },
          { id: 'completed' as const, label: `Completed (${counts.completed})` },
          { id: 'all' as const, label: `All (${counts.all})` },
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
          <p className="text-stone-400 text-sm">No orders to show.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <Link key={o.id} href={`/portal/manufacturer/orders/${o.id}`}
              className="block bg-white border border-stone-200 hover:border-[#1E3A5F] rounded-xl px-4 py-3.5 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-stone-900 text-sm">{o.order_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] || 'bg-stone-100 text-stone-600'}`}>
                      {o.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 truncate">{o.description || '—'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-stone-400">
                    {o.gold_karat && <span>{o.gold_karat}K</span>}
                    {o.gold_weight_required && <span>{o.gold_weight_required}g</span>}
                    {o.quantity > 1 && <span>Qty {o.quantity}</span>}
                    {o.expected_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Due {fmtDate(o.expected_date)}
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
