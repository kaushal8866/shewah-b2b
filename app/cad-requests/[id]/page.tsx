'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X } from 'lucide-react'
import Link from 'next/link'

const CAD_STATUSES = ['brief_received', 'in_progress', 'revision', 'approved', 'cancelled']

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
    const { error } = await supabase.from('cad_requests').update({
      status: form.status,
      title: form.title,
      description: form.description || null,
      revision_notes: form.revision_notes || null,
      cad_file_url: form.cad_file_url || null,
      expected_date: form.expected_date || null,
      internal_notes: form.internal_notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  async function handleDelete() {
    const { error } = await supabase.from('cad_requests').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/cad-requests')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading...</div>

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cad-requests" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 truncate">{req.title}</h1>
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
            <h3 className="font-semibold text-stone-900 mb-2">Delete this CAD request?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{req.title}</strong>? This cannot be undone.
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
              {req.status?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Request details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Partner', req.partners?.store_name],
                ['Owner', req.partners?.owner_name],
                ['Requested', formatDate(req.created_at)],
                ['Expected date', req.expected_date ? formatDate(req.expected_date) : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5">{v}</p>
                </div>
              ))}
              {req.description && (
                <div className="col-span-2">
                  <p className="text-xs text-stone-400">Description / brief</p>
                  <p className="text-stone-800 mt-0.5 leading-relaxed">{req.description}</p>
                </div>
              )}
            </div>
          </div>

          {req.cad_file_url && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">CAD file</h2>
              <a href={req.cad_file_url} target="_blank" rel="noreferrer"
                className="text-sm text-[#C49C64] hover:underline break-all">{req.cad_file_url}</a>
            </div>
          )}

          {(req.revision_notes || req.internal_notes) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              {req.revision_notes && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Revision notes</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{req.revision_notes}</p>
                </div>
              )}
              {req.internal_notes && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Internal notes</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{req.internal_notes}</p>
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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Update request</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  {CAD_STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Title</label>
                <input className={inp} value={form.title || ''} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Description / brief</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Expected date</label>
                <input type="date" className={inp} value={form.expected_date || ''} onChange={e => set('expected_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>CAD file URL</label>
                <input className={inp} value={form.cad_file_url || ''} onChange={e => set('cad_file_url', e.target.value)} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Revision notes</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.revision_notes || ''} onChange={e => set('revision_notes', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Internal notes</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
