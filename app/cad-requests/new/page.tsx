'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { ArrowLeft, Save, Heart, Upload, X } from 'lucide-react'
import Link from 'next/link'

function NewCADRequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prePartner = searchParams.get('partner_id') || ''
  const preProduct = searchParams.get('product_id') || ''

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [partners, setPartners] = useState<{ id: string; store_name: string; city: string }[]>([])
  const [productRef, setProductRef] = useState<{ code: string; name: string; gold_karat?: number; diamond_shape?: string } | null>(null)
  const fromInterest = !!prePartner

  const [form, setForm] = useState({
    partner_id: prePartner,
    brief_text: '',
    diamond_shape: 'round',
    diamond_weight: '',
    gold_karat: '18',
    setting_type: '',
    special_requests: '',
    priority: 'normal',
    due_date: new Date(Date.now() + 48 * 3600000).toISOString().split('T')[0],
  })

  useEffect(() => {
    supabase.from('partners').select('id, store_name, city').eq('stage', 'active')
      .order('store_name').then(({ data }) => setPartners(data || []))
  }, [])

  useEffect(() => {
    if (!preProduct) return
    supabase
      .from('products')
      .select('id, code, name, gold_karat, diamond_shape')
      .eq('id', preProduct)
      .single()
      .then(({ data }) => {
        if (!data) return
        setProductRef(data)
        setForm(prev => ({
          ...prev,
          brief_text: prev.brief_text || `Reference product: ${data.code} — ${data.name}`,
          diamond_shape: data.diamond_shape || prev.diamond_shape,
          gold_karat: data.gold_karat ? String(data.gold_karat) : prev.gold_karat,
        }))
      })
  }, [preProduct])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleImageUpload(files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const url = await uploadToCloudinary(file)
        setReferenceImages(prev => [...prev, url])
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!form.partner_id || !form.brief_text) {
      alert('Partner and brief are required')
      return
    }
    setSaving(true)

    const { count } = await supabase.from('cad_requests').select('*', { count: 'exact', head: true })
    const num = `SH-CAD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { error } = await supabase.from('cad_requests').insert([{
      ...form,
      request_number: num,
      gold_karat: parseInt(form.gold_karat),
      reference_images: referenceImages,
      received_date: new Date().toISOString().split('T')[0],
    }]).select().single()

    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/cad-requests')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/cad-requests" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">New CAD request</h1>
          <p className="text-stone-500 text-sm">48-hour design turnaround</p>
        </div>
      </div>

      {fromInterest && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <Heart className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Partner {productRef ? <span>and product <strong>{productRef.code} — {productRef.name}</strong> were</span> : 'was'} pre-filled from their design interest.
          </span>
        </div>
      )}

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Request details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Partner (jeweler) *</label>
              <select className={input} value={form.partner_id} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.store_name} — {p.city}</option>
                ))}
              </select>
              {partners.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No active partners found. <Link href="/partners/new" className="underline">Add a partner first.</Link></p>
              )}
            </div>
            <div>
              <label className={label}>Priority</label>
              <select className={input} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="normal">Normal (48 hours)</option>
                <option value="urgent">Urgent (24 hours)</option>
              </select>
            </div>
            <div>
              <label className={label}>Due date</label>
              <input type="date" className={input} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Design brief</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Brief description *</label>
              <textarea className={`${input} resize-none`} rows={4}
                value={form.brief_text} onChange={e => set('brief_text', e.target.value)}
                placeholder="Describe the design: e.g. 'Oval solitaire in 18K yellow gold with thin pavé band. Customer wants something modern but not flashy. Reference image attached.'" />
            </div>
            <div>
              <label className={label}>Diamond shape</label>
              <select className={input} value={form.diamond_shape} onChange={e => set('diamond_shape', e.target.value)}>
                {['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Diamond weight</label>
              <input className={input} value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5ct or 0.5-0.7ct range" />
            </div>
            <div>
              <label className={label}>Gold karat</label>
              <select className={input} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                <option value="14">14K</option>
                <option value="18">18K</option>
                <option value="22">22K</option>
              </select>
            </div>
            <div>
              <label className={label}>Setting type</label>
              <input className={input} value={form.setting_type} onChange={e => set('setting_type', e.target.value)} placeholder="e.g. prong, bezel, pavé, halo" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Special requests / notes</label>
              <textarea className={`${input} resize-none`} rows={2}
                value={form.special_requests} onChange={e => set('special_requests', e.target.value)}
                placeholder="Any specific customer requirements, size preferences, budget constraints..." />
            </div>
          </div>
        </div>

        {/* Reference images */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-1">Reference images</h2>
          <p className="text-xs text-stone-400 mb-4">Upload customer inspiration photos, sketches, or reference pieces.</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {referenceImages.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setReferenceImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-stone-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#C49C64] hover:bg-yellow-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { handleImageUpload(e.target.files); e.currentTarget.value = '' }}
                disabled={uploading}
              />
              <Upload className={`w-5 h-5 mb-1 ${uploading ? 'text-stone-200 animate-pulse' : 'text-stone-300'}`} />
              <span className="text-xs text-stone-300">{uploading ? 'Uploading...' : 'Add images'}</span>
            </label>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">After saving this request:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-amber-700">
            <li>Go to your CAD software and create the design</li>
            <li>Upload render images to the request detail page</li>
            <li>Mark status as &quot;Sent&quot; when you WhatsApp the CAD to the partner</li>
            <li>Update to &quot;Approved&quot; or &quot;Revision requested&quot; based on partner response</li>
          </ol>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/cad-requests" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Create request'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewCADRequestPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <NewCADRequestForm />
    </Suspense>
  )
}
