'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { KARAT_FACTORS, SELLABLE_KARATS, deriveAllKaratWeights, computeKaratPricing } from '@/lib/karat'
import { ArrowLeft, Save, Calculator, Plus, X, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'

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
  // task 76: link each row to a catalog (shape, size). Older rows
  // without these still save and read fine — they show up in the
  // editor with the picker empty until an operator upgrades them.
  shape_id: string
  size_id: string
  size_label: string
  // True when the row came from an older product save that predates the
  // shared diamond catalog. Such rows render read-only with a "Legacy"
  // badge and an explicit "Upgrade" affordance, so a master can safely
  // re-pick from the catalog without accidentally losing the original
  // values mid-edit. New rows added in this editor are never legacy.
  legacy_locked: boolean
}

const SHAPES = ['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher']
const QUALITIES = ['IF','VVS1','VVS2','VS1','VS2','SI1','SI2']
const COLORS = ['D','E','F','G','H','I','J']
const ROLES = ['center','side','accent','other']
const KARATS = [
  { value: '9',  label: '9K  (38%)',   purity: KARAT_FACTORS[9]  },
  { value: '10', label: '10K (42%)',   purity: KARAT_FACTORS[10] },
  { value: '14', label: '14K (60%)',   purity: KARAT_FACTORS[14] },
  { value: '18', label: '18K (75%)',   purity: KARAT_FACTORS[18] },
  { value: '22', label: '22K (91.6%)', purity: KARAT_FACTORS[22] },
]

