'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, Product } from '@/lib/supabase'
import { Plus, Search, Package, Edit2, Eye, EyeOff, Library, Heart, Trash2, Copy, Check, Globe, Lock, ChevronRight, Terminal, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

type Collection = {
  id: string
  created_at: string
  updated_at: string
  name: string
  description?: string
  circuit_target?: string
  is_published: boolean
  product_count?: number
  response_count?: number
}

type Interest = {
  id: string
  created_at: string
  partner_id?: string
  product_id?: string
  collection_id?: string
  note?: string
  quantity_hint?: number
  partners?: { store_name: string; city: string; phone: string }
  products?: { code: string; name: string }
  design_collections?: { name: string }
}

type TabKey = 'products' | 'collections' | 'interest'

function CatalogContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = (searchParams.get('tab') as TabKey) || 'products'
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam)

  function goTab(t: TabKey) {
    setActiveTab(t)
    router.replace(`/catalog?tab=${t}`, { scroll: false })
  }

  return (
    <div className="p-4 lg:p-7">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 overflow-x-auto">
          {([
            { key: 'products', label: 'Products', icon: Package },
            { key: 'collections', label: 'Collections', icon: Library },
            { key: 'interest', label: 'Interest', icon: Heart },
          ] as { key: TabKey; label: string; icon: LucideIcon }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => goTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'products' && (
          <Link href="/catalog/new"
            className="flex items-center gap-2 bg-[#C49C64] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors shrink-0">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add product</span><span className="sm:hidden">Add</span>
          </Link>
        )}
        {activeTab === 'collections' && (
          <Link href="/catalog/collections/new"
            className="flex items-center gap-2 bg-[#C49C64] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors shrink-0">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">New collection</span><span className="sm:hidden">New</span>
          </Link>
        )}
      </div>

      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'collections' && <CollectionsTab />}
      {activeTab === 'interest' && <InterestTab />}
    </div>
  )
}

