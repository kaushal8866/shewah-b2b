'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, Phone, Package, Layers } from 'lucide-react'
import Link from 'next/link'

export default function ManufacturingPartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [partner, setPartner] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [floats, setFloats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: o }, { data: f }] = await Promise.all([
      supabase.from('manufacturing_partners').select('*').eq('id', id).single(),
      supabase.from('manufacturing_orders').select('*').eq('manufacturing_partner_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('material_float').select('*').eq('manufacturing_partner_id', id),
    ])
    if (!p) { router.push('/manufacturing'); return }
    setPartner(p)
    setForm(p)
    setOrders(o || [])
    setFloats(f || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('manufacturing_partners').update({
      name: form.name,
      owner_name: form.owner_name || null,
      phone: form.phone,
      email: form.email || null,
      city: form.city,
      address: form.address || null,
      speciality: form.speciality
        ? (typeof form.speciality === 'string'
            ? form.speciality.split(',').map((s: string) => s.trim()).filter(Boolean)
            : form.speciality)
        : null,
      material_policy: form.material_policy,
      labour_rate_14k: parseFloat(form.labour_rate_14k) || null,
      labour_rate_18k: parseFloat(form.labour_rate_18k) || null,
      labour_rate_22k: parseFloat(form.labour_rate_22k) || null,
      min_labour_grams: parseFloat(form.min_labour_grams) || 1,
      status: form.status,
      notes: form.notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  async function handleDelete() {
    // Unlink manufacturing orders before deleting
    await supabase.from('manufacturing_orders').update({ manufacturing_partner_id: null }).eq('manufacturing_partner_id', id)
    const { error } = await supabase.from('manufacturing_partners').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/manufacturing')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const totalOrders = orders.length
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
  const totalCost = orders.reduce((sum, o) => sum + (o.total_manufacturing_cost || 0), 0)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manufacturing" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{partner.name}</h1>
          <p className="text-stone-400 text-sm">{partner.owner_name || '—'} · {partner.city}</p>
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
              <button onClick={() => { setEditing(false); setForm(partner) }}
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
            <h3 className="font-semibold text-stone-900 mb-2">Delete this partner?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{partner.name}</strong>? Their manufacturing orders will remain.
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
          <div className="flex gap-2 mb-2">
            <span className={`status-pill ${getStatusColor(partner.status)}`}>{partner.status}</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {partner.phone && (
              <a href={`tel:${partner.phone}`}
                className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm hover:bg-stone-50">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            <Link href={`/manufacturing/orders/new?partner=${id}`}
              className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-xl text-sm hover:bg-[#9B7A40]">
              <Package className="w-4 h-4" /> New order
            </Link>
            <Link href={`/manufacturing/partners/${id}/float`}
              className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm hover:bg-stone-50">
              <Layers className="w-4 h-4" /> Manage float
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total orders', value: totalOrders },
              { label: 'Active orders', value: activeOrders },
              { label: 'Total cost', value: `₹${totalCost.toLocaleString('en-IN')}` },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-stone-200 p-4">
                <p className="text-xs text-stone-400">{stat.label}</p>
                <p className="text-xl font-semibold text-stone-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Partner details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Name', partner.name],
                ['Owner', partner.owner_name || '—'],
                ['Phone', partner.phone],
                ['Email', partner.email || '—'],
                ['City', partner.city],
                ['Address', partner.address || '—'],
                ['Material policy', partner.material_policy?.replace(/_/g, ' ') || '—'],
                ['Min charge weight', `${partner.min_labour_grams || 1}g`],
                ['Labour rate 14K', partner.labour_rate_14k ? `₹${partner.labour_rate_14k}/g` : '—'],
                ['Labour rate 18K', partner.labour_rate_18k ? `₹${partner.labour_rate_18k}/g` : '—'],
                ['Labour rate 22K', partner.labour_rate_22k ? `₹${partner.labour_rate_22k}/g` : '—'],
                ['Specialities', Array.isArray(partner.speciality) ? partner.speciality.join(', ') || '—' : partner.speciality || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v)}</p>
                </div>
              ))}
            </div>
            {partner.notes && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Notes</p>
                <p className="text-sm text-stone-700 leading-relaxed">{partner.notes}</p>
              </div>
            )}
          </div>

          {floats.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium text-stone-900">Material float balance</h2>
                <Link href={`/manufacturing/partners/${id}/float`} className="text-xs text-[#C49C64] hover:underline">Manage</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {floats.map(f => (
                  <div key={f.id} className={`rounded-xl border p-3 ${f.balance < 1 ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
                    <p className="text-xs text-stone-400 mb-1">{f.material_type?.replace(/_/g, ' ')}</p>
                    <p className={`text-lg font-semibold ${f.balance < 1 ? 'text-amber-600' : 'text-stone-900'}`}>
                      {f.balance?.toFixed(3)}{f.unit === 'carats' ? 'ct' : 'g'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orders.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="font-medium text-stone-900">Manufacturing orders ({orders.length})</h2>
              </div>
              <div className="divide-y divide-stone-50">
                {orders.map(o => (
                  <Link key={o.id} href={`/manufacturing/orders/${o.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{o.order_number}</p>
                      <p className="text-xs text-stone-400 truncate max-w-48">{o.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`status-pill text-xs ${getStatusColor(o.status)}`}>
                        {o.status?.replace(/_/g, ' ')}
                      </span>
                      {o.total_manufacturing_cost > 0 && (
                        <p className="text-xs text-stone-500">₹{o.total_manufacturing_cost?.toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Edit partner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Business / workshop name *</label>
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
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || 'active'} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_hold">On hold</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Material policy</label>
                <select className={inp} value={form.material_policy || 'client_material'} onChange={e => set('material_policy', e.target.value)}>
                  <option value="client_material">Karigar supplies own material</option>
                  <option value="owner_material">We supply via float</option>
                  <option value="both">Both options</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Labour rate 14K (₹/g)</label>
                <input type="number" className={inp} value={form.labour_rate_14k || ''} onChange={e => set('labour_rate_14k', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Labour rate 18K (₹/g)</label>
                <input type="number" className={inp} value={form.labour_rate_18k || ''} onChange={e => set('labour_rate_18k', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Labour rate 22K (₹/g)</label>
                <input type="number" className={inp} value={form.labour_rate_22k || ''} onChange={e => set('labour_rate_22k', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Min chargeable weight (g)</label>
                <input type="number" step="0.1" className={inp} value={form.min_labour_grams || '1'} onChange={e => set('min_labour_grams', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Specialities (comma separated)</label>
                <input className={inp}
                  value={Array.isArray(form.speciality) ? form.speciality.join(', ') : form.speciality || ''}
                  onChange={e => set('speciality', e.target.value)} />
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
