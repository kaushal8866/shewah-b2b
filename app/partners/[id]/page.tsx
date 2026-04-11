'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Partner, type Visit, type Order } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import {
  ArrowLeft, Save, Trash2, Phone, MapPin,
  MessageCircle, Plus, Edit2, X, FileText
} from 'lucide-react'
import Link from 'next/link'
import VisitModal from '@/app/components/VisitModal'
import { useToast } from '@/app/components/Toast'

const STAGES = ['prospect', 'contacted', 'sample_sent', 'active', 'inactive']
const STATUSES = ['hot', 'warm', 'cold']

export default function PartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [partner, setPartner] = useState<Partner | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [form, setForm] = useState<Partial<Partner>>({})
  const { toast } = useToast()

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: v }, { data: o }] = await Promise.all([
      supabase.from('partners').select('*').eq('id', id).single(),
      supabase.from('visits').select('*').eq('partner_id', id).order('visit_date', { ascending: false }),
      supabase.from('orders').select('*').eq('partner_id', id).order('created_at', { ascending: false }),
    ])
    if (!p) { router.push('/partners'); return }
    setPartner(p)
    setForm(p)
    setVisits(v || [])
    setOrders(o || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('partners').update({
      store_name: form.store_name,
      owner_name: form.owner_name,
      phone: form.phone,
      email: form.email,
      city: form.city,
      state: form.state,
      circuit: form.circuit,
      address: form.address,
      sarafa_bazaar: form.sarafa_bazaar,
      store_type: form.store_type,
      annual_revenue: form.annual_revenue,
      model_preference: form.model_preference,
      status: form.status,
      stage: form.stage,
      source: form.source,
      notes: form.notes,
    }).eq('id', id)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Partner updated')
    setEditing(false)
    load()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('partners').delete().eq('id', id)
    setDeleting(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Partner deleted')
    router.push('/partners')
  }


  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading || !partner) return (
    <div className="p-7 text-stone-400 text-sm">Loading...</div>
  )

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/partners" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{partner.store_name}</h1>
          <p className="text-stone-400 text-sm">{partner.owner_name} · {partner.city}</p>
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

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this partner?</h3>
            <p className="text-sm text-stone-500 mb-5">
              This will permanently delete <strong>{partner.store_name}</strong> and all their visit history. Orders will remain.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status + stage badges */}
      {!editing && (
        <div className="flex gap-2 mb-5">
          <span className={`status-pill ${getStatusColor(partner.status)}`}>
            {partner.status}
          </span>
          <span className={`status-pill ${getStatusColor(partner.stage)}`}>
            {partner.stage?.replace(/_/g, ' ')}
          </span>
          {partner.circuit && (
            <span className="status-pill bg-stone-100 text-stone-600">
              {partner.circuit} circuit
            </span>
          )}
        </div>
      )}

      {/* Quick actions (view mode only) */}
      {!editing && (
        <div className="flex gap-2 mb-5">
          <a href={`tel:${partner.phone}`}
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm hover:bg-stone-50">
            <Phone className="w-4 h-4" /> Call
          </a>
          <a href={`https://wa.me/${partner.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-sm hover:bg-green-100">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <button onClick={() => setShowVisitModal(true)}
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-xl text-sm hover:bg-stone-50">
            <Plus className="w-4 h-4" /> Log visit
          </button>
          <Link href={`/orders/new?partner=${id}`}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2 rounded-xl text-sm hover:bg-[#9B7A40]">
            <Plus className="w-4 h-4" /> New order
          </Link>
        </div>
      )}

      {/* View mode — info cards */}
      {!editing ? (
        <div className="space-y-4">
          {/* Store info */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Store details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Store name', partner.store_name],
                ['Owner', partner.owner_name],
                ['Phone', partner.phone],
                ['Email', partner.email || '—'],
                ['Store type', partner.store_type || '—'],
                ['Annual revenue', partner.annual_revenue || '—'],
                ['Model preference', partner.model_preference?.replace(/_/g, ' ') || '—'],
                ['Source', partner.source?.replace(/_/g, ' ') || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Location</h2>
            <div className="flex items-start gap-2 text-sm text-stone-600">
              <MapPin className="w-4 h-4 mt-0.5 text-stone-400 shrink-0" />
              <div>
                <p>{partner.address || partner.sarafa_bazaar || '—'}</p>
                <p className="text-stone-400">{partner.city}, {partner.state}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {partner.notes && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-2">Notes</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{partner.notes}</p>
            </div>
          )}

          {/* Visit log */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-medium text-stone-900">Visit history ({visits.length})</h2>
              <button onClick={() => setShowVisitModal(true)}
                className="text-xs text-[#C49C64] hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Log visit
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="px-5 py-6 text-sm text-stone-400">No visits logged yet</div>
            ) : (
              <div className="divide-y divide-stone-50">
                {visits.map(v => (
                  <div key={v.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-stone-700 capitalize">
                        {v.outcome?.replace(/_/g, ' ') || 'Visit'}
                      </p>
                      <p className="text-xs text-stone-400">{formatDate(v.visit_date)}</p>
                    </div>
                    {v.notes && <p className="text-xs text-stone-500">{v.notes}</p>}
                    <div className="flex gap-3 mt-1">
                      {v.catalog_left && <span className="text-xs text-stone-400">Catalog left ✓</span>}
                      {v.sample_offered && <span className="text-xs text-stone-400">Sample offered ✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders */}
          {orders.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="font-medium text-stone-900">Orders ({orders.length})</h2>
              </div>
              <div className="divide-y divide-stone-50">
                {orders.map(o => (
                  <Link key={o.id} href={`/orders/${o.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{o.order_number}</p>
                      <p className="text-xs text-stone-400 capitalize">{o.status?.replace(/_/g, ' ')}</p>
                    </div>
                    <p className="text-sm font-medium text-stone-700">₹{o.total_amount?.toLocaleString('en-IN')}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        /* Edit mode */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Store information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Store name *</label><input className={inp} value={form.store_name || ''} onChange={e => set('store_name', e.target.value)} /></div>
              <div><label className={lbl}>Owner name *</label><input className={inp} value={form.owner_name || ''} onChange={e => set('owner_name', e.target.value)} /></div>
              <div><label className={lbl}>Phone *</label><input className={inp} value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
              <div><label className={lbl}>Email</label><input className={inp} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
              <div><label className={lbl}>City</label><input className={inp} value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
              <div>
                <label className={lbl}>State</label>
                <select className={inp} value={form.state || ''} onChange={e => set('state', e.target.value)}>
                  {['Gujarat','Maharashtra','Madhya Pradesh','Rajasthan','Karnataka','Tamil Nadu','Delhi','Uttar Pradesh','Punjab','Haryana'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Circuit</label>
                <select className={inp} value={form.circuit || ''} onChange={e => set('circuit', e.target.value)}>
                  <option value="">None</option>
                  {['Gujarat','Maharashtra','MP','Rajasthan'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Address / Market</label><input className={inp} value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">CRM details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || 'cold'} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Stage</label>
                <select className={inp} value={form.stage || 'prospect'} onChange={e => set('stage', e.target.value)}>
                  {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Model preference</label>
                <select className={inp} value={form.model_preference || ''} onChange={e => set('model_preference', e.target.value)}>
                  <option value="">Not decided</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="design_make">Design + Make</option>
                  <option value="white_label">White Label</option>
                  <option value="all">All models</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Annual revenue</label>
                <select className={inp} value={form.annual_revenue || ''} onChange={e => set('annual_revenue', e.target.value)}>
                  <option value="">Not known</option>
                  <option value="under_50L">Under ₹50L</option>
                  <option value="50L-1Cr">₹50L – ₹1Cr</option>
                  <option value="1Cr-5Cr">₹1Cr – ₹5Cr</option>
                  <option value="above_5Cr">Above ₹5Cr</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes</label>
                <textarea className={`${inp} resize-none`} rows={3}
                  value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit modal */}
      <VisitModal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        partnerId={id}
        partnerCity={partner.city}
        partnerCircuit={partner.circuit}
        onSaved={load}
      />
    </div>
  )
}
