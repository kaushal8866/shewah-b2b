'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, ChevronRight, Store, Boxes, Edit2, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = ['all', 'gold', 'diamonds', 'packaging', 'findings', 'chains', 'other']

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: v } = await supabase.from('vendors').select('*').order('name')
    setVendors(v || [])
    setLoading(false)
  }

  async function handleDelete() {
    if (!vendorToDelete) return
    const id = vendorToDelete.id
    const name = vendorToDelete.name
    setDeletingId(id)

    try {
      // 1. Safety check for stock ledger history
      const { count: purchaseCount } = await supabase
        .from('stock_movements')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', id)
        .eq('movement_type', 'purchase')

      if ((purchaseCount || 0) > 0) {
        const proceed = confirm(
          `${name} has ${purchaseCount} purchase record${purchaseCount === 1 ? '' : 's'} on the stock ledger ` +
          `that must be kept for audit. The vendor cannot be deleted, but you can mark it Inactive ` +
          `so it stops appearing in pickers and dashboards.\n\nMark this vendor as Inactive now?`
        )
        if (proceed) {
          const { error: updErr } = await supabase
            .from('vendors')
            .update({ status: 'inactive' })
            .eq('id', id)
          if (updErr) {
            alert('Could not mark inactive: ' + updErr.message)
          } else {
            load()
          }
        }
        setShowDeleteConfirm(false)
        setVendorToDelete(null)
        return
      }

      // 2. Safe to delete. Unlink inventory first.
      await supabase.from('inventory').update({ vendor_id: null }).eq('vendor_id', id)
      const { error } = await supabase.from('vendors').delete().eq('id', id)
      if (error) {
        alert('Error: ' + error.message)
      } else {
        load()
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(false)
      setVendorToDelete(null)
    }
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
            className="flex items-center gap-1.5 bg-stone-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-900">
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
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${catFilter === c ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300'}`}>
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
            <Link href="/vendors/new" className="inline-block mt-3 text-sm text-stone-800 hover:underline">Add first vendor →</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Vendor</th>
                <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Categories</th>
                <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">City</th>
                <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Outstanding</th>
                <th className="px-4 py-3 text-right text-xs text-stone-400 font-medium w-28">Actions</th>
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
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end items-center gap-2.5">
                      <Link href={`/vendors/${v.id}?edit=true`}
                        className="p-1 hover:text-stone-800 text-stone-400 transition-colors"
                        title="Edit Vendor">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => { setVendorToDelete(v); setShowDeleteConfirm(true) }}
                        className="p-1 hover:text-red-500 text-stone-400 transition-colors"
                        title="Delete Vendor">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-stone-350" />
                    </div>
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
            <Link href="/vendors/new" className="inline-block mt-3 text-sm text-stone-800 hover:underline">Add first vendor →</Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {filteredVendors.map(v => (
              <div key={v.id} onClick={() => router.push(`/vendors/${v.id}`)}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors cursor-pointer">
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
                <div className="text-right shrink-0" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {v.outstanding > 0 && (
                      <span className="text-sm font-medium text-red-500 mr-1.5">{formatCurrency(v.outstanding)}</span>
                    )}
                    <Link href={`/vendors/${v.id}?edit=true`} className="p-1 hover:text-stone-800 text-stone-400">
                      <Edit2 className="w-4.5 h-4.5" />
                    </Link>
                    <button onClick={() => { setVendorToDelete(v); setShowDeleteConfirm(true) }} className="p-1 hover:text-red-500 text-stone-400">
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-stone-300 ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && vendorToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-stone-100">
            <h3 className="font-semibold text-stone-900 text-base mb-2">Delete this vendor?</h3>
            <p className="text-sm text-stone-500 mb-5 leading-relaxed">
              Permanently delete <strong>{vendorToDelete.name}</strong>? Their inventory items will remain.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setVendorToDelete(null) }}
                disabled={deletingId !== null}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId !== null}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
