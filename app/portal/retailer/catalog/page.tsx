'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Package } from 'lucide-react'

export default function RetailerCatalog() {
  const [products, setProducts] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetch('/api/portal/retailer/products')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setProducts(d.products || [])
      })
      .catch(e => setError(e.message))
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    ;(products || []).forEach(p => { if (p.category) set.add(p.category) })
    return ['all', ...Array.from(set)]
  }, [products])

  const filtered = (products || []).filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (q) {
      const needle = q.toLowerCase()
      return p.name?.toLowerCase().includes(needle) ||
             p.code?.toLowerCase().includes(needle) ||
             p.category?.toLowerCase().includes(needle)
    }
    return true
  })

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/15 text-[#1E3A5F] flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Catalog</h1>
          <p className="text-stone-500 text-sm">Browse and order from our active product range</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by name, code or category..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-[#1E3A5F] outline-none" />
        </div>
        {categories.length > 1 && (
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-[#1E3A5F] outline-none capitalize">
            {categories.map(c => <option key={c} value={c} className="capitalize">{c === 'all' ? 'All categories' : c}</option>)}
          </select>
        )}
      </div>

      {products === null ? (
        <p className="text-stone-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-stone-400 text-sm">No products match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(p => (
            <Link key={p.id} href={`/portal/retailer/catalog/${p.id}`}
              className="block bg-white border border-stone-200 hover:border-[#1E3A5F] rounded-xl overflow-hidden transition-colors">
              <div className="aspect-square bg-stone-100 relative overflow-hidden">
                {p.photo_urls?.[0] ? (
                  <img src={p.photo_urls[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <Package className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs text-stone-400">{p.code}</p>
                <p className="text-sm font-medium text-stone-800 truncate">{p.name}</p>
                <p className="text-sm font-semibold text-[#1E3A5F] mt-1">
                  ₹{(p.trade_price || 0).toLocaleString('en-IN')}
                </p>
                {p.category && (
                  <p className="text-[10px] text-stone-400 mt-0.5 capitalize">{p.category}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
