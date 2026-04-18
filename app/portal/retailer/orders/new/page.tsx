'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, X, Plus } from 'lucide-react'

const CLOUDINARY_CLOUD = 'ddnlacdta'
const CLOUDINARY_PRESET = 'shewah-b2b'

export default function RetailerNewCustomOrder() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    brief_text: '',
    quantity: '1',
    ring_size: '',
    special_notes: '',
  })
  const [images, setImages] = useState<string[]>([])

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    const urls: string[] = []
    for (const file of Array.from(files).slice(0, 10)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', CLOUDINARY_PRESET)
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
          method: 'POST', body: fd,
        })
        const data = await res.json()
        if (data.secure_url) urls.push(data.secure_url)
      } catch (e: any) {
        setError(e?.message || 'Upload failed')
      }
    }
    setImages(prev => [...prev, ...urls].slice(0, 20))
    setUploading(false)
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!form.brief_text.trim()) { setError('Please describe what you need'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'custom',
        brief_text: form.brief_text,
        quantity: parseInt(form.quantity) || 1,
        ring_size: form.ring_size || null,
        special_notes: form.special_notes || null,
        reference_images: images,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Could not place order'); return }
    router.push(`/portal/retailer/orders/${data.order.id}`)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl mx-auto">
      <Link href="/portal/retailer" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Custom design order</h1>
        <p className="text-stone-500 text-sm">Tell us what you need and attach reference images. Our team will revert with a quote.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <label className={lbl}>Design brief *</label>
          <textarea rows={5} className={`${inp} resize-none`}
            placeholder="Describe the customer's requirement: design style, gemstones, gold karat, occasion, budget hint..."
            value={form.brief_text}
            onChange={e => setForm(f => ({ ...f, brief_text: e.target.value }))} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className={lbl}>Quantity</label>
              <input type="number" min="1" className={inp} value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Ring size (if applicable)</label>
              <input className={inp} value={form.ring_size}
                placeholder="e.g. 16"
                onChange={e => setForm(f => ({ ...f, ring_size: e.target.value }))} />
            </div>
          </div>

          <div className="mt-4">
            <label className={lbl}>Anything else</label>
            <textarea rows={2} className={`${inp} resize-none`} value={form.special_notes}
              placeholder="Hallmark, packaging preferences, deadlines..."
              onChange={e => setForm(f => ({ ...f, special_notes: e.target.value }))} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-stone-800 text-sm">Reference images</label>
            <label className="flex items-center gap-1.5 text-xs text-[#C49C64] hover:text-[#9B7A40] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Add images'}
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => uploadImages(e.target.files)} disabled={uploading} />
            </label>
          </div>
          {images.length === 0 ? (
            <label className="block border-2 border-dashed border-stone-200 rounded-lg p-6 text-center cursor-pointer hover:border-[#C49C64] transition-colors">
              <Plus className="w-6 h-6 mx-auto text-stone-300 mb-1" />
              <p className="text-xs text-stone-400">Tap to upload reference photos</p>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => uploadImages(e.target.files)} disabled={uploading} />
            </label>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/portal/retailer"
            className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving || uploading}
            className="flex items-center gap-2 bg-[#C49C64] hover:bg-[#9B7A40] text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Submitting...' : 'Submit order'}
          </button>
        </div>
      </div>
    </div>
  )
}
