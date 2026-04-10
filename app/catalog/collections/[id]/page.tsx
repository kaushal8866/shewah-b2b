'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Globe, Lock, Trash2, Copy, Check, Search, Package, X, Eye } from 'lucide-react'
import Link from 'next/link'

type Collection = {
  id: string
  name: string
  description?: string
  circuit_target?: string
  is_published: boolean
  created_at: string
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
  circuit?: string
  stage: string
}

const CIRCUITS = ['Gujarat', 'Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'Delhi NCR', 'Punjab', 'Karnataka', 'Tamil Nadu', 'Other']

export default function CollectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [collection, setCollection] = useState<Collection | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [partners, setPartners] = useState<Partner[]>([])
  const [viewCounts, setViewCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProducts, setSavingProducts] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [showPartnerLinks, setShowPartnerLinks] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', circuit_target: '' })

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: coll }, { data: prods }, { data: collProds }, { data: parts }, viewsRes] = await Promise.all([
      supabase.from('design_collections').select('*').eq('id', id).single(),
      supabase.from('products').select('id, code, name, gold_karat, diamond_shape, trade_price, photo_urls, is_active').order('code'),
      supabase.from('design_collection_products').select('product_id').eq('collection_id', id),
      supabase.from('partners').select('id, store_name, owner_name, city, circuit, stage').order('store_name'),
      fetch(`/api/collections/${id}/views`).then(r => r.ok ? r.json() as Promise<{ partner_id: string | null }[]> : Promise.resolve([])),
    ])
    if (!coll) { router.push('/catalog?tab=collections'); return }
    setCollection(coll)
    setForm({ name: coll.name, description: coll.description || '', circuit_target: coll.circuit_target || '' })
    setAllProducts(prods || [])
    setSelectedIds(new Set((collProds || []).map((p: { product_id: string }) => p.product_id)))
    setPartners(parts || [])
    const views = Array.isArray(viewsRes) ? viewsRes : []
    if (views.length) {
      const counts = new Map<string, number>()
      views.forEach((v: { partner_id: string | null }) => {
        if (v.partner_id) counts.set(v.partner_id, (counts.get(v.partner_id) || 0) + 1)
      })
      setViewCounts(counts)
    }
    setLoading(false)
  }

  function setF(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required'); return }
    setSaving(true)
    const res = await fetch(`/api/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), description: form.description || null, circuit_target: form.circuit_target || null }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { alert('Error: ' + (json.error || res.statusText)); return }
    load()
  }

  async function handlePublishToggle() {
    if (!collection) return
    const newVal = !collection.is_published
    const res = await fetch(`/api/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: newVal }),
    })
    if (!res.ok) { const j = await res.json(); alert('Error: ' + (j.error || res.statusText)); return }
    load()
    if (newVal) setShowPartnerLinks(true)
  }

  async function handleDelete() {
    if (!confirm('Delete this collection permanently? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { const j = await res.json(); alert('Error: ' + (j.error || res.statusText)); return }
    router.push('/catalog?tab=collections')
  }

  function toggleProduct(productId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function saveProducts() {
    setSavingProducts(true)
    const res = await fetch(`/api/collections/${id}/products`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: Array.from(selectedIds) }),
    })
    setSavingProducts(false)
    if (!res.ok) { const j = await res.json(); alert('Error saving products: ' + (j.error || res.statusText)); return }
    load()
  }

  async function copyLink(partnerId: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/showcase/${id}/${partnerId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(partnerId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredProducts = allProducts.filter(p =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  )

  const activePartners = partners.filter(p => p.stage === 'active' || p.stage === 'sample_sent')
  const filteredPartners = collection?.circuit_target
    ? activePartners.filter(p => !p.circuit || p.circuit === collection.circuit_target)
    : activePartners

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>
  if (!collection) return null

  return (
    <div className="p-4 lg:p-7 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog?tab=collections" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{collection.name}</h1>
          <p className="text-stone-400 text-sm">{selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} · {collection.is_published ? 'Published' : 'Draft'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handlePublishToggle}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${collection.is_published ? 'border-stone-300 text-stone-600 hover:bg-stone-50' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
            {collection.is_published ? <><Lock className="w-4 h-4" /> Unpublish</> : <><Globe className="w-4 h-4" /> Publish</>}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="p-2 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Collection info */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-3">Collection details</h2>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Name *</label>
                <input className={inp} value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Description</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.description}
                  onChange={e => setF('description', e.target.value)} placeholder="Style, occasion, price range…" />
              </div>
              <div>
                <label className={lbl}>Target circuit</label>
                <select className={inp} value={form.circuit_target} onChange={e => setF('circuit_target', e.target.value)}>
                  <option value="">All circuits</option>
                  {CIRCUITS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {/* Partner links */}
          {collection.is_published && (
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <button onClick={() => setShowPartnerLinks(!showPartnerLinks)}
                className="w-full flex items-center justify-between">
                <h2 className="font-medium text-stone-900 text-sm">Partner links</h2>
                <span className="text-xs text-stone-400">{filteredPartners.length} partners {showPartnerLinks ? '▲' : '▼'}</span>
              </button>
              {showPartnerLinks && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-stone-400 mb-3">Copy a partner's personal link and paste it in WhatsApp. They open it to browse designs and shortlist their preferences.</p>
                  {filteredPartners.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No active partners{collection.circuit_target ? ` in ${collection.circuit_target}` : ''}.</p>
                  ) : (
                    filteredPartners.map(p => {
                      const views = viewCounts.get(p.id) || 0
                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-stone-700 truncate">{p.store_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-stone-400">{p.city}{p.circuit ? ` · ${p.circuit}` : ''}</p>
                              {views > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                  <Eye className="w-2.5 h-2.5" />{views}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => copyLink(p.id)}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${copiedId === p.id ? 'bg-green-100 text-green-700' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                            {copiedId === p.id ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
              {!showPartnerLinks && (
                <p className="text-xs text-stone-400 mt-2">
                  {collection.circuit_target ? `Showing ${collection.circuit_target} partners` : 'All active partners'}
                </p>
              )}
            </div>
          )}

          {!collection.is_published && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-500">
              <Globe className="w-4 h-4 mb-2 text-stone-400" />
              Publish this collection to generate shareable partner links.
            </div>
          )}
        </div>

        {/* Right: Product picker */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-medium text-stone-900 text-sm">Products in this collection</h2>
                <p className="text-xs text-stone-400 mt-0.5">{selectedIds.size} selected</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-stone-400" />
                  <input type="text" placeholder="Search…"
                    value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-stone-200 rounded-lg bg-white w-44" />
                  {productSearch && (
                    <button onClick={() => setProductSearch('')} className="absolute right-2 top-2 text-stone-300 hover:text-stone-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button onClick={saveProducts} disabled={savingProducts}
                  className="flex items-center gap-1.5 bg-[#C49C64] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors whitespace-nowrap">
                  <Save className="w-3.5 h-3.5" /> {savingProducts ? 'Saving…' : 'Save selection'}
                </button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 text-stone-200" />
                {allProducts.length === 0 ? 'No products in catalog yet.' : 'No products match search.'}
              </div>
            ) : (
              <div className="divide-y divide-stone-100 max-h-[520px] overflow-y-auto">
                {filteredProducts.map(p => {
                  const selected = selectedIds.has(p.id)
                  return (
                    <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-stone-50 ${selected ? 'bg-amber-50/50' : ''}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4 rounded border-stone-300 text-[#C49C64] accent-[#C49C64]" />
                      {p.photo_urls && p.photo_urls.length > 0 ? (
                        <img src={p.photo_urls[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-stone-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 text-stone-300 text-xs">◆</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-stone-400">{p.code}</span>
                          {!p.is_active && <span className="text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        </div>
                        <p className="text-sm text-stone-800 truncate">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.gold_karat}K{p.diamond_shape ? ` · ${p.diamond_shape}` : ''}{p.trade_price ? ` · ₹${Math.round(p.trade_price / 1000)}K` : ''}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
