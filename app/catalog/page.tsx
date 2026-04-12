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
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32">
      <div className="flex items-end justify-between mb-12">
        <div>
          <h1 className="display-sm">Catalog</h1>
          <p className="text-secondary tracking-wide mt-2">Ring collection — {stats.active} active designs</p>
        </div>
        <Link href="/catalog/new"
          className="flex items-center gap-2 bg-primary text-surface-lowest px-5 py-3 rounded-md text-sm font-medium hover:bg-surface-highest hover:text-primary transition-colors">
          <Plus className="w-5 h-5" />
          Add product
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
        {[
          { label: 'Total designs', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: '14K designs', value: stats.k14 },
          { label: '18K designs', value: stats.k18 },
        ].map(s => (
          <div key={s.label} className="bg-surface-low hover:bg-surface-highest transition-colors px-6 py-5 flex flex-col justify-center">
            <p className="label-md">{s.label}</p>
            <p className="display-sm mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-8">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-secondary" />
          <input type="text" placeholder="Search by name, code, shape..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm bg-surface-lowest ghost-border" />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <select value={karatFilter} onChange={e => setKaratFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            <option value="all">All karats</option>
            <option value="14">14K gold</option>
            <option value="18">18K gold</option>
          </select>
          <select value={shapeFilter} onChange={e => setShapeFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border capitalize">
            <option value="all">All shapes</option>
            {shapes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowInactive(!showInactive)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${showInactive ? 'bg-surface-highest text-primary' : 'bg-surface text-secondary hover:text-primary ghost-border'}`}>
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? 'Hiding inactive' : 'Show inactive'}
          </button>
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="text-center py-20 text-secondary headline-lg">Loading catalog...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-surface-lowest">
          <Package className="w-12 h-12 text-outline-variant mx-auto mb-4" />
          <p className="text-secondary text-base">
            {products.length === 0
              ? 'No products yet — add your first ring design'
              : 'No products match your filters'}
          </p>
          {products.length === 0 && (
            <Link href="/catalog/new"
              className="inline-block mt-4 text-primary font-medium hover:underline underline-offset-4">
              Add first product →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1 lg:gap-4">
          {filtered.map(p => (
            <div key={p.id} className={`bg-surface-lowest ghost-border overflow-hidden transition-all ${p.is_active ? '' : 'opacity-50 grayscale'}`}>
              {/* Photo placeholder */}
              <div className="aspect-[4/3] bg-surface-low flex items-center justify-center relative">
                {p.photo_urls && p.photo_urls.length > 0 ? (
                  <img src={p.photo_urls[0]} alt={p.name} className="w-full h-full object-cover mix-blend-multiply" />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-1 text-outline-variant">◆</div>
                    <p className="label-md text-outline-variant">{p.code}</p>
                  </div>
                )}
                {!p.is_active && (
                  <div className="absolute inset-0 bg-surface-low/60 flex items-center justify-center">
                    <span className="status-pill text-secondary">Inactive</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="bg-surface-lowest text-primary label-md px-2 py-1 rounded-sm shadow-ambient">
                    {p.code}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="headline-md truncate pr-2">{p.name}</p>
                  <span className="status-pill bg-surface-low shrink-0">
                    {p.gold_karat}K
                  </span>
                </div>
                <p className="text-sm text-secondary mb-4 line-clamp-1">
                  {p.diamond_weight}ct {p.diamond_shape} · {p.diamond_quality}/{p.diamond_color}
                </p>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-1 mb-4">
                  <div className="bg-surface-low rounded-sm p-2 text-center">
                    <p className="label-md truncate">Trade</p>
                    <p className="text-xs font-medium text-primary mt-0.5 truncate">
                      {p.trade_price ? `₹${(p.trade_price/1000).toFixed(0)}K` : '—'}
                    </p>
                  </div>
                  <div className="bg-surface-low rounded-sm p-2 text-center">
                    <p className="label-md truncate">MRP</p>
                    <p className="text-xs font-medium text-primary mt-0.5 truncate">
                      {p.mrp_suggested ? `₹${(p.mrp_suggested/1000).toFixed(0)}K` : '—'}
                    </p>
                  </div>
                  <div className="bg-surface-highest rounded-sm p-2 text-center">
                    <p className="label-md text-primary truncate">Margin</p>
                    <p className="text-xs font-medium text-primary mt-0.5 truncate">
                      {p.trade_price && p.mrp_suggested
                        ? `₹${((p.mrp_suggested - p.trade_price)/1000).toFixed(0)}K`
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t ghost-border">
                  <p className="text-xs text-secondary">{p.delivery_days} days delivery</p>
                  <div className="flex gap-1">
                    <button onClick={() => toggleActive(p.id, p.is_active)}
                      className="p-1.5 rounded-sm hover:bg-surface-highest text-secondary hover:text-primary transition-colors"
                      title={p.is_active ? 'Deactivate' : 'Activate'}>
                      {p.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <Link href={`/catalog/${p.id}`}
                      className="p-1.5 rounded-sm hover:bg-surface-highest text-secondary hover:text-primary transition-colors">
                      <Edit2 className="w-4 h-4" />
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
