'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { KARAT_FACTORS, SELLABLE_KARATS, pureMassByKarat, computeKaratPricing, getMetalWeight, pureGoldMass, computeAllMetalWeights } from '@/lib/karat'
import { ArrowLeft, Save, Calculator, Plus, X, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import Link from 'next/link'
import MetalWeightCalculator from '@/components/MetalWeightCalculator'

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
  // Task #76: link to the shared diamond catalog so stock matching works.
  shape_id: string
  size_id: string
  size_label: string
  // True when this row was loaded from a product saved before the shared
  // catalog existed. Such rows render read-only with a "Legacy" badge
  // + "Upgrade" affordance — clicking Upgrade unlocks editing and
  // surfaces the picker so the master can re-pick deliberately.
  legacy_locked: boolean
}

const SHAPES = ['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher']
const QUALITIES = ['IF','VVS1','VVS2','VS1','VS2','SI1','SI2']
const COLORS = ['D','E','F','G','H','I','J']
const ROLES = ['center','side','accent','other']

function newDiamondRow(): DiamondRow {
  return {
    id: Math.random().toString(36).slice(2),
    role: 'center', shape: 'round', weight: '', quality: 'VS2',
    color: 'F', type: 'lgd', pieces: '1', cost: '',
    shape_id: '', size_id: '', size_label: '',
    legacy_locked: false,
  }
}

