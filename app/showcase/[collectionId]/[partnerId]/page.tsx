'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Heart, CheckCircle2, Loader2, AlertTriangle, Package, MessageSquare, Hash, Send, Sparkles } from 'lucide-react'

type Collection = {
  id: string
  name: string
  description?: string
  circuit_target?: string
  is_published: boolean
}

type Product = {
  id: string
  code: string
  name: string
  gold_karat?: number
  diamond_shape?: string
  trade_price?: number
  photo_urls?: string[]
  is_active: boolean
}

type Partner = {
  id: string
  store_name: string
  owner_name: string
  city: string
}

type InterestRow = {
  id?: string
  product_id: string
  note?: string
  quantity_hint?: number
}

type RawInterestRow = {
  id: string
  product_id: string
  note: string | null
  quantity_hint: number | null
}

type RawCollectionProduct = {
  product_id: string
  sort_order: number
}

type Status = 'loading' | 'not_found' | 'unpublished' | 'ready' | 'submitted'

export default function ShowcasePage() {
  const params = useParams()
  const collectionId = params.collectionId as string
  const partnerId = params.partnerId as string

  const [status, setStatus] = useState<Status>('loading')
  const [collection, setCollection] = useState<Collection | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [interests, setInterests] = useState<Map<string, InterestRow>>(new Map())
  const [activeNote, setActiveNote] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const [{ data: coll }, { data: part }] = await Promise.all([
      supabase.from('design_collections').select('*').eq('id', collectionId).single(),
      supabase.from('partners').select('id, store_name, owner_name, city').eq('id', partnerId).single(),
    ])

    if (!coll || !part) { setStatus('not_found'); return }
    if (!coll.is_published) { setStatus('unpublished'); return }

    setCollection(coll as Collection)
    setPartner(part as Partner)

    const { data: collProds } = await supabase
      .from('design_collection_products')
      .select('product_id, sort_order')
      .eq('collection_id', collectionId)
      .order('sort_order')

    if (collProds && collProds.length > 0) {
      const typedProds = collProds as RawCollectionProduct[]
      const ids = typedProds.map(r => r.product_id)
      const { data: prods } = await supabase
        .from('products')
        .select('id, code, name, gold_karat, diamond_shape, trade_price, photo_urls, is_active')
        .in('id', ids)
      const sorted = (prods as Product[] || []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      setProducts(sorted)
    }

    const interestsRes = await fetch(
      `/api/showcase/interests?collection_id=${encodeURIComponent(collectionId)}&partner_id=${encodeURIComponent(partnerId)}`
    ).then(r => r.ok ? r.json() as Promise<RawInterestRow[]> : Promise.resolve([]))

    const existingInterests: RawInterestRow[] = Array.isArray(interestsRes) ? interestsRes : []
    if (existingInterests.length) {
      const map = new Map<string, InterestRow>()
      existingInterests.forEach(row => {
        map.set(row.product_id, {
          id: row.id,
          product_id: row.product_id,
          note: row.note ?? '',
          quantity_hint: row.quantity_hint ?? undefined,
        })
      })
      setInterests(map)
    }

    setStatus('ready')

    fetch('/api/showcase/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection_id: collectionId, partner_id: partnerId }),
    }).catch(() => {})
  }, [collectionId, partnerId])

  useEffect(() => { load() }, [load])

  async function toggleInterest(product: Product) {
    const hasInterest = interests.has(product.id)
    setSaving(prev => new Set(prev).add(product.id))

    if (hasInterest) {
      const row = interests.get(product.id)!
      if (row.id) {
        await fetch('/api/showcase/interests', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.id, partner_id: partnerId }),
        })
      }
      setInterests(prev => {
        const next = new Map(prev)
        next.delete(product.id)
        return next
      })
      if (activeNote === product.id) setActiveNote(null)
    } else {
      const res = await fetch('/api/showcase/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId, partner_id: partnerId, product_id: product.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setInterests(prev => {
          const next = new Map(prev)
          next.set(product.id, { id: data.id, product_id: product.id, note: '', quantity_hint: undefined })
          return next
        })
      }
    }

    setSaving(prev => {
      const next = new Set(prev)
      next.delete(product.id)
      return next
    })
  }

  async function updateNote(productId: string, field: 'note' | 'quantity_hint', value: string | number | null) {
    const row = interests.get(productId)
    if (!row?.id) return

    const update: { note?: string | null; quantity_hint?: number | null } = {}
    if (field === 'note') update.note = value === '' ? null : (value as string)
    if (field === 'quantity_hint') update.quantity_hint = value === '' ? null : (value as number | null)

    setInterests(prev => {
      const next = new Map(prev)
      const existing = next.get(productId)!
      if (field === 'note') next.set(productId, { ...existing, note: (value ?? '') as string })
      else next.set(productId, { ...existing, quantity_hint: value === '' ? undefined : (value as number | undefined) })
      return next
    })

    fetch('/api/showcase/interests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, partner_id: partnerId, ...update }),
    }).catch(() => {})
  }

  async function handleSubmit() {
    if (interests.size === 0) return
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 600))
    setSubmitting(false)
    setStatus('submitted')
  }

  const shortlistedCount = interests.size

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#C49C64]" />
          <p className="text-sm">Loading your collection preview…</p>
        </div>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center text-stone-400 max-w-sm">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-stone-600" />
          <h1 className="text-white text-lg font-semibold mb-2">Link not found</h1>
          <p className="text-sm">This preview link is invalid or may have expired. Please contact your Shewah representative.</p>
        </div>
      </div>
    )
  }

  if (status === 'unpublished') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center text-stone-400 max-w-sm">
          <Package className="w-10 h-10 mx-auto mb-3 text-stone-600" />
          <h1 className="text-white text-lg font-semibold mb-2">Collection coming soon</h1>
          <p className="text-sm">This collection is not yet available. Check back later or contact your Shewah representative.</p>
        </div>
      </div>
    )
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-[#C49C64]/20 border-2 border-[#C49C64]/40 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-9 h-9 text-[#C49C64]" />
          </div>
          <h1 className="text-white text-2xl font-semibold mb-3">Shortlist submitted!</h1>
          <p className="text-stone-400 text-sm leading-relaxed mb-2">
            Thank you, <span className="text-white font-medium">{partner?.store_name}</span>. 
            Your shortlist of <span className="text-[#C49C64] font-semibold">{shortlistedCount} design{shortlistedCount !== 1 ? 's' : ''}</span> has been received.
          </p>
          <p className="text-stone-500 text-sm leading-relaxed mb-8">
            Our team will review your preferences and follow up with you shortly.
          </p>
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-left">
            <p className="text-stone-400 text-xs mb-3 uppercase tracking-wider">Your shortlisted designs</p>
            <ul className="space-y-2">
              {products.filter(p => interests.has(p.id)).map(p => {
                const row = interests.get(p.id)
                return (
                  <li key={p.id} className="flex items-start gap-2">
                    <Heart className="w-3.5 h-3.5 text-[#C49C64] fill-[#C49C64] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white text-sm">{p.name}</span>
                      {row?.quantity_hint && <span className="text-stone-500 text-xs ml-2">× {row.quantity_hint}</span>}
                      {row?.note && <p className="text-stone-500 text-xs mt-0.5 italic">&ldquo;{row.note}&rdquo;</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="text-stone-600 text-xs mt-6">You may close this page. You can revisit this link at any time to update your selections.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 pb-32">
      {/* Header */}
      <div className="bg-stone-900 border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#C49C64] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">◆</span>
            </div>
            <div>
              <p className="text-[#C49C64] text-xs font-medium tracking-wider uppercase">Shewah Jewellery</p>
              <p className="text-stone-400 text-xs">Exclusive Design Preview</p>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold mb-1">{collection?.name}</h1>
          {collection?.description && (
            <p className="text-stone-400 text-sm mb-3">{collection.description}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-stone-800" />
            <p className="text-stone-500 text-xs whitespace-nowrap">
              For {partner?.store_name}{partner?.city ? `, ${partner.city}` : ''}
            </p>
            <div className="h-px flex-1 bg-stone-800" />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-2">
        <div className="bg-[#C49C64]/10 border border-[#C49C64]/20 rounded-xl px-4 py-3 text-[#C49C64] text-xs">
          Tap the <span className="font-semibold">heart button</span> on any design to add it to your shortlist.
          Add notes or quantity for each item — your selections are saved automatically.
          Tap <span className="font-semibold">Submit shortlist</span> when you&apos;re done.
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {products.length === 0 ? (
          <div className="text-center py-16 text-stone-600">
            <Package className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm">No products in this collection yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(product => {
              const isShortlisted = interests.has(product.id)
              const isSaving = saving.has(product.id)
              const interestRow = interests.get(product.id)
              const showNote = activeNote === product.id

              return (
                <div key={product.id}
                  className={`bg-stone-900 rounded-2xl overflow-hidden border transition-all ${
                    isShortlisted
                      ? 'border-[#C49C64] shadow-lg shadow-[#C49C64]/10'
                      : 'border-stone-800'
                  }`}>
                  {/* Photo */}
                  <div className="relative aspect-square bg-stone-800">
                    {product.photo_urls && product.photo_urls.length > 0 ? (
                      <img
                        src={product.photo_urls[0]}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600">
                        <span className="text-3xl">◆</span>
                      </div>
                    )}
                    {isShortlisted && (
                      <div className="absolute top-2 left-2 bg-[#C49C64] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        Shortlisted
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-stone-500 text-xs">{product.code}</p>
                    <p className="text-white text-sm font-medium leading-tight mt-0.5 mb-1 line-clamp-2">{product.name}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {product.gold_karat && (
                        <span className="bg-stone-800 text-stone-400 text-xs px-2 py-0.5 rounded-full">{product.gold_karat}K</span>
                      )}
                      {product.diamond_shape && (
                        <span className="bg-stone-800 text-stone-400 text-xs px-2 py-0.5 rounded-full">{product.diamond_shape}</span>
                      )}
                      {product.trade_price && (
                        <span className="bg-stone-800 text-[#C49C64] text-xs px-2 py-0.5 rounded-full">
                          ₹{product.trade_price >= 100000 ? `${(product.trade_price / 100000).toFixed(1)}L` : `${Math.round(product.trade_price / 1000)}K`}
                        </span>
                      )}
                    </div>

                    {/* Note fields (shown when shortlisted and expanded) */}
                    {isShortlisted && showNote && (
                      <div className="mb-2 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <input
                            type="number"
                            placeholder="Qty"
                            min={1}
                            value={interestRow?.quantity_hint ?? ''}
                            onChange={e => updateNote(product.id, 'quantity_hint', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-stone-800 text-white text-xs px-2 py-1.5 rounded-lg border border-stone-700 outline-none focus:border-[#C49C64] placeholder-stone-600"
                          />
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-1.5" />
                          <textarea
                            placeholder="Any specifics? karat, quantity, occasion…"
                            value={interestRow?.note ?? ''}
                            onChange={e => updateNote(product.id, 'note', e.target.value)}
                            rows={2}
                            className="w-full bg-stone-800 text-white text-xs px-2 py-1.5 rounded-lg border border-stone-700 outline-none focus:border-[#C49C64] placeholder-stone-600 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleInterest(product)}
                        disabled={isSaving}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          isShortlisted
                            ? 'bg-[#C49C64] text-white hover:bg-[#9B7A40]'
                            : 'bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700'
                        } disabled:opacity-50`}>
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Heart className={`w-3.5 h-3.5 ${isShortlisted ? 'fill-white' : ''}`} />
                        )}
                        {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                      </button>
                      {isShortlisted && (
                        <button
                          onClick={() => setActiveNote(activeNote === product.id ? null : product.id)}
                          className={`p-2.5 rounded-xl text-xs transition-colors ${
                            showNote
                              ? 'bg-stone-700 text-white'
                              : 'bg-stone-800 text-stone-500 hover:text-white hover:bg-stone-700'
                          }`}
                          title="Add note / quantity">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur-sm border-t border-stone-800 px-4 py-4 z-20">
        <div className="max-w-4xl mx-auto">
          {shortlistedCount === 0 ? (
            <div className="text-stone-500 text-sm text-center py-1">
              Tap the <Heart className="w-3.5 h-3.5 inline mx-0.5" /> to shortlist designs you&apos;re interested in
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#C49C64] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{shortlistedCount}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{shortlistedCount} design{shortlistedCount !== 1 ? 's' : ''} shortlisted</p>
                  <p className="text-stone-500 text-xs">Saved automatically</p>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-[#C49C64] hover:bg-[#9B7A40] disabled:opacity-60 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all shrink-0 active:scale-95">
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit shortlist ({shortlistedCount})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
