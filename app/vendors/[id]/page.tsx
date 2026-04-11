'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Trash2, Edit2, X, Phone, Plus } from 'lucide-react'
import Link from 'next/link'

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [vendor, setVendor] = useState<any>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: inv }] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', id).single(),
      supabase.from('inventory').select('*').eq('vendor_id', id).order('name'),
    ])
    if (!v) { router.push('/vendors'); return }
    setVendor(v)
    setForm(v)
    setInventory(inv || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('vendors').update({
      name: form.name,
      owner_name: form.owner_name || null,
      phone: form.phone,
      email: form.email || null,
      city: form.city || null,
      address: form.address || null,
      gstin: form.gstin || null,
      category: form.category || null,
      payment_terms: form.payment_terms,
      credit_limit: parseFloat(form.credit_limit) || 0,
      outstanding: parseFloat(form.outstanding) || 0,
      status: form.status,
      notes: form.notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  async function handleDelete() {
    // Unlink inventory items before deleting the vendor
    await supabase.from('inventory').update({ vendor_id: null }).eq('vendor_id', id)
    const { error } = await supabase.from('vendors').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/vendors')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const lowStockItems = inventory.filter(i => i.low_stock_alert && i.quantity_in_stock <= i.low_stock_alert)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vendors" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{vendor.name}</h1>
          <p className="text-stone-400 text-sm">{vendor.owner_name || '—'} · {vendor.city || '—'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(vendor) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this vendor?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{vendor.name}</strong>? Their inventory items will remain.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          <div className="flex gap-2 mb-3">
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`}
                className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm hover:bg-stone-50">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            <Link href="/vendors/inventory/new"
              className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-xl text-sm hover:bg-[#9B7A40]">
              <Plus className="w-4 h-4" /> Add inventory
            </Link>
          </div>

          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Low stock — {lowStockItems.length} items</p>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(i => (
                  <span key={i.id} className="text-xs bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded-lg">
                    {i.name}: {i.quantity_in_stock} {i.unit}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Vendor details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Name', vendor.name],
                ['Owner', vendor.owner_name || '—'],
                ['Phone', vendor.phone || '—'],
                ['Email', vendor.email || '—'],
                ['City', vendor.city || '—'],
                ['Address', vendor.address || '—'],
                ['GSTIN', vendor.gstin || '—'],
                ['Category', vendor.category || '—'],
                ['Status', vendor.status || 'active'],
                ['Payment terms', vendor.payment_terms?.replace(/_/g, ' ') || '—'],
                ['Credit limit', vendor.credit_limit ? `₹${vendor.credit_limit?.toLocaleString('en-IN')}` : '₹0'],
                ['Outstanding', `₹${(vendor.outstanding || 0).toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v)}</p>
                </div>
              ))}
            </div>
            {vendor.notes && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Notes</p>
                <p className="text-sm text-stone-700 leading-relaxed">{vendor.notes}</p>
              </div>
            )}
          </div>

          {inventory.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-medium text-stone-900">Inventory ({inventory.length})</h2>
                <Link href="/vendors/inventory/new" className="text-xs text-[#C49C64] hover:underline">+ Add item</Link>
              </div>
              <div className="divide-y divide-stone-50">
                {inventory.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{item.name}</p>
                      <p className="text-xs text-stone-400 capitalize">{item.category} · {item.sku || 'No SKU'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${item.low_stock_alert && item.quantity_in_stock <= item.low_stock_alert ? 'text-amber-600' : 'text-stone-800'}`}>
                        {item.quantity_in_stock} {item.unit}
                      </p>
                      {item.avg_purchase_price && (
                        <p className="text-xs text-stone-400">₹{item.avg_purchase_price?.toLocaleString('en-IN')}/{item.unit === 'carats' ? 'ct' : item.unit === 'grams' ? 'g' : 'unit'}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Edit vendor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Vendor name *</label>
                <input className={inp} value={form.name || ''} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Owner name</label>
                <input className={inp} value={form.owner_name || ''} onChange={e => set('owner_name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input className={inp} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} value={form.email || ''} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>City</label>
                <input className={inp} value={form.city || ''} onChange={e => set('city', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Address</label>
                <input className={inp} value={form.address || ''} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>GSTIN</label>
                <input className={inp} value={form.gstin || ''} onChange={e => set('gstin', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Category</label>
                <input className={inp} value={form.category || ''} onChange={e => set('category', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || 'active'} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Payment terms</label>
                <select className={inp} value={form.payment_terms || 'cash'} onChange={e => set('payment_terms', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="net_7">Net 7 days</option>
                  <option value="net_15">Net 15 days</option>
                  <option value="net_30">Net 30 days</option>
                  <option value="net_45">Net 45 days</option>
                  <option value="net_60">Net 60 days</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Credit limit (₹)</label>
                <input type="number" className={inp} value={form.credit_limit || '0'} onChange={e => set('credit_limit', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Outstanding (₹)</label>
                <input type="number" className={inp} value={form.outstanding || '0'} onChange={e => set('outstanding', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
