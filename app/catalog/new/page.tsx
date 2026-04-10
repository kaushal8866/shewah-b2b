'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [labourRates, setLabourRates] = useState<Record<number, number>>({})
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
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
    ]).then(([{ data: gr }, { data: lr }]) => {
      if (gr?.[0]) setGoldRate(gr[0].rate_24k)
      const map: Record<number, number> = {}
      lr?.forEach((r: any) => { map[r.karat] = r.rate_per_gram })
      setLabourRates(map)
    })
  }, [])

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
  function removeDiamondRow(id: string) { if (diamonds.length > 1) setDiamonds(prev => prev.filter(d => d.id !== id)) }
  function updateDiamond(id: string, key: keyof DiamondRow, val: string) {
    setDiamonds(prev => prev.map(d => d.id === id ? { ...d, [key]: val } : d))
  }

  function autoCalculate() {
    setForm(prev => ({ ...prev, trade_price: String(autoTradePrice), mrp_suggested: String(autoMRP) }))
    setShowBreakdown(true)
  }

  function set(k: string, v: string | string[]) { setForm(prev => ({ ...prev, [k]: v })) }

  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleSave() {
    if (!form.code || !form.name) { alert('Product code and name are required'); return }
    if (!form.trade_price) { alert('Trade price is required. Use Auto-calculate or enter manually.'); return }
    setSaving(true)
    const primary = diamonds[0]
    const { error } = await supabase.from('products').insert([{
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
    }])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl pb-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog" className="text-stone-400 hover:text-stone-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Add product</h1>
          <p className="text-stone-500 text-sm">New ring design</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* BASIC INFO */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Basic information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Product code * (e.g. SH-007)</label>
              <input className={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SH-007" />
            </div>
            <div>
              <label className={lbl}>Product name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Oval Solitaire" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Description</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for catalog and jeweler portal" />
            </div>
          </div>
        </div>

        {/* PHOTOS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-1">Product photos</h2>
          <p className="text-xs text-stone-400 mb-4">Upload multiple angles. First photo is the cover shown in catalog and jeweler portal.</p>
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
          {photoUrls.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No photos — products without photos show a placeholder on the jeweler portal.
            </p>
          )}
        </div>

        {/* DIAMONDS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-stone-900">Diamond specifications</h2>
            <button onClick={addDiamondRow}
              className="flex items-center gap-1.5 text-xs text-[#C49C64] border border-[#C49C64] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-4">Add one row per diamond type — center stone, side stones, accents, etc.</p>

          <div className="space-y-3">
            {diamonds.map((d, idx) => (
              <div key={d.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                  {diamonds.length > 1 && (
                    <button onClick={() => removeDiamondRow(d.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div>
                    <label className={lbl}>Role</label>
                    <select className={inp} value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Shape</label>
                    <select className={inp} value={d.shape} onChange={e => updateDiamond(d.id, 'shape', e.target.value)}>
                      {SHAPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Weight (ct)</label>
                    <input type="number" step="0.01" className={inp} value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} placeholder="0.50" />
                  </div>
                  <div>
                    <label className={lbl}>Pieces</label>
                    <input type="number" min="1" className={inp} value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <label className={lbl}>Quality</label>
                    <select className={inp} value={d.quality} onChange={e => updateDiamond(d.id, 'quality', e.target.value)}>
                      {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Color</label>
                    <select className={inp} value={d.color} onChange={e => updateDiamond(d.id, 'color', e.target.value)}>
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Type</label>
                    <select className={inp} value={d.type} onChange={e => updateDiamond(d.id, 'type', e.target.value)}>
                      <option value="lgd">LGD</option>
                      <option value="natural">Natural</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Cost/pc (₹)</label>
                    <input type="number" className={inp} value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} placeholder="8000" />
                  </div>
                </div>
                {d.cost && parseInt(d.pieces) > 1 && (
                  <div className="mt-2 text-right text-xs text-stone-400">
                    Row total: ₹{((parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1)).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalDiamondCost > 0 && (
            <div className="mt-3 flex justify-between text-sm font-medium text-stone-700 px-1">
              <span>Total diamond cost</span>
              <span>₹{totalDiamondCost.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* GOLD */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Gold specifications</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>Gold karat</label>
              <select className={inp} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                {KARATS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Gold weight (g)</label>
              <input type="number" step="0.01" className={inp} value={form.gold_weight_g} onChange={e => set('gold_weight_g', e.target.value)} placeholder="3.0" />
            </div>
            <div>
              <label className={lbl}>Making charges (₹)</label>
              <input type="number" className={inp} value={form.making_charges} onChange={e => set('making_charges', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>IGI cert cost (₹)</label>
              <input type="number" className={inp} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} />
            </div>
          </div>
          {goldRate > 0 && goldWeightG > 0 && (
            <div className="mt-3 space-y-1">
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 flex justify-between">
                <span>Gold ({form.gold_karat}K, {goldWeightG}g @ ₹{Math.round(goldCostPerGram)}/g)</span>
                <span className="font-medium">₹{goldCost.toLocaleString('en-IN')}</span>
              </div>
              {labourRate > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 flex justify-between">
                  <span>Labour ({form.gold_karat}K, {effectiveWeight}g min @ ₹{labourRate}/g)</span>
                  <span className="font-medium">₹{labourCost.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PRICING + BREAKDOWN */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-900">Pricing</h2>
            <button onClick={autoCalculate}
              className="flex items-center gap-1.5 text-xs text-[#C49C64] border border-[#C49C64] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Calculator className="w-3.5 h-3.5" /> Auto-calculate
            </button>
          </div>
          {goldRate === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-4">
              No gold rate. <Link href="/gold-rates" className="underline">Add today's rate</Link> for accurate calculation.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={lbl}>Trade price (₹) *</label>
              <input type="number" className={inp} value={form.trade_price} onChange={e => set('trade_price', e.target.value)}
                placeholder={autoTradePrice > 0 ? `Auto: ₹${autoTradePrice.toLocaleString('en-IN')}` : 'Your price to jeweler'} />
            </div>
            <div>
              <label className={lbl}>Suggested MRP (₹)</label>
              <input type="number" className={inp} value={form.mrp_suggested} onChange={e => set('mrp_suggested', e.target.value)}
                placeholder={autoMRP > 0 ? `Auto: ₹${autoMRP.toLocaleString('en-IN')}` : "Jeweler's price to customer"} />
            </div>
            <div>
              <label className={lbl}>Delivery (days)</label>
              <input type="number" className={inp} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} />
            </div>
          </div>

          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-sm text-stone-500 hover:text-stone-700 py-2 border-t border-stone-100">
            <span className="font-medium">Detailed price breakdown</span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && (
            <div className="mt-3 rounded-xl overflow-hidden border border-stone-100">
              <div className="bg-stone-50 px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Cost of goods</p>
                {[
                  { label: `Gold (${form.gold_karat}K, ${goldWeightG}g)`, value: goldCost },
                  { label: `Labour (${form.gold_karat}K, min 1g rule)`, value: labourCost },
                  { label: 'Diamonds (all rows)', value: totalDiamondCost },
                  { label: 'Making charges', value: makingCharges },
                  { label: 'IGI certification', value: igiCost },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-stone-500">{row.label}</span>
                    <span className="text-stone-700">₹{row.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold text-stone-800 pt-2 border-t border-stone-200">
                  <span>Total COGS</span>
                  <span>₹{cogs.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Margin analysis</p>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Trade price</span>
                  <span className="font-medium text-stone-800">₹{tradePrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Your margin (trade − COGS)</span>
                  <span className={`font-medium ${yourMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ₹{yourMargin.toLocaleString('en-IN')} ({cogs > 0 ? Math.round((yourMargin / tradePrice) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-px bg-stone-100 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Suggested MRP</span>
                  <span className="font-medium text-stone-800">₹{mrp.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Jeweler margin (MRP − trade)</span>
                  <span className="font-medium text-blue-600">
                    ₹{jewelerMargin.toLocaleString('en-IN')} ({mrp > 0 ? Math.round((jewelerMargin / mrp) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-stone-100">
                <div className="px-4 py-3 text-center border-r border-stone-100">
                  <p className="text-xs text-stone-400">COGS</p>
                  <p className="text-sm font-semibold text-stone-800">₹{cogs.toLocaleString('en-IN')}</p>
                </div>
                <div className="px-4 py-3 text-center border-r border-stone-100">
                  <p className="text-xs text-stone-400">Your margin</p>
                  <p className={`text-sm font-semibold ${yourMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {cogs > 0 ? Math.round((yourMargin / tradePrice) * 100) : 0}%
                  </p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-stone-400">Jeweler gets</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {mrp > 0 ? Math.round((jewelerMargin / mrp) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODELS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-3">Available for models</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'wholesale', label: 'Wholesale catalog' },
              { id: 'design_make', label: 'Design + Make' },
              { id: 'white_label', label: 'White Label OEM' },
            ].map(m => (
              <button key={m.id} onClick={() => toggleModel(m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  form.models_available.includes(m.id)
                    ? 'bg-[#C49C64] text-white border-[#C49C64]'
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/catalog" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
