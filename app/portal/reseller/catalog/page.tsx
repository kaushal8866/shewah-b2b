'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Search,
  Sliders,
  DollarSign,
  TrendingUp,
  Percent,
  PlusCircle,
  Eye,
  Plus
} from 'lucide-react'

export default function ResellerCatalog() {
  const [products, setProducts] = useState<any[] | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showSellingPrice, setShowSellingPrice] = useState(false)
  const [customMarkup, setCustomMarkup] = useState('15') // percentage

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/reseller/profile').then(r => r.json()),
      fetch('/api/portal/reseller/catalog').then(r => r.json())
    ])
      .then(([profData, catalogData]) => {
        if (profData.error) setError(profData.error)
        else {
          setProfile(profData.profile)
          setCustomMarkup(String(profData.profile?.default_markup_percent || 15))
        }

        if (catalogData.error) setError(catalogData.error)
        else setProducts(catalogData.products || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading catalog...</div>
  }

  if (error) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    )
  }

  const markupMultiplier = 1 + Number(customMarkup) / 100

  // Categories list extraction
  const categories = products ? ['all', ...Array.from(new Set(products.map(p => p.category)))] : []

  const filteredProducts = (products || []).filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Package className="w-5.5 h-5.5 text-amber-600" />
            Product Catalog
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Browse items, calculate custom markup prices, and request samples or make orders.
          </p>
        </div>
      </div>

      {/* Interactive Pricing Controls */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
            Price Display Mode
          </label>
          <div className="flex bg-stone-100 rounded-xl p-1 w-full max-w-[320px]">
            <button
              onClick={() => setShowSellingPrice(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                !showSellingPrice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'
              }`}
            >
              Reseller Cost (Floor)
            </button>
            <button
              onClick={() => setShowSellingPrice(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                showSellingPrice ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'
              }`}
            >
              Suggested Selling Price
            </button>
          </div>
        </div>

        {showSellingPrice && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
                Custom Markup Percentage
              </label>
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                {customMarkup}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                className="flex-1 accent-amber-600 h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer"
                value={customMarkup}
                onChange={e => setCustomMarkup(e.target.value)}
              />
              <input
                type="number"
                min="0"
                max="100"
                className="w-16 border border-stone-200 rounded-xl px-2 py-1 text-xs text-center font-bold text-stone-850"
                value={customMarkup}
                onChange={e => setCustomMarkup(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
            placeholder="Search catalog by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Products Found</p>
          <p className="text-stone-400 text-xs mt-1">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(p => {
            const coverImage = p.photo_urls?.[0]
            const costRupees = p.floor_price_paise / 100
            const sellingPriceRupees = Math.round(costRupees * markupMultiplier)
            const profitRupees = sellingPriceRupees - costRupees

            return (
              <div
                key={p.id}
                className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-stone-100 border-b border-stone-150 overflow-hidden">
                  {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImage}
                      alt={p.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
                      <Package className="w-10 h-10" />
                      <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-stone-400">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-stone-900/80 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ">
                    {p.category}
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-amber-700">{p.code}</span>
                    <h3 className="font-bold text-stone-900 text-sm mt-0.5 line-clamp-1">{p.name}</h3>
                  </div>

                  {/* Pricing Info */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-stone-400 font-bold uppercase leading-none">
                        {showSellingPrice ? 'Selling Price' : 'Your Cost'}
                      </p>
                      <p className="text-base font-black text-stone-900 mt-1">
                        ₹{(showSellingPrice ? sellingPriceRupees : costRupees).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {showSellingPrice && (
                      <div className="text-right">
                        <p className="text-[9px] text-stone-400 font-bold uppercase leading-none">Your profit</p>
                        <p className="text-xs font-bold text-green-650 mt-1">₹{profitRupees.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-1">
                    <Link
                      href={`/portal/reseller/catalog/${p.id}`}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </Link>
                    <Link
                      href={`/portal/reseller/orders/new?product_id=${p.id}`}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Sell / Order
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
