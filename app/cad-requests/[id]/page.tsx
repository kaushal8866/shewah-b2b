'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, Upload, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { useCadRequestRealtimeToasts, CadToastStack } from '@/components/CadRealtimeToasts'

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
  const [revisions, setRevisions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})
  const [uploading, setUploading] = useState(false)
  const [renderNote, setRenderNote] = useState('')
  // Staged reference images uploaded ahead of the render share. They get
  // attached to the next render upload (saved on the same cad_revisions row)
  // so retailers see annotations / before-after sketches alongside the render.
  // Each item carries an optional caption (Task 42) so the retailer knows what
  // they're looking at (e.g. "Before halo change", "Inspiration").
  const [stagedRefs, setStagedRefs] = useState<{ url: string; caption: string }[]>([])
  const [refUploading, setRefUploading] = useState(false)

  // Live updates: when the retailer acts on the CAD they're currently
  // viewing, splice the new fields into local state so the badges, dates and
  // feedback refresh, then refetch the revisions list to pick up the new
  // timeline entry.
  const { toasts, dismiss } = useCadRequestRealtimeToasts({
    onChange: (row) => {
      if (row.id !== id) return
      setReq((prev: any) => (prev ? { ...prev, ...row } : prev))
      // Refresh the revisions timeline to show the retailer's new entry.
      supabase
        .from('cad_revisions')
        .select('id, created_at, kind, author, note, render_images, reference_images, reference_captions')
        .eq('cad_request_id', id)
        .order('created_at', { ascending: true })
        .then(({ data }: any) => setRevisions(data || []))
    },
  })

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cad_requests')
      .select('*, partners(store_name, owner_name, city), orders(order_number)')
      .eq('id', id)
      .single()
    if (!data) { router.push('/cad-requests'); return }
    setReq(data)
    setForm(data)
    const { data: revs } = await supabase
      .from('cad_revisions')
      .select('id, created_at, kind, author, note, render_images, reference_images, reference_captions, acknowledged_at')
      .eq('cad_request_id', id)
      .order('created_at', { ascending: true })
    setRevisions(revs || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  // Upload one or more new render images. We append them to render_images and
  // also write a single `render` row to cad_revisions so the retailer sees a
  // new entry in the timeline (with the optional note that goes with this
  // round). After saving, the request flips to `sent` so the retailer can
  // act on it.
  async function handleRenderUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const newUrls: string[] = []
    try {
      for (const file of Array.from(files)) {
        try {
          newUrls.push(await uploadToCloudinary(file))
        } catch (err) {
          alert('Render upload failed: ' + (err instanceof Error ? err.message : String(err)))
        }
      }
      if (newUrls.length === 0) return

      const merged = [...(req.render_images || []), ...newUrls]
      const today = new Date().toISOString().split('T')[0]
      const cadUpdate: any = {
        render_images: merged,
        status: 'sent',
        partner_feedback: null, // clear stale prior-round feedback for the new round
      }
      if (!req.sent_date) cadUpdate.sent_date = today

      const { error: e1 } = await supabase
        .from('cad_requests')
        .update(cadUpdate)
        .eq('id', id)
      if (e1) { alert('Error: ' + e1.message); return }

      const { error: e2 } = await supabase.from('cad_revisions').insert({
        cad_request_id: id,
        kind: 'render',
        author: 'admin',
        note: renderNote.trim() || null,
        render_images: newUrls,
        reference_images: stagedRefs.length > 0 ? stagedRefs.map(r => r.url) : null,
        // Parallel array of captions; preserve length/index alignment with
        // reference_images so empty captions don't shift other entries.
        reference_captions: stagedRefs.length > 0
          ? stagedRefs.map(r => r.caption.trim() || null)
          : null,
      })
      if (e2) { alert('Saved render but failed to log revision: ' + e2.message) }

      // Move the order back into the cad_sent state so the retailer sees it.
      if (req.order_id) {
        await supabase.from('orders').update({ status: 'cad_sent' }).eq('id', req.order_id)
      }

      setRenderNote('')
      setStagedRefs([])
      load()
    } finally {
      setUploading(false)
    }
  }

  // Stage reference / annotation images that will be attached to the next
  // render share. They live only in local state until the team clicks
  // "Upload render images". Task 36.
  async function handleReferenceUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setRefUploading(true)
    try {
      const newUrls: string[] = []
      for (const file of Array.from(files)) {
        try {
          newUrls.push(await uploadToCloudinary(file))
        } catch (err) {
          alert('Reference upload failed: ' + (err instanceof Error ? err.message : String(err)))
        }
      }
      if (newUrls.length > 0) {
        setStagedRefs(prev => [...prev, ...newUrls.map(url => ({ url, caption: '' }))])
      }
    } finally {
      setRefUploading(false)
    }
  }

  function removeStagedRef(url: string) {
    setStagedRefs(prev => prev.filter(r => r.url !== url))
  }

  function setStagedRefCaption(url: string, caption: string) {
    setStagedRefs(prev => prev.map(r => (r.url === url ? { ...r, caption } : r)))
  }

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

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <CadToastStack toasts={toasts} onDismiss={dismiss} />
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
                className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
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

          {req.revision_notes && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <p className="text-xs text-stone-400 mb-1">Internal revision notes</p>
              <p className="text-sm text-stone-700 leading-relaxed">{req.revision_notes}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C49C64]" /> Revision history
            </h2>
            {revisions.length === 0 ? (
              <p className="text-sm text-stone-400">
                No revisions yet. Upload a render below to share the first round with the retailer.
              </p>
            ) : (
              <ol className="space-y-3 border-l border-stone-200 pl-4">
                {revisions.map((r) => {
                  const dot =
                    r.kind === 'approval'
                      ? 'bg-green-500'
                      : r.kind === 'revision_request'
                      ? 'bg-amber-500'
                      : 'bg-[#C49C64]'
                  const label =
                    r.kind === 'approval'
                      ? 'Retailer approved the design'
                      : r.kind === 'revision_request'
                      ? 'Retailer requested a revision'
                      : 'You shared a new CAD render'
                  const imgs: string[] = Array.isArray(r.render_images) ? r.render_images : []
                  const refs: string[] = Array.isArray(r.reference_images) ? r.reference_images : []
                  const ackedAt: string | null = r.kind === 'revision_request' ? (r.acknowledged_at || null) : null
                  const refCaps: (string | null)[] = Array.isArray(r.reference_captions) ? r.reference_captions : []
                  return (
                    <li key={r.id} className="relative">
                      <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-stone-800">{label}</p>
                        <p className="text-[11px] text-stone-400">{formatDate(r.created_at)}</p>
                      </div>
                      {r.note && (
                        <p className="text-sm text-stone-600 whitespace-pre-line mt-1">{r.note}</p>
                      )}
                      {r.kind === 'revision_request' && (
                        ackedAt ? (
                          <p className="text-[11px] text-green-700 mt-1">
                            ✓ Acknowledged by design team · {formatDate(ackedAt)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Awaiting acknowledgement (reply "ACK {req.orders?.order_number || req.request_number}" to the WhatsApp ping)
                          </p>
                        )
                      )}
                      {imgs.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
                          {imgs.map((src, i) => (
                            <a key={i} href={src} target="_blank" rel="noreferrer"
                              className="block aspect-square bg-stone-100 rounded-md overflow-hidden border border-stone-200">
                              <img src={src} alt={`Render ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {refs.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] text-stone-400 mb-1">Reference / annotation images</p>
                          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                            {refs.map((src, i) => {
                              const caption = (refCaps[i] || '').trim()
                              return (
                                <div key={i} className="flex flex-col gap-0.5">
                                  <a href={src} target="_blank" rel="noreferrer"
                                    className="block aspect-square bg-stone-50 rounded-md overflow-hidden border border-dashed border-stone-300">
                                    <img src={src} alt={caption || `Reference ${i + 1}`} className="w-full h-full object-cover" />
                                  </a>
                                  {caption && (
                                    <p className="text-[10px] text-stone-500 leading-snug line-clamp-2" title={caption}>{caption}</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}

            <div className="mt-5 pt-4 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-2">Share a new render with the retailer</p>
              <textarea
                value={renderNote}
                onChange={e => setRenderNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Optional: what changed in this round (e.g. 'Enlarged centre stone, switched to hidden halo')"
                className={`${inp} resize-none mb-2`}
                disabled={uploading}
              />
              {stagedRefs.length > 0 && (
                <div className="mb-2">
                  <p className="text-[11px] text-stone-500 mb-1">
                    {stagedRefs.length} reference image{stagedRefs.length === 1 ? '' : 's'} attached to this round · add an optional caption so the retailer knows what each one shows
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {stagedRefs.map((ref, i) => (
                      <div key={ref.url} className="border border-dashed border-stone-300 rounded-md p-1.5 bg-stone-50">
                        <div className="relative aspect-square bg-white rounded overflow-hidden border border-stone-200 mb-1.5">
                          <img src={ref.url} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeStagedRef(ref.url)}
                            disabled={uploading}
                            className="absolute top-0.5 right-0.5 bg-white/90 text-stone-600 rounded-full p-0.5 hover:bg-white hover:text-red-500 disabled:opacity-50"
                            aria-label="Remove reference"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={ref.caption}
                          onChange={e => setStagedRefCaption(ref.url, e.target.value)}
                          maxLength={120}
                          disabled={uploading}
                          placeholder='Caption (e.g. "Before halo change")'
                          className="w-full border border-stone-200 rounded px-2 py-1 text-xs focus:border-[#1E3A5F] outline-none bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className={`flex items-center gap-2 border border-dashed border-stone-200 rounded-lg px-3 py-2 text-sm cursor-pointer ${uploading || refUploading ? 'text-stone-300 pointer-events-none' : 'text-stone-600 hover:bg-stone-50'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading || refUploading}
                    onChange={e => { handleReferenceUpload(e.target.files); e.currentTarget.value = '' }}
                  />
                  <Upload className={`w-4 h-4 ${refUploading ? 'animate-pulse' : ''}`} />
                  {refUploading ? 'Uploading...' : 'Add reference / annotation'}
                </label>
                <label className={`flex items-center gap-2 border border-dashed border-[#1E3A5F]/30 bg-[#1E3A5F]/5 rounded-lg px-3 py-2 text-sm cursor-pointer ${uploading || refUploading ? 'text-stone-300 pointer-events-none' : 'text-[#1E3A5F] hover:bg-[#1E3A5F]/10'}`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading || refUploading}
                    onChange={e => { handleRenderUpload(e.target.files); e.currentTarget.value = '' }}
                  />
                  <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                  {uploading ? 'Sharing...' : 'Upload render images'}
                </label>
              </div>
              <p className="text-[11px] text-stone-400 mt-2">
                Add any reference / annotation images first, then upload renders to share. They'll be saved together as one revision so the retailer can compare side by side. The request will be marked as sent.
              </p>
            </div>
          </div>

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
                    className="flex items-center gap-2 text-sm text-[#1E3A5F] hover:underline break-all">
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
