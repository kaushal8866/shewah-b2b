'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ChevronRight, Tag } from 'lucide-react'

type RtsItem = {
  id: string
  karat: number
  gross_weight: number
  pure_24kt_weight: number | null
  list_price: number
  original_cogs: number | null
  photos: string[]
  status: string
  created_at: string
  pending_offers: number
  product?: { id: string; code: string; name: string; photo_urls: string[] | null } | null
  source_mfg_order?: { id: string; order_number: string | null } | null
}

const STATUS_TABS = [
  { key: 'available', label: 'Available' },
  { key: 'sold', label: 'Sold' },
  { key: 'withdrawn', label: 'Withdrawn' },
]

export default function ReadyToShipPage() {
  const [items, setItems] = useState<RtsItem[] | null>(null)
  const [tab, setTab] = useState<'available' | 'sold' | 'withdrawn'>('available')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [tab])

  async function load() {
    setItems(null); setError('')
    try {
      const r = await fetch(`/api/ready-to-ship?status=${tab}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setItems(j.items || [])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/15 text-[#1E3A5F] flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Ready to Ship</h1>
          <p className="text-stone-500 text-sm">Finished pieces returned from cancelled orders, available to retailers.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-stone-200">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as 'available' | 'sold' | 'withdrawn')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-[#1E3A5F] text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

      {items === null ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(it => {
            const photo = it.photos?.[0] || it.product?.photo_urls?.[0]
            return (
              <Link key={it.id} href={`/ready-to-ship/${it.id}`}
                className="block bg-white border border-stone-200 hover:border-[#1E3A5F] rounded-xl overflow-hidden transition-colors">
                <div className="aspect-square bg-stone-100 relative overflow-hidden">
                  {photo ? (
                    <img src={photo} alt={it.product?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                  {it.pending_offers > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold bg-amber-400 text-stone-900 rounded-full px-2 py-0.5">
                      {it.pending_offers} offer{it.pending_offers === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-stone-400">{it.product?.code || 'No SKU'}</p>
                  <p className="text-sm font-medium text-stone-800 truncate">{it.product?.name || 'Unnamed piece'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-stone-500">{it.karat}kt · {Number(it.gross_weight).toFixed(2)}g</p>
                    <p className="text-sm font-semibold text-[#1E3A5F] flex items-center gap-1">
                      <Tag className="w-3 h-3" /> ₹{Number(it.list_price).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {it.source_mfg_order?.order_number && (
                    <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                      from {it.source_mfg_order.order_number} <ChevronRight className="w-3 h-3" />
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
