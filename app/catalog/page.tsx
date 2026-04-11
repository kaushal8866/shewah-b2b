'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Package, Edit2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [karatFilter, setKaratFilter] = useState('all')
  const [shapeFilter, setShapeFilter] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('code')
    setProducts(data || [])
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id)
    loadProducts()
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

  const shapes = Array.from(new Set(products.map(p => p.diamond_shape).filter(Boolean)))

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    k14: products.filter(p => p.gold_karat === 14).length,
    k18: products.filter(p => p.gold_karat === 18).length,
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Catalog</h1>
          <p className="text-stone-500 text-sm mt-0.5">Ring collection — {stats.active} active designs</p>
        </div>
        <Link href="/catalog/new"
          className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
          <Plus className="w-4 h-4" />
          Add product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search by name, code, shape..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <select value={karatFilter} onChange={e => setKaratFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All karats</option>
            <option value="14">14K gold</option>
            <option value="18">18K gold</option>
          </select>
          <select value={shapeFilter} onChange={e => setShapeFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All shapes</option>
            {shapes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowInactive(!showInactive)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${showInactive ? 'bg-stone-100 border-stone-300 text-stone-700' : 'border-stone-200 text-stone-400 hover:text-stone-600'}`}>
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? 'Hiding inactive' : 'Show inactive'}
          </button>
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading catalog...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">
            {products.length === 0
              ? 'No products yet — add your first ring design'
              : 'No products match your filters'}
          </p>
          {products.length === 0 && (
            <Link href="/catalog/new"
              className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">
              Add first product →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${p.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
              {/* Photo placeholder */}
              <div className="aspect-square bg-gradient-to-br from-stone-50 to-yellow-50 flex items-center justify-center relative">
                {p.photo_urls && p.photo_urls.length > 0 ? (
                  <img src={p.photo_urls[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-1">◆</div>
                    <p className="text-xs text-stone-300">{p.code}</p>
                  </div>
                )}
                {!p.is_active && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <span className="bg-stone-200 text-stone-500 text-xs px-2 py-1 rounded-full">Inactive</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-white text-stone-600 text-xs px-2 py-0.5 rounded-full border border-stone-200 font-medium">
                    {p.code}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-3 sm:p-4">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium text-stone-900 text-sm truncate pr-2">{p.name}</p>
                  <span className="text-xs text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded-md shrink-0">
                    {p.gold_karat}K
                  </span>
                </div>
                <p className="text-xs text-stone-400 mb-3 line-clamp-1">
                  {p.diamond_weight}ct {p.diamond_shape} · {p.diamond_quality}/{p.diamond_color}
                </p>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-1 mb-3">
                  <div className="bg-stone-50 rounded-md p-1.5 text-center">
                    <p className="text-[10px] text-stone-400 truncate">Trade</p>
                    <p className="text-[11px] sm:text-xs font-semibold text-stone-700 truncate">
                      {p.trade_price ? `₹${(p.trade_price/1000).toFixed(0)}K` : '—'}
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-md p-1.5 text-center">
                    <p className="text-[10px] text-stone-400 truncate">MRP</p>
                    <p className="text-[11px] sm:text-xs font-semibold text-stone-700 truncate">
                      {p.mrp_suggested ? `₹${(p.mrp_suggested/1000).toFixed(0)}K` : '—'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-md p-1.5 text-center">
                    <p className="text-[10px] text-green-600 truncate">Margin</p>
                    <p className="text-[11px] sm:text-xs font-semibold text-green-700 truncate">
                      {p.trade_price && p.mrp_suggested
                        ? `₹${((p.mrp_suggested - p.trade_price)/1000).toFixed(0)}K`
                        : '—'}
                    </p>
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
                    <Link href={`/catalog/${p.id}`}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
