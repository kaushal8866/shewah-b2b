'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase, Product, computeOrderCogs } from '@/lib/supabase'
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
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] transition-colors shrink-0">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add product</span><span className="sm:hidden">Add</span>
          </Link>
        )}
        {activeTab === 'collections' && (
          <Link href="/catalog/collections/new"
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] transition-colors shrink-0">
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
  const [goldRate, setGoldRate] = useState<number | null>(null)
  const [marginFilter, setMarginFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'code' | 'margin_desc' | 'margin_asc'>('code')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: g }] = await Promise.all([
      supabase.from('products').select('*').order('code'),
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
    ])
    setProducts(data || [])
    if (g?.[0]) setGoldRate(g[0].rate_24k)
    setLoading(false)
  }

  function estimateForProduct(p: Product) {
    if (!goldRate || !p.gold_weight_g || !p.gold_karat || !p.trade_price) return null
    const { total_cogs, margin } = computeOrderCogs({
      gold_weight_actual: p.gold_weight_g,
      gold_rate_at_order: goldRate,
      gold_karat: p.gold_karat,
      making_charges: p.making_charges || 0,
      stone_cost: p.diamond_cost || 0,
      total_amount: p.trade_price,
    })
    const marginPct = p.trade_price > 0 ? (margin / p.trade_price) * 100 : 0
    return { total_cogs, margin, marginPct }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    load()
  }

  async function handleDeleteProduct(id: string, code: string) {
    if (!confirm(`Permanently delete product ${code}?\n\nThis cannot be undone. Collection links will be removed and partner-interest history will be unlinked. Past CAD requests pointing to this product will block deletion — use Deactivate instead in that case.`)) return
    setDeleting(id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    setDeleting(null)
    if (error) {
      const msg = (error as any)?.message || ''
      if (msg.includes('foreign key') || (error as any)?.code === '23503') {
        alert(`Can't delete ${code}: it's referenced by existing CAD requests or orders. Use the eye icon to deactivate it instead — it will disappear from the active catalog but historical records stay intact.`)
      } else {
        alert('Error: ' + msg)
      }
      return
    }
    load()
  }

  const filtered = useMemo(() => {
    const list = products.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.diamond_shape?.toLowerCase().includes(search.toLowerCase())
      const matchKarat = karatFilter === 'all' || String(p.gold_karat) === karatFilter
      const matchShape = shapeFilter === 'all' || p.diamond_shape === shapeFilter
      const matchActive = showInactive || p.is_active
      let matchMargin = true
      if (marginFilter !== 'all') {
        const est = estimateForProduct(p)
        const pct = est?.marginPct ?? null
        if (pct === null) matchMargin = false
        else if (marginFilter === 'high') matchMargin = pct >= 25
        else if (marginFilter === 'mid') matchMargin = pct >= 10 && pct < 25
        else if (marginFilter === 'low') matchMargin = pct < 10
      }
      return matchSearch && matchKarat && matchShape && matchActive && matchMargin
    })
    if (sortBy === 'margin_desc' || sortBy === 'margin_asc') {
      list.sort((a, b) => {
        const ea = estimateForProduct(a)?.marginPct ?? -Infinity
        const eb = estimateForProduct(b)?.marginPct ?? -Infinity
        return sortBy === 'margin_desc' ? eb - ea : ea - eb
      })
    }
    return list
  }, [products, search, karatFilter, shapeFilter, showInactive, marginFilter, sortBy, goldRate])

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
        <p className="text-stone-500 text-sm">
          {stats.active} active designs
          {goldRate ? <span className="ml-2 text-stone-400">· Margins estimated at today&apos;s 24K rate ₹{goldRate.toLocaleString('en-IN')}/g</span> : <span className="ml-2 text-amber-600">· Add today&apos;s gold rate to see margin estimates</span>}
        </p>
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
        <select value={marginFilter} onChange={e => setMarginFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" disabled={!goldRate}>
          <option value="all">All margins</option>
          <option value="high">High (≥25%)</option>
          <option value="mid">Mid (10–25%)</option>
          <option value="low">Low (&lt;10%)</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" disabled={!goldRate}>
          <option value="code">Sort: Code</option>
          <option value="margin_desc">Sort: Margin % (high→low)</option>
          <option value="margin_asc">Sort: Margin % (low→high)</option>
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
          {products.length === 0 && <Link href="/catalog/new" className="inline-block mt-3 text-sm text-[#1E3A5F] hover:underline">Add first product →</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const est = estimateForProduct(p)
            const pct = est?.marginPct
            const badgeClass = pct == null
              ? 'bg-stone-100 text-stone-400'
              : pct >= 25 ? 'bg-green-100 text-green-700'
              : pct >= 10 ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
            return (
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
                <div className="grid grid-cols-3 gap-1 mb-2">
                  <div className="bg-stone-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-stone-400">Trade</p>
                    <p className="text-xs font-semibold text-stone-700">{p.trade_price ? `₹${(p.trade_price/1000).toFixed(0)}K` : '—'}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-2 text-center" title="Estimated COGS at today's gold rate">
                    <p className="text-xs text-stone-400">Est. COGS</p>
                    <p className="text-xs font-semibold text-stone-700">{est ? `₹${(est.total_cogs/1000).toFixed(0)}K` : '—'}</p>
                  </div>
                  <div className={`rounded-lg p-2 text-center ${badgeClass}`} title="Estimated margin vs trade price">
                    <p className="text-xs opacity-80">Margin</p>
                    <p className="text-xs font-semibold">{est ? `${est.marginPct.toFixed(0)}%` : '—'}</p>
                  </div>
                </div>
                {est && (
                  <p className="text-[10px] text-stone-400 mb-2">≈ ₹{(est.margin/1000).toFixed(1)}K margin · MRP {p.mrp_suggested ? `₹${(p.mrp_suggested/1000).toFixed(0)}K` : '—'}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-400">{p.delivery_days} days delivery</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleActive(p.id, p.is_active)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                      title={p.is_active ? 'Deactivate' : 'Activate'}>
                      {p.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <Link href={`/catalog/${p.id}`} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                    <button onClick={() => handleDeleteProduct(p.id, p.code)} disabled={deleting === p.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete permanently">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
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
  const [avgMargins, setAvgMargins] = useState<Map<string, number>>(new Map())
  const [marginFilter, setMarginFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'margin_desc' | 'margin_asc'>('default')
  const [hasGoldRate, setHasGoldRate] = useState(false)

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
      void loadMargins()
    } catch {
      setNeedsSetup(true)
    }
    setLoading(false)
  }

  async function loadMargins() {
    try {
      const [{ data: links, error: linksErr }, { data: g, error: gErr }] = await Promise.all([
        supabase.from('design_collection_products').select('collection_id, products(gold_karat, gold_weight_g, making_charges, diamond_cost, trade_price)'),
        supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
      ])
      if (linksErr) { console.warn('loadMargins links error', linksErr.message); return }
      if (gErr) { console.warn('loadMargins gold rate error', gErr.message); return }
      const goldRate = g?.[0]?.rate_24k as number | undefined
      setHasGoldRate(!!goldRate)
      if (!goldRate || !links) return
      type LinkProduct = { gold_karat?: number; gold_weight_g?: number; making_charges?: number; diamond_cost?: number; trade_price?: number }
      type LinkRow = { collection_id: string; products: LinkProduct | LinkProduct[] | null }
      const buckets = new Map<string, number[]>()
      ;(links as unknown as LinkRow[]).forEach(l => {
        const p = Array.isArray(l.products) ? l.products[0] : l.products
        if (!p || !p.gold_weight_g || !p.gold_karat || !p.trade_price) return
        const { margin } = computeOrderCogs({
          gold_weight_actual: p.gold_weight_g,
          gold_rate_at_order: goldRate,
          gold_karat: p.gold_karat,
          making_charges: p.making_charges || 0,
          stone_cost: p.diamond_cost || 0,
          total_amount: p.trade_price,
        })
        const pct = p.trade_price > 0 ? (margin / p.trade_price) * 100 : 0
        const arr = buckets.get(l.collection_id) || []
        arr.push(pct)
        buckets.set(l.collection_id, arr)
      })
      const out = new Map<string, number>()
      buckets.forEach((arr, k) => out.set(k, arr.reduce((a, b) => a + b, 0) / arr.length))
      setAvgMargins(out)
    } catch (e) {
      console.warn('loadMargins failed', e)
    }
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

  const visible = useMemo(() => {
    const list = collections.filter(c => {
      if (marginFilter === 'all') return true
      const m = avgMargins.get(c.id)
      if (m == null) return false
      if (marginFilter === 'high') return m >= 25
      if (marginFilter === 'mid') return m >= 10 && m < 25
      if (marginFilter === 'low') return m < 10
      return true
    })
    if (sortBy === 'margin_desc' || sortBy === 'margin_asc') {
      list.sort((a, b) => {
        const ma = avgMargins.get(a.id)
        const mb = avgMargins.get(b.id)
        if (ma == null && mb == null) return 0
        if (ma == null) return 1
        if (mb == null) return -1
        return sortBy === 'margin_desc' ? mb - ma : ma - mb
      })
    }
    return list
  }, [collections, avgMargins, marginFilter, sortBy])

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
        <p className="text-stone-500 text-sm">
          Curate lookbooks to share with partners and track their interest
          {!hasGoldRate && <span className="ml-2 text-amber-600">· Add today&apos;s gold rate to enable margin sort/filter</span>}
        </p>
      </div>

      {collections.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          <select value={marginFilter} onChange={e => setMarginFilter(e.target.value as typeof marginFilter)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" disabled={!hasGoldRate}>
            <option value="all">All margins</option>
            <option value="high">High (≥25%)</option>
            <option value="mid">Mid (10–25%)</option>
            <option value="low">Low (&lt;10%)</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" disabled={!hasGoldRate}>
            <option value="default">Sort: Default</option>
            <option value="margin_desc">Sort: Avg margin (high→low)</option>
            <option value="margin_asc">Sort: Avg margin (low→high)</option>
          </select>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Library className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm mb-4">No collections yet. Create your first lookbook to share with partners.</p>
          <Link href="/catalog/collections/new"
            className="inline-flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]">
            <Plus className="w-4 h-4" /> Create first collection
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Library className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">No collections match the current margin filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(c => (
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
                    <span className="text-[#1E3A5F] font-medium">{c.response_count} response{c.response_count !== 1 ? 's' : ''}</span>
                    {avgMargins.has(c.id) && (() => {
                      const m = avgMargins.get(c.id)!
                      const cls = m >= 25 ? 'bg-green-100 text-green-700'
                        : m >= 10 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      return (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${cls}`}
                          title="Avg estimated margin across products in this collection (today's 24K gold rate)">
                          Avg margin {m.toFixed(0)}%
                        </span>
                      )
                    })()}
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
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#162B47] transition-colors whitespace-nowrap">
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
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1E3A5F] text-white hover:bg-[#162B47] transition-colors">
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
