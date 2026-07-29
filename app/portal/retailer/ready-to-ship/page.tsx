'use client'

import { useEffect, useState } from 'react'
import { Package, Tag, Send } from 'lucide-react'

type Item = {
  id: string
  karat: number
  gross_weight: number
  pure_24kt_weight: number | null
  diamond_specs: Record<string, unknown>
  photos: string[]
  list_price: number
  product?: { id: string; code: string; name: string; photo_urls: string[] | null } | null
  my_offer?: {
    id: string; offer_price: number; status: string; counter_price: number | null; counter_note: string | null
  } | null
}

export default function RetailerReadyToShipPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState('')
  const [openItem, setOpenItem] = useState<Item | null>(null)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerNote, setOfferNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setItems(null); setError('')
    try {
      const r = await fetch('/api/portal/retailer/ready-to-ship')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setItems(j.items || [])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function submitOffer() {
    if (!openItem) return
    const price = Number(offerPrice)
    if (!price || price <= 0) { alert('Enter a valid offer price'); return }
    setSubmitting(true)
    const r = await fetch(`/api/portal/retailer/ready-to-ship/${openItem.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_price: price, note: offerNote || null }),
    })
    const j = await r.json()
    setSubmitting(false)
    if (!r.ok) { alert(j.error || 'Failed'); return }
    setOpenItem(null); setOfferPrice(''); setOfferNote('')
    load()
  }

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-stone-800/15 text-stone-800 flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Ready to Ship</h1>
          <p className="text-stone-500 text-sm">Finished pieces available now. Place an offer — we'll respond on WhatsApp.</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

      {items === null ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm">No ready-to-ship pieces right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(it => {
            const photo = it.photos?.[0] || it.product?.photo_urls?.[0]
            const myStatus = it.my_offer?.status
            return (
              <div key={it.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="aspect-square bg-stone-100 relative overflow-hidden">
                  {photo ? (
                    <img src={photo} alt={it.product?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-stone-400">{it.product?.code || 'Ready piece'}</p>
                  <p className="text-sm font-medium text-stone-800 truncate">{it.product?.name || `${it.karat}kt piece`}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{it.karat}kt · {Number(it.gross_weight).toFixed(2)}g</p>
                  <p className="text-sm font-semibold text-stone-800 mt-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> ₹{Number(it.list_price).toLocaleString('en-IN')}
                  </p>
                  {myStatus && (
                    <p className={`text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block ${
                      myStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                      myStatus === 'countered' ? 'bg-blue-100 text-blue-700' :
                      myStatus === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-stone-100 text-stone-500'
                    }`}>
                      Your offer: ₹{Number(it.my_offer?.offer_price || 0).toLocaleString('en-IN')} ({myStatus})
                      {myStatus === 'countered' && it.my_offer?.counter_price ? ` → ₹${Number(it.my_offer.counter_price).toLocaleString('en-IN')}` : ''}
                    </p>
                  )}
                  <button onClick={() => { setOpenItem(it); setOfferPrice(String(it.list_price)); setOfferNote('') }}
                    className="w-full mt-2 bg-stone-800 hover:bg-stone-900 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1">
                    <Send className="w-3 h-3" /> {myStatus ? 'Revise offer' : 'Make an offer'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {openItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpenItem(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-900 mb-1">Make an offer</h3>
            <p className="text-sm text-stone-500 mb-4">{openItem.product?.name || `${openItem.karat}kt piece`} · listed at ₹{Number(openItem.list_price).toLocaleString('en-IN')}</p>
            <label className="block text-xs font-medium text-stone-500 mb-1">Your price (₹)</label>
            <input type="number" inputMode="decimal" value={offerPrice} onChange={e => setOfferPrice(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mb-3" />
            <label className="block text-xs font-medium text-stone-500 mb-1">Note (optional)</label>
            <textarea rows={3} value={offerNote} onChange={e => setOfferNote(e.target.value)}
              placeholder="Any special request or context..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setOpenItem(null)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm">Cancel</button>
              <button onClick={submitOffer} disabled={submitting}
                className="flex-1 bg-stone-800 hover:bg-stone-900 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {submitting ? 'Sending...' : 'Submit offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