function newDiamondRow(): DiamondRow {
  return {
    id: Math.random().toString(36).slice(2),
    role: 'center', shape: 'round', weight: '', quality: 'VS2',
    color: 'F', type: 'lgd', pieces: '1', cost: '',
    shape_id: '', size_id: '', size_label: '',
    legacy_locked: false,
  }
}

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [retailLabour, setRetailLabour] = useState<Record<number, number>>({ 22: 0, 18: 0, 14: 0, 10: 0, 9: 0 })
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'ring',
    // 22kt is the canonical input; the four other karats derive from it.
    gold_weight_22k: '',
    making_charges: '2500', igi_cert_cost: '1500',
    delivery_days: '14',
    models_available: ['wholesale', 'design_make'],
  })

  useEffect(() => {
    supabase
      .from('gold_rates')
      .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        const r = data?.[0]
        if (!r) return
        setGoldRate(Number(r.rate_24k) || 0)
        setRetailLabour({
          22: Number(r.retail_labour_22k) || 0,
          18: Number(r.retail_labour_18k) || 0,
          14: Number(r.retail_labour_14k) || 0,
          10: Number(r.retail_labour_10k) || 0,
          9:  Number(r.retail_labour_9k)  || 0,
        })
      })
  }, [])

  const weight22 = parseFloat(form.gold_weight_22k) || 0
  const weights = deriveAllKaratWeights(weight22, 22)
  const totalDiamondCost = diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1), 0)
  const makingCharges = parseFloat(form.making_charges) || 0
  const igiCost = parseFloat(form.igi_cert_cost) || 0

  const pricing = computeKaratPricing({
    weights,
    rate24k: goldRate,
    retailLabour,
    diamondCost: totalDiamondCost,
    makingCharges,
    igiCost,
  })
  const default22 = pricing.find(p => p.karat === 22)
  const tradePrice = default22?.trade || 0
  const mrp = default22?.mrp || 0
  const cogs22 = default22?.cogs || 0
  const yourMargin = tradePrice - cogs22
  const jewelerMargin = mrp - tradePrice

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

  function set(k: string, v: string | string[]) { setForm(prev => ({ ...prev, [k]: v })) }

  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleSave() {
    if (!form.code || !form.name) { alert('Product code and name are required'); return }
    if (!weight22) { alert('Gold weight @ 22kt is required'); return }
    setSaving(true)
    const primary = diamonds[0]
    const karat_pricing: Record<string, any> = {}
    for (const row of pricing) karat_pricing[String(row.karat)] = row
    const insertPayload: Record<string, any> = {
      code: form.code, name: form.name, description: form.description, category: form.category,
      // Legacy single-karat fields kept in sync so older queries keep working.
      gold_karat: 22,
      gold_weight_g: weights[22] || null,
      gold_weight_22k: weights[22] || null,
      gold_weight_18k: weights[18] || null,
      gold_weight_14k: weights[14] || null,
      gold_weight_10k: weights[10] || null,
      gold_weight_9k:  weights[9]  || null,
      karat_pricing,
      making_charges: makingCharges, igi_cert_cost: igiCost,
      trade_price: tradePrice, mrp_suggested: mrp,
      // Stamp the gold rate the prices were computed at (Task #72).
      priced_at_rate: goldRate || null,
      priced_at: new Date().toISOString(),
      delivery_days: parseInt(form.delivery_days) || 14,
      models_available: form.models_available, photo_urls: photoUrls,
      diamond_weight: parseFloat(primary.weight) || null, diamond_shape: primary.shape,
      diamond_quality: primary.quality, diamond_color: primary.color,
      diamond_type: primary.type, diamond_cost: parseFloat(primary.cost) || null,
      diamond_specs: diamonds.map(d => ({
        role: d.role, shape: d.shape, weight: parseFloat(d.weight) || 0,
        quality: d.quality, color: d.color, type: d.type,
        pieces: parseInt(d.pieces) || 1, cost: parseFloat(d.cost) || 0,
        shape_id: d.shape_id || null,
        size_id: d.size_id || null,
        size_label: d.size_label || null,
      })),
      detailed_pricing: { karat_pricing, gold_rate_used: goldRate, retail_labour_used: retailLabour },
      is_active: true,
    }
    let { error } = await supabase.from('products').insert([insertPayload])
    if (error && /priced_at|column .* does not exist/i.test(error.message || '')) {
      // Migration not yet applied — drop the new columns and retry.
      delete insertPayload.priced_at_rate
      delete insertPayload.priced_at
      ;({ error } = await supabase.from('products').insert([insertPayload]))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
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
                {i === 0 && <div className="absolute bottom-1 left-1 bg-[#1E3A5F] text-white text-xs px-1.5 py-0.5 rounded-md">Cover</div>}
                <button onClick={() => setPhotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#1E3A5F] hover:bg-yellow-50 transition-colors">
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
              className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Pick a shape × size from the <Link href="/diamonds/catalog" className="text-[#1E3A5F] underline">diamond catalog</Link> so stock matching works. The legacy fields below stay editable for older entries.
          </p>

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
                <div className="mb-3">
                  <DiamondCatalogPicker
                    shapeId={d.shape_id || null}
                    sizeId={d.size_id || null}
                    onChange={picked => setDiamonds(prev => prev.map(row => row.id !== d.id ? row : ({
                      ...row,
                      shape_id: picked.shape_id,
                      size_id: picked.size_id,
                      size_label: picked.size_label,
                      // Keep the legacy free-text shape in sync so the
                      // pricing fallbacks that read `diamond_shape` keep
                      // showing something sensible.
                      shape: picked.shape_name ? picked.shape_name.toLowerCase() : row.shape,
                      // Auto-fill weight from the catalog the first time
                      // (operator can still override).
                      weight: row.weight === '' && picked.approx_carats != null
                        ? String(picked.approx_carats)
                        : row.weight,
                    }))) }
                  />
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
                    <input type="number" inputMode="decimal" step="0.01" className={inp} value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} placeholder="0.50" />
                  </div>
                  <div>
                    <label className={lbl}>Pieces</label>
                    <input type="number" inputMode="decimal" min="1" className={inp} value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} placeholder="1" />
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
                    <input type="number" inputMode="decimal" className={inp} value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} placeholder="8000" />
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
          <h2 className="font-medium text-stone-900 mb-1">Gold specifications</h2>
          <p className="text-xs text-stone-400 mb-4">
            Enter the gross weight at <strong>22kt</strong>. Weights for 18 / 14 / 10 / 9kt are derived automatically (same physical piece, same 24kt-pure mass).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Gold weight @ 22kt (g) *</label>
              <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                value={form.gold_weight_22k} onChange={e => set('gold_weight_22k', e.target.value)} placeholder="e.g. 2.8100" />
            </div>
            <div>
              <label className={lbl}>Making charges (₹)</label>
              <input type="number" inputMode="decimal" className={inp} value={form.making_charges} onChange={e => set('making_charges', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>IGI cert cost (₹)</label>
              <input type="number" inputMode="decimal" className={inp} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} />
            </div>
          </div>

          {weight22 > 0 && (
            <div className="mt-4 rounded-xl border border-stone-100 overflow-hidden">
              <div className="bg-stone-50 px-3 py-2 text-xs font-medium text-stone-500 uppercase tracking-wide">
                Derived gross weights
              </div>
              <div className="grid grid-cols-5 divide-x divide-stone-100 text-center">
                {SELLABLE_KARATS.map(k => (
                  <div key={k} className="px-2 py-3">
                    <p className="text-xs text-stone-400">{k}kt</p>
                    <p className="text-sm font-semibold text-stone-800">{weights[k]?.toFixed(3)} g</p>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border-t border-amber-100 px-3 py-2 text-xs text-amber-700 text-center">
                24kt-pure mass: <strong>{(weight22 * KARAT_FACTORS[22]).toFixed(4)} g</strong> — constant across every karat.
              </div>
            </div>
          )}
        </div>

        {/* PRICING — per karat */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-stone-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              Per-karat pricing
            </h2>
            <div>
              <label className={lbl + ' inline-block mr-2'}>Delivery (days)</label>
              <input type="number" inputMode="decimal" className={`${inp} inline-block w-20`} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} />
            </div>
          </div>
          {goldRate === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
              No gold rate. <Link href="/gold-rates" className="underline">Set today's rate &amp; retail labour</Link> to see prices.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-stone-100">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Karat</th>
                  <th className="px-3 py-2 text-right">Gross (g)</th>
                  <th className="px-3 py-2 text-right">Gold ₹</th>
                  <th className="px-3 py-2 text-right">Labour ₹</th>
                  <th className="px-3 py-2 text-right">COGS ₹</th>
                  <th className="px-3 py-2 text-right">Trade ₹</th>
                  <th className="px-3 py-2 text-right">MRP ₹</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map(row => (
                  <tr key={row.karat} className={`border-t border-stone-100 ${row.karat === 22 ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-stone-700">
                      {row.karat}kt {row.karat === 22 && <span className="text-[10px] text-yellow-700 ml-1">default</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-600">{row.weight.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-stone-600">{row.goldCost.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right text-stone-600">
                      {row.labourCost.toLocaleString('en-IN')}
                      {(retailLabour[row.karat] || 0) === 0 && <span className="text-[10px] text-amber-600 ml-1">(no rate)</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-700">{row.cogs.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1E3A5F]">{row.trade.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-medium text-stone-800">{row.mrp.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-sm text-stone-500 hover:text-stone-700 py-2 mt-3 border-t border-stone-100">
            <span className="font-medium">22kt breakdown &amp; margin analysis</span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && default22 && (
            <div className="mt-3 rounded-xl overflow-hidden border border-stone-100">
              <div className="bg-stone-50 px-4 py-3 space-y-2">
                {[
                  { label: `Gold (22K, ${default22.weight.toFixed(3)}g)`, value: default22.goldCost },
                  { label: `Labour (22K @ ₹${retailLabour[22] || 0}/g)`, value: default22.labourCost },
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
                  <span>Total COGS (22K)</span>
                  <span>₹{cogs22.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Your margin (trade − COGS)</span>
                  <span className={`font-medium ${yourMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ₹{yourMargin.toLocaleString('en-IN')} ({tradePrice > 0 ? Math.round((yourMargin / tradePrice) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Jeweler margin (MRP − trade)</span>
                  <span className="font-medium text-blue-600">
                    ₹{jewelerMargin.toLocaleString('en-IN')} ({mrp > 0 ? Math.round((jewelerMargin / mrp) * 100) : 0}%)
                  </span>
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
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
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
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
