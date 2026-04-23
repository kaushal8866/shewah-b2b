'use client'

import { useEffect, useState } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { Camera, Eye, EyeOff, Plus, Trash2, X, Image as ImageIcon, Loader2 } from 'lucide-react'

type Update = {
  id: string
  title: string
  body: string | null
  photo_url: string | null
  is_customer_visible: boolean
  created_at: string
}

function fmtDateTime(d: string): string {
  try { return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return d }
}

export default function ProductionUpdatesPanel({ orderId }: { orderId: string }) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [visible, setVisible] = useState(true)

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/production-updates`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not load'); return }
      setUpdates(d.updates || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [orderId])

  function reset() {
    setTitle(''); setBody(''); setPhotoUrl(''); setVisible(true); setShowForm(false)
  }

  async function handleFile(f: File) {
    if (!f.type.startsWith('image/')) { setError('Only image files allowed'); return }
    setUploading(true); setError(null)
    try {
      const url = await uploadToCloudinary(f, 'production_update')
      setPhotoUrl(url)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally { setUploading(false) }
  }

  async function submit() {
    if (!title.trim()) { setError('Title is required'); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/production-updates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null, photo_url: photoUrl || null, is_customer_visible: visible }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not save'); return }
      reset()
      await load()
    } finally { setBusy(false) }
  }

  async function toggleVisibility(u: Update) {
    setBusy(true)
    try {
      const r = await fetch(`/api/orders/${orderId}/production-updates/${u.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_customer_visible: !u.is_customer_visible }),
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Could not update'); return }
      await load()
    } finally { setBusy(false) }
  }

  async function remove(u: Update) {
    if (!confirm('Delete this update? This cannot be undone.')) return
    setBusy(true)
    try {
      const r = await fetch(`/api/orders/${orderId}/production-updates/${u.id}`, { method: 'DELETE' })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Could not delete'); return }
      await load()
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-stone-500" />
          <h3 className="font-medium text-stone-900">Production updates</h3>
          {updates.length > 0 && (
            <span className="text-[11px] text-stone-500">({updates.length})</span>
          )}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="text-sm bg-[#1E3A5F] hover:bg-[#162B47] text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New update
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-stone-200 rounded-xl p-4 mb-4 bg-stone-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-stone-700">New production update</p>
            <button onClick={reset} className="text-stone-400 hover:text-stone-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input type="text" maxLength={140} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Casting complete"
            className="w-full mb-2 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none" />
          <textarea rows={3} value={body} onChange={e => setBody(e.target.value)}
            placeholder="Optional details for the customer (kept warm and friendly)"
            className="w-full mb-2 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none resize-none" />
          <div className="flex items-center gap-3 mb-3">
            {photoUrl ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setPhotoUrl('')} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center gap-2 text-sm text-stone-600 border border-dashed border-stone-300 rounded-lg px-3 py-2 hover:border-[#1E3A5F] hover:text-[#1E3A5F]">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                <span>{uploading ? 'Uploading...' : 'Attach photo (optional)'}</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 mb-3">
            <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />
            <span>Show to customer on their journey link</span>
          </label>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy || uploading || !title.trim()}
              className="bg-[#1E3A5F] hover:bg-[#162B47] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
              {busy ? 'Posting...' : 'Post update'}
            </button>
            <button onClick={reset} disabled={busy}
              className="text-sm text-stone-500 px-3 py-2 hover:bg-stone-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-stone-400">Loading...</p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-stone-400">
          No updates posted yet. Share casting, stone-setting, polish milestones with the customer here.
        </p>
      ) : (
        <ol className="space-y-3">
          {updates.map(u => (
            <li key={u.id} className="border border-stone-200 rounded-xl p-3 flex gap-3">
              {u.photo_url && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.photo_url} alt={u.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <p className="font-medium text-stone-900 text-sm truncate">{u.title}</p>
                  {!u.is_customer_visible && (
                    <span className="text-[10px] uppercase tracking-wider bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">Hidden</span>
                  )}
                </div>
                {u.body && <p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{u.body}</p>}
                <p className="text-[11px] text-stone-400 mt-1.5">{fmtDateTime(u.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => toggleVisibility(u)} disabled={busy}
                  title={u.is_customer_visible ? 'Hide from customer' : 'Show to customer'}
                  className="text-stone-400 hover:text-stone-700 p-1.5">
                  {u.is_customer_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => remove(u)} disabled={busy}
                  className="text-stone-400 hover:text-red-600 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
