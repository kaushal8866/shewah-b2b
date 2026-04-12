'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { ArrowLeft, Save, Calculator, Plus, X, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

type DiamondRow = {
  id: string
  role: string
  shape: string
  weight: string
  quality: string
  color: string
  type: string
  pieces: string
  cost: string
}

const SHAPES = ['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher']
const QUALITIES = ['IF','VVS1','VVS2','VS1','VS2','SI1','SI2']
const COLORS = ['D','E','F','G','H','I','J']
const ROLES = ['center','side','accent','other']
const KARATS = [
  { value: '9',  label: '9K  (37.5%)', purity: 0.375 },
  { value: '10', label: '10K (41.7%)', purity: 0.417 },
  { value: '14', label: '14K (58.5%)', purity: 0.585 },
  { value: '18', label: '18K (75.0%)', purity: 0.750 },
  { value: '22', label: '22K (91.6%)', purity: 0.916 },
]

function newDiamondRow(): DiamondRow {
  return {
    id: Math.random().toString(36).slice(2),
    role: 'center', shape: 'round', weight: '', quality: 'VS2',
    color: 'F', type: 'lgd', pieces: '1', cost: ''
  }
}

export default function CatalogProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [labourRates, setLabourRates] = useState<Record<number, number>>({})
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'ring',
    gold_karat: '18', gold_weight_g: '',
    making_charges: '2500', igi_cert_cost: '1500',
    trade_price: '', mrp_suggested: '',
    delivery_days: '14',
    models_available: ['wholesale', 'design_make'],
  })

  useEffect(() => {
    Promise.all([
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
      supabase.from('labour_rates').select('karat, rate_per_gram'),
      supabase.from('products').select('*').eq('id', id).single(),
    ]).then(([{ data: gr }, { data: lr }, { data }]) => {
      if (gr?.[0]) setGoldRate(gr[0].rate_24k)
      const map: Record<number, number> = {}
      lr?.forEach((r: any) => { map[r.karat] = r.rate_per_gram })
      setLabourRates(map)
      if (data) {
        setForm({
          code: data.code || '',
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'ring',
          gold_karat: String(data.gold_karat || '18'),
          gold_weight_g: data.gold_weight_g ? String(data.gold_weight_g) : '',
          making_charges: String(data.making_charges ?? '2500'),
          igi_cert_cost: String(data.igi_cert_cost ?? '1500'),
          trade_price: data.trade_price ? String(data.trade_price) : '',
          mrp_suggested: data.mrp_suggested ? String(data.mrp_suggested) : '',
          delivery_days: String(data.delivery_days || '14'),
          models_available: data.models_available || ['wholesale', 'design_make'],
        })
        setPhotoUrls(data.photo_urls || [])
        if (Array.isArray(data.diamond_specs) && data.diamond_specs.length > 0) {
          setDiamonds(data.diamond_specs.map((d: any) => ({
            id: Math.random().toString(36).slice(2),
            role: d.role || 'center',
            shape: d.shape || 'round',
            weight: String(d.weight ?? ''),
            quality: d.quality || 'VS2',
            color: d.color || 'F',
            type: d.type || 'lgd',
            pieces: String(d.pieces ?? '1'),
            cost: String(d.cost ?? ''),
          })))
        }
      }
      setLoading(false)
    })
  }, [id])

  const selectedKarat = KARATS.find(k => k.value === form.gold_karat)
  const goldCostPerGram = goldRate * (selectedKarat?.purity || 0.75)
  const goldWeightG = parseFloat(form.gold_weight_g) || 0
  const goldCost = Math.round(goldCostPerGram * goldWeightG)
  const labourRate = labourRates[parseInt(form.gold_karat)] || 0
  const effectiveWeight = Math.max(goldWeightG, 1)
  const labourCost = Math.round(labourRate * effectiveWeight)
  const totalDiamondCost = diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1), 0)
  const makingCharges = parseFloat(form.making_charges) || 0
  const igiCost = parseFloat(form.igi_cert_cost) || 0
  const cogs = goldCost + totalDiamondCost + makingCharges + igiCost + labourCost
  const autoTradePrice = Math.round(cogs * 1.28)
  const autoMRP = Math.round(autoTradePrice * 1.40)
  const tradePrice = parseFloat(form.trade_price) || autoTradePrice
  const mrp = parseFloat(form.mrp_suggested) || autoMRP
  const jewelerMargin = mrp - tradePrice
  const yourMargin = tradePrice - cogs

  async function handleImageUpload(files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const url = await uploadToCloudinary(file)
        setPhotoUrls(prev => [...prev, url])
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setUploading(false)
  }

  function addDiamondRow() { setDiamonds(prev => [...prev, newDiamondRow()]) }
  function removeDiamondRow(id2: string) { if (diamonds.length > 1) setDiamonds(prev => prev.filter(d => d.id !== id2)) }
  function updateDiamond(id2: string, key: keyof DiamondRow, val: string) { setDiamonds(prev => prev.map(d => d.id === id2 ? { ...d, [key]: val } : d)) }
  function autoCalculate() { setForm(prev => ({ ...prev, trade_price: String(autoTradePrice), mrp_suggested: String(autoMRP) })); setShowBreakdown(true) }
  function set(k: string, v: string | string[]) { setForm(prev => ({ ...prev, [k]: v })) }
  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleDelete() {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  async function handleSave() {
    if (!form.code || !form.name) { alert('Product code and name are required'); return }
    if (!form.trade_price) { alert('Trade price is required. Use Auto-calculate or enter manually.'); return }
    setSaving(true)
    const primary = diamonds[0]
    const { error } = await supabase.from('products').update({
      code: form.code, name: form.name, description: form.description, category: form.category,
      gold_karat: parseInt(form.gold_karat), gold_weight_g: parseFloat(form.gold_weight_g) || null,
      making_charges: makingCharges, igi_cert_cost: igiCost,
      trade_price: tradePrice, mrp_suggested: mrp,
      delivery_days: parseInt(form.delivery_days) || 14,
      models_available: form.models_available, photo_urls: photoUrls,
      diamond_weight: parseFloat(primary.weight) || null, diamond_shape: primary.shape,
      diamond_quality: primary.quality, diamond_color: primary.color,
      diamond_type: primary.type, diamond_cost: parseFloat(primary.cost) || null,
      diamond_specs: diamonds.map(d => ({
        role: d.role, shape: d.shape, weight: parseFloat(d.weight) || 0,
        quality: d.quality, color: d.color, type: d.type,
        pieces: parseInt(d.pieces) || 1, cost: parseFloat(d.cost) || 0,
      })),
      labour_per_gram: labourRate || null,
      detailed_pricing: { gold_cost: goldCost, labour_cost: labourCost, diamond_cost: totalDiamondCost, making_charges: makingCharges, igi_cost: igiCost, cogs, trade_price: tradePrice, mrp, your_margin: yourMargin, jeweler_margin: jewelerMargin, gold_rate_used: goldRate },
      is_active: true,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl pb-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog" className="text-stone-400 hover:text-stone-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Edit product</h1>
          <p className="text-stone-500 text-sm">Update catalog entry</p>
        </div>
        <button onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors shrink-0">
          <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this product?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{form.code} {form.name}</strong>? This cannot be undone.
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

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Basic information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Product code *</label>
              <input className={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className={lbl}>Product name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Description</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-1">Product photos</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {photoUrls.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && <div className="absolute bottom-1 left-1 bg-[#C49C64] text-white text-xs px-1.5 py-0.5 rounded-md">Cover</div>}
                <button onClick={() => setPhotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#C49C64] hover:bg-yellow-50 transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} disabled={uploading} />
              <Upload className={`w-5 h-5 mb-1 ${uploading ? 'text-stone-200 animate-pulse' : 'text-stone-300'}`} />
              <span className="text-xs text-stone-300">{uploading ? 'Uploading...' : 'Add photos'}</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-stone-900">Diamond specifications</h2>
            <button onClick={addDiamondRow} className="flex items-center gap-1.5 text-xs text-[#C49C64] border border-[#C49C64] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <div className="space-y-3">
            {diamonds.map((d, idx) => (
              <div key={d.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                  {diamonds.length > 1 && <button onClick={() => removeDiamondRow(d.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div><label className={lbl}>Role</label><select className={inp} value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                  <div><label className={lbl}>Shape</label><select className={inp} value={d.shape} onChange={e => updateDiamond(d.id, 'shape', e.target.value)}>{SHAPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
                  <div><label className={lbl}>Weight (ct)</label><input type="number" step="0.01" className={inp} value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} /></div>
                  <div><label className={lbl}>Pieces</label><input type="number" min="1" className={inp} value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} /></div>
                  <div><label className={lbl}>Quality</label><select className={inp} value={d.quality} onChange={e => updateDiamond(d.id, 'quality', e.target.value)}>{QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
                  <div><label className={lbl}>Color</label><select className={inp} value={d.color} onChange={e => updateDiamond(d.id, 'color', e.target.value)}>{COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className={lbl}>Type</label><select className={inp} value={d.type} onChange={e => updateDiamond(d.id, 'type', e.target.value)}><option value="lgd">LGD</option><option value="natural">Natural</option></select></div>
                  <div><label className={lbl}>Cost/pc (₹)</label><input type="number" className={inp} value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Gold specifications</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className={lbl}>Gold karat</label><select className={inp} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>{KARATS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
            <div><label className={lbl}>Gold weight (g)</label><input type="number" step="0.01" className={inp} value={form.gold_weight_g} onChange={e => set('gold_weight_g', e.target.value)} /></div>
            <div><label className={lbl}>Making charges (₹)</label><input type="number" className={inp} value={form.making_charges} onChange={e => set('making_charges', e.target.value)} /></div>
            <div><label className={lbl}>IGI cert cost (₹)</label><input type="number" className={inp} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} /></div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/catalog" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</Link>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#C49C64] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
