'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { KARAT_FACTORS, SELLABLE_KARATS, pureMassByKarat, computeKaratPricing, getMetalWeight, pureGoldMass } from '@/lib/karat'
import { ArrowLeft, Save, Calculator, Plus, X, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import MetalWeightCalculator from '@/components/MetalWeightCalculator'
import { DynamicField, validateAttributes } from '@/lib/catalogAttributes'

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
  const [silverRateB2B, setSilverRateB2B] = useState(80)
  const [silverRateD2C, setSilverRateD2C] = useState(120)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [metalWeights, setMetalWeights] = useState<any>({})
  const [refKarat, setRefKarat] = useState<string>('22K')
  const [refColor, setRefColor] = useState<string>('yellow')
  const [categories, setCategories] = useState<any[]>([])
  const [attributes, setAttributes] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'Ring',
    metal_type: 'gold',
    gold_weight_22k: '',
    gross_weight: '',
    making_charges: '0', igi_cert_cost: '1500',
    delivery_days: '14',
    models_available: ['wholesale', 'design_make'],
  })

  useEffect(() => {
    Promise.all([
      supabase
        .from('gold_rates')
        .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
        .order('recorded_at', { ascending: false })
        .limit(1),
      supabase
        .from('settings')
        .select('key, value')
        .in('key', ['silver_rate_b2b', 'silver_rate_d2c']),
      supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    ]).then(([{ data: gd }, { data: sd }, { data: catData }]) => {
      if (catData) {
        setCategories(catData)
      }
      const r = gd?.[0]
      if (r) {
        setGoldRate(Number(r.rate_24k) || 0)
        setRetailLabour({
          22: Number(r.retail_labour_22k) || 0,
          18: Number(r.retail_labour_18k) || 0,
          14: Number(r.retail_labour_14k) || 0,
          10: Number(r.retail_labour_10k) || 0,
          9:  Number(r.retail_labour_9k)  || 0,
        })
      }
      if (sd) {
        const b2b = sd.find(s => s.key === 'silver_rate_b2b')?.value
        const d2c = sd.find(s => s.key === 'silver_rate_d2c')?.value
        if (b2b) setSilverRateB2B(Number(b2b))
        if (d2c) setSilverRateD2C(Number(d2c))
      }
    })
  }, [])

  const isSilver = form.metal_type === 'silver'
  const weight22 = isSilver
    ? (getMetalWeight(metalWeights, refKarat, 'default') || 0)
    : (getMetalWeight(metalWeights, '22K', 'yellow') || 0)

  const totalDiamondCost = diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1), 0)
  const makingCharges = parseFloat(form.making_charges) || 0
  const igiCost = parseFloat(form.igi_cert_cost) || 0

  const silverB2BCost = weight22 * silverRateB2B
  const silverD2CCost = weight22 * silverRateD2C
  const silverB2B_cogs = silverB2BCost + totalDiamondCost + makingCharges + igiCost
  const silverD2C_cogs = silverD2CCost + totalDiamondCost + makingCharges + igiCost
  
  const silverTrade = Math.round(silverB2B_cogs * 1.28)
  const silverMrp = Math.round(silverTrade * 1.40)

  const pricing = isSilver ? [
    {
      karat: 'Silver',
      weight: weight22,
      goldCost: silverB2BCost,
      labourCost: 0,
      cogs: silverB2B_cogs,
      trade: silverTrade,
      mrp: silverMrp
    }
  ] : computeKaratPricing({
    netGoldWeight: weight22,
    rate24k: goldRate,
    retailLabour,
    diamondCost: totalDiamondCost,
    makingCharges,
    igiCost,
    metalWeights: metalWeights && Object.keys(metalWeights).length > 0 ? metalWeights : undefined,
  })

  const default22 = pricing.find(p => p.karat === 22)
  const tradePrice = isSilver ? silverTrade : (default22?.trade || 0)
  const mrp = isSilver ? silverMrp : (default22?.mrp || 0)
  const cogs22 = isSilver ? silverB2B_cogs : (default22?.cogs || 0)
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
    // Picking a different type for an already-picked stone should refresh
    // the cost suggestion too.
    if (key === 'type') {
      const row = diamonds.find(x => x.id === id)
      if (row?.shape_id && row?.size_id) autofillCostFor(id, row.shape_id, row.size_id, val)
    }
  }

  // Suggestions panel state — keyed by diamond row id. Holds both the
  // central matrix prices (Task #82, source of truth) and the legacy
  // product/inventory history price so the operator can compare and pick.
  type CostSuggestion = {
    matrix: Array<{ quality_label: string; color_label: string; price: number }>
    history: { cost: number; source_label: string } | null
  }
  const [costSuggestions, setCostSuggestions] = useState<Record<string, CostSuggestion>>({})

  // Fetch cost suggestions for a row from the central matrix + history. The
  // first matrix cell auto-fills the cost field if it's blank, but the full
  // list is rendered as clickable chips so the operator can swap to any
  // other quality/color or to the historical product cost — required for
  // closing verbal deals where the negotiated price differs.
  async function autofillCostFor(rowId: string, shape_id: string, size_id: string, type: string) {
    if (!shape_id || !size_id) return
    try {
      const url = new URL('/api/diamonds/latest-cost', window.location.origin)
      url.searchParams.set('shape_id', shape_id)
      url.searchParams.set('size_id', size_id)
      if (type) url.searchParams.set('type', type)
      const r = await fetch(url.toString())
      if (!r.ok) return
      const d = await r.json()
      const matrix = Array.isArray(d.matrix_options) ? d.matrix_options.map((m: any) => ({
        quality_label: m.quality_label, color_label: m.color_label, price: Number(m.price) || 0,
      })) : []
      const history = (d.cost != null && Number.isFinite(Number(d.cost)))
        ? { cost: Number(d.cost), source_label: String(d.source_label || 'History') }
        : null
      setCostSuggestions(prev => ({ ...prev, [rowId]: { matrix, history } }))
      // First-time autofill: prefer the matrix price (preferring a row that
      // matches the diamond's quality + color when present), fall back to
      // history. Never overwrite an operator-typed value.
      setDiamonds(prev => prev.map(row => {
        if (row.id !== rowId) return row
        if (row.cost && row.cost !== '') return row
        const qMatch = matrix.find((m: any) => m.quality_label.toLowerCase().includes((row.quality || '').toLowerCase().slice(0, 2)))
        const cMatch = qMatch && matrix.find((m: any) =>
          m.quality_label === qMatch.quality_label && m.color_label.toLowerCase().includes((row.color || '').toLowerCase().slice(0, 1)))
        const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? history?.cost
        return pick ? { ...row, cost: String(pick) } : row
      }))
    } catch { /* silent — auto-fill is best-effort */ }
  }

  function set(k: string, v: string | string[]) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleCategoryChange(catName: string) {
    setForm(prev => ({ ...prev, category: catName }))
    setAttributes({})
    setValidationErrors([])
  }

  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleSave() {
    if (!form.code || !form.name) { alert('Product code and name are required'); return }
    if (!weight22) { alert('Net weight is required'); return }
    
    // Validate dynamic attributes
    const selectedCategory = categories.find(c => c.name.toLowerCase() === form.category.toLowerCase())
    const schema = selectedCategory?.attribute_schema || []
    const errors = validateAttributes(attributes, schema)
    if (errors.length > 0) {
      setValidationErrors(errors)
      alert('Please fix the validation errors: ' + errors.join(' '));
      return
    }

    setSaving(true)
    const primary = diamonds[0]
    const karat_pricing: Record<string, any> = {}
    for (const row of pricing) karat_pricing[String(row.karat)] = row
    const insertPayload: Record<string, any> = {
      code: form.code, name: form.name, description: form.description, category: form.category,
      metal_type: form.metal_type,
      gold_karat: isSilver ? null : 22,
      gold_weight_g: weight22 || null,
      gold_weight_22k: isSilver ? null : (weight22 || null),
      gold_weight_18k: isSilver ? null : (getMetalWeight(metalWeights, '18K', 'yellow') || null),
      gold_weight_14k: isSilver ? null : (getMetalWeight(metalWeights, '14K', 'yellow') || null),
      gold_weight_10k: isSilver ? null : (getMetalWeight(metalWeights, '10K', 'yellow') || null),
      gold_weight_9k:  isSilver ? null : (getMetalWeight(metalWeights, '9K', 'yellow')  || null),
      metal_weights: metalWeights,
      ref_karat: refKarat,
      ref_color: refColor,
      karat_pricing,
      igi_cert_cost: igiCost,
      trade_price: tradePrice, mrp_suggested: mrp,
      priced_at_rate: isSilver ? null : (goldRate || null),
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
      detailed_pricing: isSilver ? { karat_pricing, silver_rate_b2b_used: silverRateB2B, silver_rate_d2c_used: silverRateD2C } : { karat_pricing, gold_rate_used: goldRate, retail_labour_used: retailLabour },
      is_active: true,
      attributes,
    }
    let { error } = await supabase.from('products').insert([insertPayload])
    if (error && /priced_at|column .* does not exist|metal_weights|attributes/i.test(error.message || '')) {
      // Migration not yet applied — drop the new columns and retry.
      delete insertPayload.priced_at_rate
      delete insertPayload.priced_at
      delete insertPayload.metal_weights
      delete insertPayload.ref_karat
      delete insertPayload.ref_color
      delete insertPayload.attributes
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Product code * (e.g. SH-007)</label>
              <input className={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SH-007" />
            </div>
            <div>
              <label className={lbl}>Product name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Oval Solitaire" />
            </div>
            <div>
              <label className={lbl}>Category *</label>
              <select className={inp} value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                {categories.length > 0 ? (
                  categories.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))
                ) : (
                  ['Ring', 'Necklace', 'Earring', 'Bracelet'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={lbl}>Description</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for catalog and jeweler portal" />
            </div>
          </div>
        </div>

        {/* DYNAMIC PRODUCT ATTRIBUTES */}
        {(() => {
          const selectedCategory = categories.find(c => c.name.toLowerCase() === form.category.toLowerCase())
          const schema = selectedCategory?.attribute_schema || []
          if (schema.length === 0) return null
          return (
            <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
              <h2 className="font-medium text-stone-900 mb-1">Specifications for {form.category}</h2>
              <p className="text-xs text-stone-400 mb-4">
                Provide the specific dimensions and specifications for this category.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {schema.map((field: any) => (
                  <DynamicField
                    key={field.key}
                    field={field}
                    value={attributes[field.key]}
                    onChange={(key, val) => setAttributes(prev => ({ ...prev, [key]: val }))}
                  />
                ))}
              </div>
            </div>
          )
        })()}

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
                    onChange={picked => {
                      setDiamonds(prev => prev.map(row => row.id !== d.id ? row : ({
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
                      })))
                      // Auto-fill cost from the most recent diamond row that
                      // matched this shape+size+type. Only fills when blank
                      // so we never trample an operator-typed value.
                      autofillCostFor(d.id, picked.shape_id, picked.size_id, d.type)
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <div>
                    <label className={lbl}>Role</label>
                    <select className={inp} value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
                {(() => {
                  const sug = costSuggestions[d.id]
                  if (!sug || (sug.matrix.length === 0 && !sug.history)) return null
                  return (
                    <div className="mt-3 border-t border-stone-200 pt-2.5">
                      <p className="text-[11px] font-medium text-stone-500 mb-1.5">Cost suggestions — click to use</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sug.matrix.map((m, i) => {
                          const active = parseFloat(d.cost) === m.price
                          return (
                            <button
                              key={`m-${i}`}
                              type="button"
                              onClick={() => updateDiamond(d.id, 'cost', String(m.price))}
                              className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                                (active ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                                        : 'border-stone-200 bg-white text-stone-600 hover:border-[#1E3A5F]/40')}
                              title={`Matrix · ${m.quality_label} · ${m.color_label}`}
                            >
                              <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                              ₹{m.price.toLocaleString('en-IN')}
                            </button>
                          )
                        })}
                        {sug.history && (
                          <button
                            type="button"
                            onClick={() => updateDiamond(d.id, 'cost', String(sug.history!.cost))}
                            className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                              (parseFloat(d.cost) === sug.history.cost
                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-amber-400')}
                            title={sug.history.source_label}
                          >
                            <span className="text-stone-400 mr-1">Last</span>
                            ₹{sug.history.cost.toLocaleString('en-IN')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
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

        {/* METAL SPECIFICATIONS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-1">Metal specifications</h2>
          <p className="text-xs text-stone-400 mb-4">
            Configure the metal type and net weight specifications.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={lbl}>Metal Type *</label>
              <select className={inp} value={form.metal_type} onChange={e => set('metal_type', e.target.value)}>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>
            <div>
              <label className={lbl}>IGI cert cost (₹)</label>
              <input type="number" inputMode="decimal" className={inp} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} />
            </div>
          </div>

          <MetalWeightCalculator
            metalType={form.metal_type as 'gold' | 'silver'}
            initialRefKarat={refKarat}
            initialRefColor={refColor}
            initialWeights={metalWeights}
            onChange={({ metalWeights: mw, refKarat: rk, refColor: rc }) => {
              setMetalWeights(mw)
              setRefKarat(rk)
              setRefColor(rc)
            }}
          />
        </div>

        {/* PRICING */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-stone-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              {isSilver ? 'Silver pricing' : 'Per-karat pricing'}
            </h2>
            <div>
              <label className={lbl + ' inline-block mr-2'}>Delivery (days)</label>
              <input type="number" inputMode="decimal" className={`${inp} inline-block w-20`} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-100">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                {isSilver ? (
                  <tr>
                    <th className="px-3 py-2 text-left">Metal</th>
                    <th className="px-3 py-2 text-right">Weight (g)</th>
                    <th className="px-3 py-2 text-right">B2B Rate ₹/g</th>
                    <th className="px-3 py-2 text-right">D2C Rate ₹/g</th>
                    <th className="px-3 py-2 text-right">COGS (B2B) ₹</th>
                    <th className="px-3 py-2 text-right">Trade ₹</th>
                    <th className="px-3 py-2 text-right">MRP ₹</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2 text-left">Karat</th>
                    <th className="px-3 py-2 text-right">24kt-pure (g)</th>
                    <th className="px-3 py-2 text-right">Gold ₹</th>
                    <th className="px-3 py-2 text-right">Labour ₹</th>
                    <th className="px-3 py-2 text-right">COGS ₹</th>
                    <th className="px-3 py-2 text-right">Trade ₹</th>
                    <th className="px-3 py-2 text-right">MRP ₹</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {isSilver ? (
                  <tr className="border-t border-stone-100 bg-yellow-50/40">
                    <td className="px-3 py-2 font-medium text-stone-700">Silver</td>
                    <td className="px-3 py-2 text-right text-stone-600">{weight22.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-stone-600">₹{silverRateB2B}</td>
                    <td className="px-3 py-2 text-right text-stone-600">₹{silverRateD2C}</td>
                    <td className="px-3 py-2 text-right text-stone-750">₹{silverB2B_cogs.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1E3A5F]">₹{silverTrade.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-medium text-stone-800">₹{silverMrp.toLocaleString('en-IN')}</td>
                  </tr>
                ) : (
                  pricing.map(row => (
                    <tr key={row.karat} className={`border-t border-stone-100 ${row.karat === 22 ? 'bg-yellow-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-stone-700">
                        {row.karat}kt {row.karat === 22 && <span className="text-[10px] text-yellow-700 ml-1">default</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-600">{row.weight.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right text-stone-600">{row.goldCost.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-stone-600">
                        {row.labourCost.toLocaleString('en-IN')}
                        {(retailLabour[row.karat] || 0) === 0 && <span className="text-[10px] text-amber-600 ml-1">(no rate)</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">{row.cogs.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#1E3A5F]">{row.trade.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-medium text-stone-800">{row.mrp.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-sm text-stone-500 hover:text-stone-700 py-2 mt-3 border-t border-stone-100">
            <span className="font-medium">{isSilver ? 'Silver breakdown & margin analysis' : '22kt breakdown & margin analysis'}</span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && (isSilver || default22) && (
            <div className="mt-3 rounded-xl overflow-hidden border border-stone-100">
              <div className="bg-stone-50 px-4 py-3 space-y-2">
                {isSilver ? (
                  <>
                    {[
                      { label: `Silver B2B Metal (${weight22.toFixed(3)}g @ ₹${silverRateB2B}/g)`, value: silverB2BCost },
                      { label: 'Diamonds (all rows)', value: totalDiamondCost },
                      { label: 'Making / Labour charges', value: makingCharges },
                      { label: 'IGI certification', value: igiCost },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-stone-500">{row.label}</span>
                        <span className="text-stone-700">₹{row.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-stone-800 pt-2 border-t border-stone-200">
                      <span>Total B2B COGS</span>
                      <span>₹{silverB2B_cogs.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  default22 && (
                    <>
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
                    </>
                  )
                )}
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

        {/* VALIDATION ERRORS */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 space-y-1">
            <p className="font-semibold">Please correct the following errors:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

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