/* ─── Products Tab ─────────────────────────────────────────────────── */
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [karatFilter, setKaratFilter] = useState('all')
  const [shapeFilter, setShapeFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('code')
    setProducts(data || [])
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    load()
  }

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.diamond_shape?.toLowerCase().includes(search.toLowerCase())
    const matchKarat = karatFilter === 'all' || String(p.gold_karat) === karatFilter
    const matchShape = shapeFilter === 'all' || p.diamond_shape === shapeFilter
    const matchActive = showInactive || p.is_active
    return matchSearch && matchKarat && matchShape && matchActive
  })

  const shapes = Array.from(new Set(products.map(p => p.diamond_shape).filter((s): s is string => Boolean(s))))
  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    k14: products.filter(p => p.gold_karat === 14).length,
    k18: products.filter(p => p.gold_karat === 18).length,
  }

  return (
    <>
      <div className="mb-1">
        <h1 className="text-xl font-semibold text-stone-900">Catalog</h1>
        <p className="text-stone-500 text-sm">{stats.active} active designs</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-5">
        {[
          { label: 'Total designs', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: '14K designs', value: stats.k14 },
          { label: '18K designs', value: stats.k18 },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-400">{s.label}</p>
            <p className="text-2xl font-semibold text-stone-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search by name, code, shape..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white" />
        </div>
        <select value={karatFilter} onChange={e => setKaratFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
          <option value="all">All karats</option>
          <option value="14">14K gold</option>
          <option value="18">18K gold</option>
        </select>
        <select value={shapeFilter} onChange={e => setShapeFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
          <option value="all">All shapes</option>
          {shapes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${showInactive ? 'bg-stone-100 border-stone-300 text-stone-700' : 'border-stone-200 text-stone-400 hover:text-stone-600'}`}>
          {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showInactive ? 'Hiding inactive' : 'Show inactive'}
        </button>
      </div>
      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading catalog...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">{products.length === 0 ? 'No products yet — add your first ring design' : 'No products match your filters'}</p>
          {products.length === 0 && <Link href="/catalog/new" className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">Add first product →</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${p.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
              <div className="aspect-square bg-gradient-to-br from-stone-50 to-yellow-50 flex items-center justify-center relative">
                {p.photo_urls && p.photo_urls.length > 0 ? (
                  <img src={p.photo_urls[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center"><div className="text-4xl mb-1">◆</div><p className="text-xs text-stone-300">{p.code}</p></div>
                )}
                {!p.is_active && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <span className="bg-stone-200 text-stone-500 text-xs px-2 py-1 rounded-full">Inactive</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-white text-stone-600 text-xs px-2 py-0.5 rounded-full border border-stone-200 font-medium">{p.code}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium text-stone-900 text-sm">{p.name}</p>
                  <span className="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full">{p.gold_karat}K</span>
                </div>
                <p className="text-xs text-stone-400 mb-3">{p.diamond_weight}ct {p.diamond_shape} · {p.diamond_quality}/{p.diamond_color}</p>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  <div className="bg-stone-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-stone-400">Trade</p>
                    <p className="text-xs font-semibold text-stone-700">{p.trade_price ? `₹${(p.trade_price/1000).toFixed(0)}K` : '—'}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-stone-400">MRP</p>
                    <p className="text-xs font-semibold text-stone-700">{p.mrp_suggested ? `₹${(p.mrp_suggested/1000).toFixed(0)}K` : '—'}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-green-600">Margin</p>
                    <p className="text-xs font-semibold text-green-700">{p.trade_price && p.mrp_suggested ? `₹${((p.mrp_suggested - p.trade_price)/1000).toFixed(0)}K` : '—'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-400">{p.delivery_days} days delivery</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleActive(p.id, p.is_active)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                      title={p.is_active ? 'Deactivate' : 'Activate'}>
                      {p.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <Link href={`/catalog/${p.id}`} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

type RawCollectionRow = Omit<Collection, 'product_count' | 'response_count'> & {
  design_collection_products: { count: number }[]
  design_interests: { count: number }[]
}

/* ─── Collections Tab ──────────────────────────────────────────────── */
function CollectionsTab() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/collections')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err?.error?.includes('does not exist') || res.status === 500) setNeedsSetup(true)
        setLoading(false)
        return
      }
      const data: RawCollectionRow[] = await res.json()
      const mapped = data.map(c => ({
        ...c,
        product_count: c.design_collection_products?.[0]?.count ?? 0,
        response_count: c.design_interests?.[0]?.count ?? 0,
      }))
      setCollections(mapped)
    } catch {
      setNeedsSetup(true)
    }
    setLoading(false)
  }

  async function togglePublish(id: string, current: boolean) {
    await fetch(`/api/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection? Partner interest data for this collection will be unlinked.')) return
    setDeleting(id)
    await fetch(`/api/collections/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  if (loading) return <div className="py-16 text-center text-stone-400 text-sm">Loading collections...</div>

  if (needsSetup) {
    return (
      <div className="max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 mb-1">One-time database setup required</p>
              <p className="text-sm text-amber-700 mb-4">The Collections feature needs 3 new tables. Run this SQL in your Supabase Dashboard → SQL Editor → New query, then click Refresh.</p>
              <div className="bg-white border border-amber-200 rounded-lg p-3 mb-4">
                <pre className="text-xs text-stone-700 whitespace-pre-wrap font-mono overflow-auto max-h-48">
                  {`-- Paste the contents of scripts/setup_collections.sql`}
                </pre>
                <p className="text-xs text-stone-400 mt-2">Full SQL is in <code className="bg-stone-100 px-1 rounded">scripts/setup_collections.sql</code> in the project files</p>
              </div>
              <button onClick={load}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
                <RefreshCw className="w-4 h-4" /> Refresh after running SQL
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-stone-900">Design Collections</h2>
        <p className="text-stone-500 text-sm">Curate lookbooks to share with partners and track their interest</p>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Library className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm mb-4">No collections yet. Create your first lookbook to share with partners.</p>
          <Link href="/catalog/collections/new"
            className="inline-flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40]">
            <Plus className="w-4 h-4" /> Create first collection
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-medium text-stone-900 text-sm">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                      {c.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {c.description && <p className="text-xs text-stone-400 mb-1 truncate">{c.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-stone-400 flex-wrap">
                    {c.circuit_target && <span>📍 {c.circuit_target}</span>}
                    <span>{c.product_count} product{c.product_count !== 1 ? 's' : ''}</span>
                    <span className="text-[#C49C64] font-medium">{c.response_count} response{c.response_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                  className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={() => togglePublish(c.id, c.is_published)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${c.is_published ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                  title={c.is_published ? 'Unpublish' : 'Publish'}>
                  {c.is_published ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {c.is_published ? 'Published' : 'Publish'}
                </button>
                <Link href={`/catalog/collections/${c.id}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50">
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Interest Tab ─────────────────────────────────────────────────── */
function InterestTab() {
  const [interests, setInterests] = useState<Interest[]>([])
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [collFilter, setCollFilter] = useState('all')
  const [prodFilter, setProdFilter] = useState('all')

  useEffect(() => {
    Promise.all([loadInterests(), loadFilters()])
  }, [])

  async function loadFilters() {
    const [{ data: cols }, { data: prods }] = await Promise.all([
      supabase.from('design_collections').select('id, name').order('name'),
      supabase.from('products').select('id, code, name').eq('is_active', true).order('code'),
    ])
    setCollections(cols || [])
    setProducts(prods || [])
  }

  async function loadInterests() {
    setLoading(true)
    try {
      const res = await fetch('/api/interests')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err?.error?.includes('does not exist') || res.status === 500) setNeedsSetup(true)
        setLoading(false)
        return
      }
      setInterests(await res.json())
    } catch {
      setNeedsSetup(true)
    }
    setLoading(false)
  }

  const filtered = interests.filter(i => {
    if (collFilter !== 'all' && i.collection_id !== collFilter) return false
    if (prodFilter !== 'all' && i.product_id !== prodFilter) return false
    return true
  })

  if (loading) return <div className="py-16 text-center text-stone-400 text-sm">Loading interest data...</div>

  if (needsSetup) {
    return (
      <div className="max-w-lg py-8">
        <p className="text-stone-400 text-sm text-center">Run the Collections setup SQL first, then this tab will show partner interest.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Partner Interest</h2>
            <p className="text-stone-500 text-sm">{interests.length} total shortlists from partners</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={collFilter} onChange={e => setCollFilter(e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
              <option value="all">All collections</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={prodFilter} onChange={e => setProdFilter(e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
              <option value="all">All products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Heart className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">
            {interests.length === 0
              ? 'No partner interests yet. Share a published collection link with partners to start collecting preferences.'
              : 'No interests match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Partner</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Design</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Collection</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Note / Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{i.partners?.store_name || '—'}</p>
                      <p className="text-xs text-stone-400">{i.partners?.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-stone-700">{i.products?.name || '—'}</p>
                      <p className="text-xs text-stone-400">{i.products?.code}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{i.design_collections?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {i.note && <p className="text-stone-600 text-xs italic">"{i.note}"</p>}
                      {i.quantity_hint && <p className="text-xs text-stone-400">Qty: {i.quantity_hint}</p>}
                      {!i.note && !i.quantity_hint && <span className="text-stone-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">{new Date(i.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/orders/new${i.partner_id ? `?partner_id=${i.partner_id}${i.product_id ? `&product_id=${i.product_id}` : ''}` : ''}`}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-[#C49C64] text-white hover:bg-[#9B7A40] transition-colors whitespace-nowrap">
                          → Order
                        </Link>
                        <Link
                          href={`/cad-requests/new${i.partner_id ? `?partner_id=${i.partner_id}${i.product_id ? `&product_id=${i.product_id}` : ''}` : ''}`}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors whitespace-nowrap">
                          → CAD
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="divide-y divide-stone-50">
              {filtered.map(i => (
                <div key={i.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">{i.partners?.store_name || '—'}</p>
                      <p className="text-xs text-stone-400">{i.partners?.city}</p>
                    </div>
                    <p className="text-xs text-stone-400 shrink-0">{new Date(i.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <p className="text-sm text-stone-700">{i.products?.name || '—'} <span className="text-xs text-stone-400">{i.products?.code}</span></p>
                  {i.design_collections?.name && <p className="text-xs text-stone-400 mt-0.5">{i.design_collections.name}</p>}
                  {i.note && <p className="text-xs text-stone-500 italic mt-0.5">"{i.note}"</p>}
                  <div className="flex gap-2 mt-2.5">
                    <Link
                      href={`/orders/new${i.partner_id ? `?partner_id=${i.partner_id}${i.product_id ? `&product_id=${i.product_id}` : ''}` : ''}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-[#C49C64] text-white hover:bg-[#9B7A40] transition-colors">
                      → Order
                    </Link>
                    <Link
                      href={`/cad-requests/new${i.partner_id ? `?partner_id=${i.partner_id}${i.product_id ? `&product_id=${i.product_id}` : ''}` : ''}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
                      → CAD
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Page wrapper (Suspense for useSearchParams) ──────────────────── */
export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <CatalogContent />
    </Suspense>
  )
}
