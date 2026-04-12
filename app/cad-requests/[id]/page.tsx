'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor, formatCurrency } from '@/lib/utils'
import { ArrowLeft, Save, Edit2, X, Clock, CheckCircle2, Copy, Check, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'

export default function CADRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { toast } = useToast()

  const [cadRequest, setCadRequest] = useState<any>(null)
  const [partner, setPartner] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: request } = await supabase
      .from('cad_requests')
      .select('*, partners(store_name, owner_name, phone, city)')
      .eq('id', id)
      .single()

    if (!request) { router.push('/cad-requests'); return }

    setCadRequest(request)
    setPartner(request.partners)
    setForm(request)
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('cad_requests').update({
      priority: form.priority,
      due_date: form.due_date,
      brief_text: form.brief_text,
      diamond_shape: form.diamond_shape,
      diamond_weight: form.diamond_weight || null,
      gold_karat: parseInt(form.gold_karat) || null,
      setting_type: form.setting_type || null,
      special_requests: form.special_requests || null,
      status: form.status,
      revision_notes: form.revision_notes || null,
    }).eq('id', id)

    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setEditing(false)
    toast('CAD request updated successfully', 'success')
    load()
  }

  async function handleDelete() {
    const { error } = await supabase.from('cad_requests').delete().eq('id', id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('CAD request deleted', 'success')
    router.push('/cad-requests')
  }

  function copyRequestNumber() {
    navigator.clipboard.writeText(cadRequest?.request_number || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading request...</div>
  if (!cadRequest) return null

  // Calculate timing
  const due = cadRequest.due_date ? new Date(cadRequest.due_date).getTime() : 0
  const now = Date.now()
  const hrsLeft = due ? Math.max(0, Math.floor((due - now) / 3600000)) : 0
  const isOverdue = due && now > due && cadRequest.status !== 'approved' && cadRequest.status !== 'sent'

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/cad-requests" className="text-stone-400 hover:text-stone-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-900">{cadRequest.request_number}</h1>
            <button onClick={copyRequestNumber} className="text-stone-300 hover:text-stone-600">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <span className={`status-pill ${getStatusColor(cadRequest.status)}`}>
              {cadRequest.status?.replace(/_/g, ' ')}
            </span>
            {cadRequest.priority === 'urgent' && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">URGENT</span>
            )}
          </div>
          <p className="text-stone-400 text-sm mt-0.5">
            Received: {formatDate(cadRequest.received_date)}
          </p>
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
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(cadRequest) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this CAD request?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete request <strong>{cadRequest.request_number}</strong>? This cannot be undone.
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
          {/* SLA Tracking */}
          {cadRequest.status !== 'approved' && (
            <div className={`p-4 rounded-xl border ${isOverdue ? 'bg-red-50 border-red-200 text-red-800' : hrsLeft <= 12 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                <span className="font-medium text-sm">SLA Timer</span>
              </div>
              <p className="text-sm">
                {isOverdue ? `Overdue by ${Math.floor((now - due) / 3600000)} hours`
                 : hrsLeft > 0 ? `${hrsLeft} hours remaining to send initial CAD`
                 : 'Due soon'}
              </p>
              <p className="text-xs opacity-75 mt-1">Due Date: {formatDate(cadRequest.due_date)}</p>
            </div>
          )}

          {/* Partner Info */}
          {partner && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">Partner Details</h2>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-sm">
                <div>
                  <p className="font-medium text-stone-800">{partner.store_name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{partner.owner_name} · {partner.city}</p>
                </div>
                <div className="flex gap-4 p-2 bg-stone-50 rounded-lg">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wide">Phone</p>
                    <p className="font-medium mt-0.5">{partner.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Brief and Requirements */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Design Requirements</h2>
            
            <div className="mb-5 p-4 bg-stone-50 rounded-lg border border-stone-100">
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Brief</p>
              <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">{cadRequest.brief_text}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-stone-400">Diamond Shape</p>
                <p className="font-medium mt-0.5 capitalize">{cadRequest.diamond_shape || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Est. Weight</p>
                <p className="font-medium mt-0.5">{cadRequest.diamond_weight || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Gold Karat</p>
                <p className="font-medium mt-0.5">{cadRequest.gold_karat ? `${cadRequest.gold_karat}K` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Setting Style</p>
                <p className="font-medium mt-0.5 capitalize">{cadRequest.setting_type || '—'}</p>
              </div>
            </div>

            {cadRequest.special_requests && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Special Notes / Constraints</p>
                <p className="text-sm text-stone-700">{cadRequest.special_requests}</p>
              </div>
            )}
          </div>
          
          {/* Revisions */}
          {(cadRequest.revision_notes || cadRequest.status === 'revision_requested') && (
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
              <h2 className="text-orange-800 font-medium mb-2">Revision Notes</h2>
              <p className="text-sm text-orange-700 whitespace-pre-wrap">{cadRequest.revision_notes || 'No notes provided. Customer requested a revision.'}</p>
            </div>
          )}

        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Edit Request details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="sent">Sent</option>
                  <option value="revision_requested">Revision Requested</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Priority</label>
                <select className={inp} value={form.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Due Date</label>
                <input type="date" className={inp} value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Gold Karat</label>
                <select className={inp} value={form.gold_karat || ''} onChange={e => set('gold_karat', e.target.value)}>
                  <option value="14">14K</option>
                  <option value="18">18K</option>
                  <option value="22">22K</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Diamond Shape</label>
                <select className={inp} value={form.diamond_shape || ''} onChange={e => set('diamond_shape', e.target.value)}>
                  {['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Est. Diamond Weight</label>
                <input className={inp} value={form.diamond_weight || ''} onChange={e => set('diamond_weight', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Setting Style</label>
                <input className={inp} value={form.setting_type || ''} onChange={e => set('setting_type', e.target.value)} />
              </div>
              
              <div className="sm:col-span-2">
                <label className={lbl}>Brief</label>
                <textarea className={`${inp} resize-none`} rows={4} value={form.brief_text || ''} onChange={e => set('brief_text', e.target.value)} />
              </div>
              
              <div className="sm:col-span-2">
                <label className={lbl}>Special Requests</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.special_requests || ''} onChange={e => set('special_requests', e.target.value)} />
              </div>

              {(form.status === 'revision_requested' || form.revision_notes) && (
                <div className="sm:col-span-2 mt-4">
                  <label className={lbl}>Revision Notes</label>
                  <textarea className={`${inp} resize-none border-orange-300 bg-orange-50 focus:border-orange-500`} rows={3} value={form.revision_notes || ''} onChange={e => set('revision_notes', e.target.value)} placeholder="Enter details about what needs to be changed..." />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
