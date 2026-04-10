'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronRight, Store, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['all', 'gold', 'diamonds', 'packaging', 'findings', 'chains', 'other']

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [view, setView] = useState<'vendors' | 'stock'>('vendors')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: inv }] = await Promise.all([
      supabase.from('vendors').select('*').order('name'),
      supabase.from('inventory').select('*, vendors(name)').order('category'),
    ])
    setVendors(v || [])
    setInventory(inv || [])
    setLoading(false)
  }

  const filteredVendors = vendors.filter(v => {
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.city?.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || v.category?.includes(catFilter)
    return matchSearch && matchCat
  })

  const lowStockItems = inventory.filter(i =>
    i.low_stock_alert && i.quantity_in_stock <= i.low_stock_alert
  )

  const totalStockValue = inventory.reduce((s, i) =>
    s + (i.quantity_in_stock * (i.avg_purchase_price || 0)), 0
  )

  const goldStock = inventory.filter(i => i.category === 'gold')
  const diamondStock = inventory.filter(i => i.category?.includes('diamond'))

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Vendors & Stock</h1>
          <p className="text-stone-500 text-sm mt-0.5">Raw materials, packaging, and inventory</p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors/inventory/new"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <Plus className="w-4 h-4" /> Stock item
          </Link>
          <Link href="/vendors/new"
            className="flex items-center gap-1.5 bg-[#C49C64] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40]">
            <Plus className="w-4 h-4" /> Add vendor
          </Link>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">{lowStockItems.length} items low on stock</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {lowStockItems.map(i => `${i.name} (${i.quantity_in_stock}${i.unit})`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stock summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Stock value</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totalStockValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Gold in stock</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">
            {goldStock.reduce((s, i) => s + i.quantity_in_stock, 0).toFixed(2)}g
          </p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Diamonds in stock</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">
            {diamondStock.reduce((s, i) => s + i.quantity_in_stock, 0).toFixed(2)}ct
          </p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Total vendors</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{vendors.length}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 mb-5">
        <button onClick={() => setView('vendors')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${view === 'vendors' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
          Vendors ({vendors.length})
        </button>
        <button onClick={() => setView('stock')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${view === 'stock' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
          Inventory ({inventory.length})
        </button>
      </div>

      {view === 'vendors' ? (
        <>
          {/* Vendor filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
              <input type="text" placeholder="Search vendors..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${catFilter === c ? 'bg-[#C49C64] text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-stone-400">Loading...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="py-12 text-center">
                <Store className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">No vendors yet</p>
                <Link href="/vendors/new" className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">Add first vendor →</Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Vendor</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden sm:table-cell">Categories</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden sm:table-cell">City</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filteredVendors.map(v => (
                    <tr key={v.id} className="hover:bg-stone-50 cursor-pointer"
                      onClick={() => window.location.href = `/vendors/${v.id}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-stone-900">{v.name}</p>
                        <p className="text-xs text-stone-400">{v.owner_name}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {v.category?.slice(0, 3).map((c: string) => (
                            <span key={c} className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-stone-500">{v.city || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {v.outstanding > 0 ? (
                          <p className="text-sm font-medium text-red-500">{formatCurrency(v.outstanding)}</p>
                        ) : (
                          <p className="text-sm text-stone-300">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-stone-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Inventory view */
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-stone-400">Loading...</div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
              <p className="text-stone-400 text-sm">No inventory items yet</p>
              <Link href="/vendors/inventory/new" className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">Add first item →</Link>
            </div>
          ) : (
            <>
              {['gold', 'diamond_lgd', 'diamond_natural', 'packaging', 'finding', 'other'].map(cat => {
                const items = inventory.filter(i => i.category === cat)
                if (items.length === 0) return null
                return (
                  <div key={cat} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                      <h3 className="text-sm font-medium text-stone-700 capitalize">{cat.replace(/_/g, ' ')}</h3>
                    </div>
                    <div className="divide-y divide-stone-50">
                      {items.map(item => {
                        const isLow = item.low_stock_alert && item.quantity_in_stock <= item.low_stock_alert
                        return (
                          <Link key={item.id} href={`/vendors/inventory/${item.id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-900">{item.name}</p>
                              <p className="text-xs text-stone-400">
                                {item.vendors?.name}
                                {item.diamond_shape && ` · ${item.diamond_shape}`}
                                {item.diamond_quality && ` · ${item.diamond_quality}/${item.diamond_color}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-semibold ${isLow ? 'text-amber-600' : 'text-stone-900'}`}>
                                {item.quantity_in_stock}{item.unit === 'carats' ? 'ct' : item.unit === 'grams' ? 'g' : ` ${item.unit}`}
                              </p>
                              {isLow && <p className="text-xs text-amber-500">Low stock</p>}
                              {item.avg_purchase_price && (
                                <p className="text-xs text-stone-400">₹{item.avg_purchase_price}/{item.unit === 'carats' ? 'ct' : 'g'}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
