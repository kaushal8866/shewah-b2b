'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X } from 'lucide-react'
import Link from 'next/link'

const CAD_STATUSES = [
  { value: 'brief_received', label: 'Brief Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'sent', label: 'Sent to Partner' },
  { value: 'revision', label: 'Revision Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function CadRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [req, setReq] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cad_requests')
      .select('*, partners(store_name, owner_name, city)')
      .eq('id', id)
      .single()
    if (!data) { router.push('/cad-requests'); return }
    setReq(data)
    setForm(data)
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const update: any = {
      status: form.status,
      brief_text: form.brief_text || null,
      diamond_shape: form.diamond_shape || null,
      diamond_weight: form.diamond_weight || null,
      gold_karat: form.gold_karat ? parseInt(form.gold_karat) : null,
      setting_type: form.setting_type || null,
      special_requests: form.special_requests || null,
      priority: form.priority || 'normal',
      due_date: form.due_date || null,
      revision_notes: form.revision_notes || null,
      partner_feedback: form.partner_feedback || null,
    }
    if (form.status === 'sent' && !req.sent_date) {
      update.sent_date = new Date().toISOString().split('T')[0]
    }
    if (form.status === 'approved' && !req.approved_date) {
      update.approved_date = new Date().toISOString().split('T')[0]
    }
    const { error } = await supabase.from('cad_requests').update(update).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  async function handleDelete() {
    // Unlink any orders that reference this CAD request before deleting
    await supabase.from('orders').update({ cad_request_id: null }).eq('cad_request_id', id)
    const { error } = await supabase.from('cad_requests').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/cad-requests')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cad-requests" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{req.request_number}</h1>
          <p className="text-stone-400 text-sm">{req.partners?.store_name} · {req.partners?.city}</p>
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
              <button onClick={() => { setEditing(false); setForm(req) }}
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
            <h3 className="font-semibold text-stone-900 mb-2">Delete this request?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{req.request_number}</strong>? This cannot be undone.
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
            <span className={`status-pill ${getStatusColor(req.status)}`}>
              {CAD_STATUSES.find(s => s.value === req.status)?.label || req.status?.replace(/_/g, ' ')}
            </span>
            <span className={`status-pill ${req.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'}`}>
              {req.priority === 'urgent' ? 'Urgent' : 'Normal priority'}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Request details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Partner', req.partners?.store_name],
                ['Owner', req.partners?.owner_name],
                ['Received', formatDate(req.received_date)],
                ['Due date', req.due_date ? formatDate(req.due_date) : '—'],
                ['Sent date', req.sent_date ? formatDate(req.sent_date) : '—'],
                ['Approved date', req.approved_date ? formatDate(req.approved_date) : '—'],
                ['Diamond shape', req.diamond_shape || '—'],
                ['Diamond weight', req.diamond_weight || '—'],
                ['Gold karat', req.gold_karat ? `${req.gold_karat}K` : '—'],
                ['Setting type', req.setting_type || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v || '—')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Design brief</h2>
            <p className="text-sm text-stone-700 leading-relaxed">{req.brief_text || 'No brief provided'}</p>
            {req.special_requests && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Special requests</p>
                <p className="text-sm text-stone-700 leading-relaxed">{req.special_requests}</p>
              </div>
            )}
          </div>

          {(req.revision_notes || req.partner_feedback) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              {req.revision_notes && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Revision notes</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{req.revision_notes}</p>
                </div>
              )}
              {req.partner_feedback && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Partner feedback</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{req.partner_feedback}</p>
                </div>
              )}
            </div>
          )}

          {req.reference_images && req.reference_images.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">Reference images</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {req.reference_images.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden border border-stone-200 block">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {req.cad_files && req.cad_files.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">CAD files</h2>
              <div className="space-y-2">
                {req.cad_files.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-[#C49C64] hover:underline break-all">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Update request</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  {CAD_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Priority</label>
                <select className={inp} value={form.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
                  <option value="normal">Normal (48 hours)</option>
                  <option value="urgent">Urgent (24 hours)</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Due date</label>
                <input type="date" className={inp} value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Diamond shape</label>
                <select className={inp} value={form.diamond_shape || ''} onChange={e => set('diamond_shape', e.target.value)}>
                  <option value="">Any</option>
                  {['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Diamond weight</label>
                <input className={inp} value={form.diamond_weight || ''} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5ct" />
              </div>
              <div>
                <label className={lbl}>Gold karat</label>
                <select className={inp} value={form.gold_karat || ''} onChange={e => set('gold_karat', e.target.value)}>
                  <option value="">Any</option>
                  <option value="14">14K</option>
                  <option value="18">18K</option>
                  <option value="22">22K</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Setting type</label>
                <input className={inp} value={form.setting_type || ''} onChange={e => set('setting_type', e.target.value)} placeholder="e.g. prong, bezel, pavé" />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Design brief</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.brief_text || ''} onChange={e => set('brief_text', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Special requests</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.special_requests || ''} onChange={e => set('special_requests', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Revision notes</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.revision_notes || ''} onChange={e => set('revision_notes', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Partner feedback</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.partner_feedback || ''} onChange={e => set('partner_feedback', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