export default function CatalogProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [retailLabour, setRetailLabour] = useState<Record<number, number>>({ 22: 0, 18: 0, 14: 0, 10: 0, 9: 0 })
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pricedAt, setPricedAt] = useState<{ rate: number | null; at: string | null }>({ rate: null, at: null })
  const [silverRateB2B, setSilverRateB2B] = useState(80)
  const [silverRateD2C, setSilverRateD2C] = useState(120)
  // Pre-#81 products may have non-null gross_weight / making_charges in the
  // database. We never expose those inputs on this form anymore, but we hold
  // the originally-loaded values here so save() can pass them through
  // unchanged instead of clobbering them.
  const [legacy, setLegacy] = useState<{ gross_weight: number | null; making_charges: number | null }>({ gross_weight: null, making_charges: null })
  const [metalWeights, setMetalWeights] = useState<any>({})
  const [refKarat, setRefKarat] = useState<string>('22K')
  const [refColor, setRefColor] = useState<string>('yellow')
  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'ring',
    metal_type: 'gold',
    gold_weight_22k: '',
    gross_weight: '',
    making_charges: '2500', igi_cert_cost: '1500',
    delivery_days: '14',
    models_available: ['wholesale', 'design_make'],
  })

  useEffect(() => {
    Promise.all([
      supabase.from('gold_rates')
        .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
        .order('recorded_at', { ascending: false }).limit(1),
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('settings').select('key, value').in('key', ['silver_rate_b2b', 'silver_rate_d2c'])
    ]).then(([{ data: gr }, { data }, { data: sd }]: any) => {
      const r = gr?.[0]
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
        const b2b = sd.find((s: any) => s.key === 'silver_rate_b2b')?.value
        const d2c = sd.find((s: any) => s.key === 'silver_rate_d2c')?.value
        if (b2b) setSilverRateB2B(Number(b2b))
        if (d2c) setSilverRateD2C(Number(d2c))
      }
      if (data) {
        setPricedAt({
          rate: data.priced_at_rate != null ? Number(data.priced_at_rate) : null,
          at: data.priced_at || null,
        })
        // Prefer the new 22kt column. For pre-#71 products, treat the legacy
        // gold_weight_g directly as the 22kt input — matches the migration
        // backfill so what the form shows equals what is stored.
        let w22 = Number(data.gold_weight_22k) || 0
        if (!w22 && data.gold_weight_g) {
          w22 = Number(data.gold_weight_g) || 0
        }
        
        const isSil = data.metal_type === 'silver'
        const initKarat = data.ref_karat || (isSil ? 'silver_925' : '22K')
        const initColor = data.ref_color || (isSil ? 'default' : 'yellow')
        let initWeights = data.metal_weights || {}

        if (Object.keys(initWeights).length === 0 && w22 > 0) {
          initWeights = computeAllMetalWeights(w22, initKarat, initColor)
        }

        setRefKarat(initKarat)
        setRefColor(initColor)
        setMetalWeights(initWeights)

        setForm({
          code: data.code || '',
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'ring',
          metal_type: data.metal_type || 'gold',
          gold_weight_22k: w22 ? String(w22) : '',
          gross_weight: data.gross_weight ? String(data.gross_weight) : '',
          making_charges: String(data.making_charges ?? '0'),
          igi_cert_cost: String(data.igi_cert_cost ?? '1500'),
          delivery_days: String(data.delivery_days || '14'),
          models_available: data.models_available || ['wholesale', 'design_make'],
        })
        setLegacy({
          gross_weight: data.gross_weight != null ? Number(data.gross_weight) : null,
          making_charges: data.making_charges != null ? Number(data.making_charges) : null,
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
            shape_id: d.shape_id || '',
            size_id: d.size_id || '',
            size_label: d.size_label || '',
            // Lock pre-catalog rows so a master can't unintentionally
            // mutate an old free-text spec — they have to "Upgrade" first.
            legacy_locked: !(d.shape_id && d.size_id),
          })))
        }
      }
      setLoading(false)
    })
  }, [id])

  const isSilver = form.metal_type === 'silver'
  const weight22 = isSilver
    ? (getMetalWeight(metalWeights, refKarat, 'default') || 0)
    : (getMetalWeight(metalWeights, '22K', 'yellow') || 0)

  const totalDiamondCost = diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1), 0)
  const makingCharges = legacy.making_charges ?? 0
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
    netGoldWeight: weight22, rate24k: goldRate, retailLabour,
    diamondCost: totalDiamondCost, makingCharges, igiCost,
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
  function removeDiamondRow(id2: string) { if (diamonds.length > 1) setDiamonds(prev => prev.filter(d => d.id !== id2)) }
  function updateDiamond(id2: string, key: keyof DiamondRow, val: string) {
    setDiamonds(prev => prev.map(d => d.id === id2 ? { ...d, [key]: val } : d))
    if (key === 'type') {
      const row = diamonds.find(x => x.id === id2)
      if (row?.shape_id && row?.size_id) autofillCostFor(id2, row.shape_id, row.size_id, val)
    }
  }

  // Mirrors the helper on the create page — fetches both the central
  // diamond price matrix (Task #82, source of truth) and the legacy
  // product/inventory history price. Renders both as clickable chips so
  // the operator can pick or override at deal-close time.
  type CostSuggestion = {
    matrix: Array<{ quality_label: string; color_label: string; price: number }>
    history: { cost: number; source_label: string } | null
  }
  const [costSuggestions, setCostSuggestions] = useState<Record<string, CostSuggestion>>({})

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
  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleSave() {
    if (!form.code || !form.name) { alert('Product code and name are required'); return }
    if (!weight22) { alert('Net weight is required'); return }
    setSaving(true)
    const primary = diamonds[0]
    const karat_pricing: Record<string, any> = {}
    for (const row of pricing) karat_pricing[String(row.karat)] = row
    const updatePayload: Record<string, any> = {
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
      making_charges: legacy.making_charges, igi_cert_cost: igiCost,
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
    }
    let { error } = await supabase.from('products').update(updatePayload).eq('id', id)
    if (error && /priced_at|column .* does not exist|metal_weights/i.test(error.message || '')) {
      // Migration not yet applied — drop the new columns and retry so
      // editing keeps working until the operator runs task-72 SQL.
      delete updatePayload.priced_at_rate
      delete updatePayload.priced_at
      delete updatePayload.metal_weights
      delete updatePayload.ref_karat
      delete updatePayload.ref_color
      ;({ error } = await supabase.from('products').update(updatePayload).eq('id', id))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl pb-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog" className="text-stone-400 hover:text-stone-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Edit product</h1>
          <p className="text-stone-500 text-sm">
            Update catalog entry
            {pricedAt.rate && pricedAt.at && (
              <span className="ml-2 text-stone-400">
                · Last priced at ₹{pricedAt.rate.toLocaleString('en-IN')}/g on {new Date(pricedAt.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Basic information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className={lbl}>Product code *</label><input className={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} /></div>
            <div><label className={lbl}>Product name *</label><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div>
              <label className={lbl}>Category *</label>
              <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                {['Ring', 'Earring', 'Pendant', 'Bangles', 'Necklace', 'Bracelet', 'Other'].map(c => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3"><label className={lbl}>Description</label><textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-1">Product photos</h2>
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
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-stone-900">Diamond specifications</h2>
            <button onClick={addDiamondRow} className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <div className="space-y-3">
            {diamonds.map((d, idx) => {
              // Legacy rows (saved before Task #76) are read-only with a
              // "Legacy" badge. The "Upgrade" button just clears the lock
              // — the master then explicitly re-picks from the catalog.
              const locked = d.legacy_locked
              const roInp = locked ? `${inp} bg-stone-100 text-stone-500 cursor-not-allowed` : inp
              return (
              <div key={d.id} className={`border rounded-xl p-3 ${locked ? 'border-amber-200 bg-amber-50/50' : 'border-stone-100 bg-stone-50'}`}>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                    {locked && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">Legacy</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {locked && (
                      <button
                        type="button"
                        onClick={() => setDiamonds(prev => prev.map(row => row.id === d.id ? { ...row, legacy_locked: false } : row))}
                        className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100">
                        Upgrade to catalog
                      </button>
                    )}
                    {diamonds.length > 1 && <button onClick={() => removeDiamondRow(d.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                {locked ? (
                  <p className="text-xs text-amber-800 mb-3">
                    This row pre-dates the shared diamond catalog. Click <strong>Upgrade to catalog</strong> to re-pick its shape and size — only then will it appear in availability badges and stock matching.
                  </p>
                ) : (
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
                          shape: picked.shape_name ? picked.shape_name.toLowerCase() : row.shape,
                          weight: row.weight === '' && picked.approx_carats != null
                            ? String(picked.approx_carats)
                            : row.weight,
                        })))
                        autofillCostFor(d.id, picked.shape_id, picked.size_id, d.type)
                      }}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <div><label className={lbl}>Role</label><select disabled={locked} className={roInp} value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
                  <div><label className={lbl}>Weight (ct)</label><input readOnly={locked} type="number" inputMode="decimal" step="0.01" className={roInp} value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} /></div>
                  <div><label className={lbl}>Pieces</label><input readOnly={locked} type="number" inputMode="decimal" min="1" className={roInp} value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} /></div>
                  <div><label className={lbl}>Quality</label><select disabled={locked} className={roInp} value={d.quality} onChange={e => updateDiamond(d.id, 'quality', e.target.value)}>{QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
                  <div><label className={lbl}>Color</label><select disabled={locked} className={roInp} value={d.color} onChange={e => updateDiamond(d.id, 'color', e.target.value)}>{COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className={lbl}>Type</label><select disabled={locked} className={roInp} value={d.type} onChange={e => updateDiamond(d.id, 'type', e.target.value)}><option value="lgd">LGD</option><option value="natural">Natural</option></select></div>
                  <div><label className={lbl}>Cost/pc (₹)</label><input readOnly={locked} type="number" inputMode="decimal" className={roInp} value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} /></div>
                </div>
                {!locked && (() => {
                  const sug = costSuggestions[d.id]
                  if (!sug || (sug.matrix.length === 0 && !sug.history)) return null
                  return (
                    <div className="mt-3 border-t border-stone-200 pt-2.5">
                      <p className="text-[11px] font-medium text-stone-500 mb-1.5">Cost suggestions — click to use</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sug.matrix.map((m, i) => {
                          const active = parseFloat(d.cost) === m.price
                          return (
                            <button key={`m-${i}`} type="button"
                              onClick={() => updateDiamond(d.id, 'cost', String(m.price))}
                              className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                                (active ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                                        : 'border-stone-200 bg-white text-stone-600 hover:border-[#1E3A5F]/40')}
                              title={`Matrix · ${m.quality_label} · ${m.color_label}`}>
                              <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                              ₹{m.price.toLocaleString('en-IN')}
                            </button>
                          )
                        })}
                        {sug.history && (
                          <button type="button"
                            onClick={() => updateDiamond(d.id, 'cost', String(sug.history!.cost))}
                            className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                              (parseFloat(d.cost) === sug.history.cost
                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-amber-400')}
                            title={sug.history.source_label}>
                            <span className="text-stone-400 mr-1">Last</span>
                            ₹{sug.history.cost.toLocaleString('en-IN')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )})}
          </div>
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
          {!isSilver && goldRate === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
              No gold rate. <Link href="/gold-rates" className="underline">Set today's rate &amp; retail labour</Link> to see prices.
            </div>
          )}
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
                      <td className="px-3 py-2 font-medium text-stone-700">{row.karat}kt {row.karat === 22 && <span className="text-[10px] text-yellow-700 ml-1">default</span>}</td>
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
            <div className="mt-3 rounded-xl border border-stone-100 px-4 py-3 space-y-2 bg-stone-50">
              {isSilver ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-stone-500">Silver B2B Metal ({weight22.toFixed(3)}g @ ₹{silverRateB2B}/g)</span><span className="text-stone-700">₹{silverB2BCost.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-stone-500">Diamonds (all rows)</span><span className="text-stone-700">₹{totalDiamondCost.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-stone-500">Making / Labour charges</span><span className="text-stone-700">₹{makingCharges.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-stone-500">IGI certification</span><span className="text-stone-700">₹{igiCost.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm font-semibold text-stone-800 pt-2 border-t border-stone-200"><span>Total B2B COGS</span><span>₹{silverB2B_cogs.toLocaleString('en-IN')}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm"><span className="text-stone-500">Trade price (22K)</span><span className="font-medium">₹{tradePrice.toLocaleString('en-IN')}</span></div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Your margin</span>
                <span className={`font-medium ${yourMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ₹{yourMargin.toLocaleString('en-IN')} ({tradePrice > 0 ? Math.round((yourMargin / tradePrice) * 100) : 0}%)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Jeweler margin</span>
                <span className="font-medium text-blue-600">₹{jewelerMargin.toLocaleString('en-IN')} ({mrp > 0 ? Math.round((jewelerMargin / mrp) * 100) : 0}%)</span>
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
                    : 'bg-white text-stone-600 border-stone-200 hover:border-[#1E3A5F]'
                }`}>{m.label}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/catalog" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</Link>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
