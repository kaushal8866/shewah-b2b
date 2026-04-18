'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

export default function RetailerCustomOrderPage() {
  const router = useRouter()
  const [brief, setBrief] = useState('')
  const [qty, setQty] = useState('1')
  const [size, setSize] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        const u = await uploadToCloudinary(f)
        urls.push(u)
      }
      setImages(prev => [...prev, ...urls])
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function remove(url: string) { setImages(prev => prev.filter(u => u !== url)) }

  async function submit() {
    if (!brief.trim()) { setError('Describe what you would like Shewah to make.'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'custom',
        quantity: parseInt(qty) || 1,
        ring_size: size || null,
        special_notes: notes || null,
        brief_text: brief,
        brief_images: images,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'Could not submit order'); return }
    router.push(`/portal/retailer/orders/${data.order.id}`)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl mx-auto">
      <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Catalog
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/15 text-[#1E3A5F] flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Custom design order</h1>
          <p className="text-stone-500 text-sm">Describe the piece you want and attach reference images.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div>
          <label className={lbl}>Design brief *</label>
          <textarea rows={5} className={`${inp} resize-none`}
            placeholder="Describe the style, occasion, customer preference, diamond size, gold karat, budget..."
            value={brief} onChange={e => setBrief(e.target.value)} />
        </div>

        <div>
          <label className={lbl}>Reference images</label>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {images.map(u => (
                <div key={u} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => remove(u)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Add images'}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleUpload(e.target.files)} disabled={uploading} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Quantity</label>
            <input type="number" inputMode="numeric" min="1" className={inp}
              value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Ring size (if known)</label>
            <input className={inp} placeholder="e.g. 16, 17, 18"
              value={size} onChange={e => setSize(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Notes for Shewah</label>
          <textarea rows={3} className={`${inp} resize-none`}
            placeholder="Anything else we should know..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end">
          <button onClick={submit} disabled={submitting || uploading}
            className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Sparkles className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit custom request'}
          </button>
        </div>
        <p className="text-[11px] text-stone-400">
          Shewah will respond with a CAD draft and pricing based on your brief.
        </p>
      </div>
    </div>
  )
}
