'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Vendor, type InventoryItem } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronRight, Store, Boxes } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['all', 'gold', 'diamonds', 'packaging', 'findings', 'chains', 'other']

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: v } = await supabase.from('vendors').select('*').order('name')
    setVendors(v || [])
    setLoading(false)
  }

  const filteredVendors = vendors.filter(v => {
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.city?.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || v.category?.includes(catFilter)
    return matchSearch && matchCat
  })

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Vendors</h1>
          <p className="text-stone-500 text-sm mt-0.5">Suppliers — gold, diamonds, packaging, findings</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <Boxes className="w-4 h-4" /> Stock
          </Link>
          <Link href="/vendors/new"
            className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]">
            <Plus className="w-4 h-4" /> Add vendor
          </Link>
        </div>
      </div>

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
                  className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${catFilter === c ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-stone-200 overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-stone-400">Loading...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="py-12 text-center">
                <Store className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">No vendors yet</p>
                <Link href="/vendors/new" className="inline-block mt-3 text-sm text-[#1E3A5F] hover:underline">Add first vendor →</Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Vendor</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Categories</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">City</th>
                    <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filteredVendors.map(v => (
                    <tr key={v.id} className="hover:bg-stone-50 cursor-pointer"
                      onClick={() => router.push(`/vendors/${v.id}`)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-stone-900">{v.name}</p>
                        <p className="text-xs text-stone-400">{v.owner_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {v.category?.slice(0, 3).map((c: string) => (
                            <span key={c} className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
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

          {/* Mobile card list */}
          <div className="lg:hidden bg-white rounded-xl border border-stone-200 overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-stone-400 text-sm">Loading...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="py-12 text-center">
                <Store className="w-10 h-10 text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 text-sm">No vendors yet</p>
                <Link href="/vendors/new" className="inline-block mt-3 text-sm text-[#1E3A5F] hover:underline">Add first vendor →</Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {filteredVendors.map(v => (
                  <Link key={v.id} href={`/vendors/${v.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">{v.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {v.city ? `${v.city} · ` : ''}{v.owner_name || ''}
                      </p>
                      {v.category?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {v.category.slice(0, 3).map((c: string) => (
                            <span key={c} className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {v.outstanding > 0 ? (
                        <p className="text-sm font-medium text-red-500">{formatCurrency(v.outstanding)}</p>
                      ) : null}
                      <ChevronRight className="w-4 h-4 text-stone-300 mt-1 ml-auto" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
    </div>
  )
}
