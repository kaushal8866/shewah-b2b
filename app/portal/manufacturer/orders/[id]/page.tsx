'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

const STATUS_OPTIONS = [
  { value: 'issued', label: 'Issued' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'quality_check', label: 'QC ready' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_STYLES: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  quality_check: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  returned: 'bg-stone-200 text-stone-700',
  cancelled: 'bg-red-100 text-red-700',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

export default function ManufacturerOrderDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => { load() }, [id])

  async function load() {
    setError('')
    const res = await fetch(`/api/portal/manufacturer/orders/${id}`)
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to load'); return }
    setOrder(data.order)
    setStatus(data.order.status || '')
    setNotes(data.order.manufacturer_notes || '')
    setPhotos(data.order.reference_images || [])
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/portal/manufacturer/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        manufacturer_notes: notes,
        reference_images: photos,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed'); return }
    setOrder(data.order)
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(null), 2500)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        const url = await uploadToCloudinary(f)
        urls.push(url)
      }
      setPhotos(prev => [...prev, ...urls])
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(url: string) {
    setPhotos(prev => prev.filter(p => p !== url))
  }

  if (error && !order) {
    return (
      <div className="p-4 lg:p-7 max-w-3xl mx-auto">
        <Link href="/portal/manufacturer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      </div>
    )
  }

  if (!order) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/portal/manufacturer" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{order.order_number}</h1>
          <p className="text-stone-400 text-xs">Issued {fmtDate(order.issued_date)}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[order.status] || 'bg-stone-100 text-stone-600'}`}>
          {order.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <div className="space-y-4">
        {/* Brief */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-3">Order brief</h2>
          <p className="text-sm text-stone-700 whitespace-pre-wrap mb-3">{order.description || '—'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-sm">
            {[
              ['Quantity', order.quantity],
              ['Ring size', order.ring_size || '—'],
              ['Gold karat', order.gold_karat ? `${order.gold_karat}K` : '—'],
              ['Diamond wt', order.diamond_weight ? `${order.diamond_weight}ct` : '—'],
              ['Weight needed', order.gold_weight_required ? `${order.gold_weight_required}g` : '—'],
              ['Expected', fmtDate(order.expected_date)],
              ['Completed', fmtDate(order.completed_date)],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs text-stone-400">{k}</p>
                <p className="text-stone-800 mt-0.5">{String(v)}</p>
              </div>
            ))}
          </div>
          {order.special_notes && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-1">Special instructions</p>
              <p className="text-sm text-stone-700">{order.special_notes}</p>
            </div>
          )}
        </div>

        {/* Reference / progress photos */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-3">Reference & progress photos</h2>
          {photos.length === 0 ? (
            <p className="text-stone-400 text-sm mb-3">No images yet.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {photos.map(url => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                  <button onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Add photos'}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleUpload(e.target.files)} disabled={uploading} />
          </label>
        </div>

        {/* Update */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Update production</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Notes for Shewah</label>
              <textarea rows={4} className={`${inp} resize-none`}
                placeholder="Production updates, issues, QC observations..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save update'}
            </button>
            {savedAt && <span className="text-sm text-green-600">Saved.</span>}
          </div>
          {order.manufacturer_updated_at && (
            <p className="text-xs text-stone-400 mt-3">
              Last updated by you: {new Date(order.manufacturer_updated_at).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
