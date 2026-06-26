'use client'

import { useEffect, useState } from 'react'
import {
  Settings, ArrowLeft, Search, RefreshCw, Check, AlertCircle, Edit, Play, Info
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'

type Product = {
  id: string
  name: string
  code: string
  category: string
  gold_weight_g?: number
  gold_karat?: number
  is_configurable: boolean
  canonical_weight_g?: number | null
  dimension_constraints?: any | null
  configurator_options?: {
    metals?: string[]
    finishes?: string[]
    stone_types?: string[]
    shapes?: string[]
    sizes?: string[]
    addons?: string[]
  } | null
  variant_images?: Record<string, string[]> | null
  setting_types?: string[] | null
}

type Metal = {
  id: string
  name: string
  metal_type: string
  karats?: { id: string; karat: number; karat_label: string }[]
}

type Finish = {
  id: string
  name: string
}

type StoneType = {
  id: string
  name: string
  category: string
}

type Shape = {
  id: string
  name: string
}

type Size = {
  id: string
  shape_id: string
  label: string
  approx_carats: number
}

type Addon = {
  id: string
  name: string
}

const SETTING_TYPES_OPTIONS = [
  'Prong', 'Bezel', 'Channel', 'Pave', 'Tension', 'Cathedral', 'Halo', 'Flush'
]

export default function ProductMappingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [metals, setMetals] = useState<Metal[]>([])
  const [finishes, setFinishes] = useState<Finish[]>([])
  const [stoneTypes, setStoneTypes] = useState<StoneType[]>([])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const { toast } = useToast()

  // Editing state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'mapping' | 'simulator'>('mapping')

  // Mapping form state
  const [mappingForm, setMappingForm] = useState({
    is_configurable: false,
    canonical_weight_g: '',
    metals: [] as string[],
    finishes: [] as string[],
    stone_types: [] as string[],
    shapes: [] as string[],
    addons: [] as string[],
    setting_types: [] as string[]
  })

  // Simulator state
  const [simMetal, setSimMetal] = useState('')
  const [simKarat, setSimKarat] = useState('')
  const [simFinish, setSimFinish] = useState('')
  const [simStoneType, setSimStoneType] = useState('')
  const [simShape, setSimShape] = useState('')
  const [simSize, setSimSize] = useState('')
  const [simClarity, setSimClarity] = useState('')
  const [simColor, setSimColor] = useState('')
  const [simSelectedAddons, setSimSelectedAddons] = useState<string[]>([])
  
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState<any | null>(null)

  // Clarity/Color lists for simulator dropdowns
  const [clarityGrades, setClarityGrades] = useState<any[]>([])
  const [colorGrades, setColorGrades] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [mRes, fRes, sRes, addRes, shapesRes, sizesRes, prodsRes] = await Promise.all([
        fetch('/api/configurator/metals'),
        fetch('/api/configurator/finishes'),
        fetch('/api/configurator/stones'),
        fetch('/api/configurator/addons'),
        supabase.from('diamond_shapes').select('id, name').order('name'),
        supabase.from('diamond_sizes').select('id, shape_id, label, approx_carats').order('approx_carats'),
        supabase.from('products').select('*').order('code')
      ])

      const mData = await mRes.json()
      const fData = await fRes.json()
      const sData = await sRes.json()
      const addData = await addRes.json()

      setMetals(mData.metals || [])
      setFinishes(fData.finishes || [])
      setStoneTypes(sData.stoneTypes || [])
      setClarityGrades(sData.clarityGrades || [])
      setColorGrades(sData.colorGrades || [])
      setAddons(addData.addons || [])
      
      setShapes(shapesRes.data || [])
      setSizes(sizesRes.data || [])
      setProducts(prodsRes.data || [])
    } catch (err: any) {
      toast('Failed to load data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openEditProduct(prod: Product) {
    setEditingProduct(prod)
    setActiveSubTab('mapping')
    setSimResult(null)

    const opts = prod.configurator_options || {}
    setMappingForm({
      is_configurable: prod.is_configurable || false,
      canonical_weight_g: prod.canonical_weight_g ? String(prod.canonical_weight_g) : '',
      metals: opts.metals || [],
      finishes: opts.finishes || [],
      stone_types: opts.stone_types || [],
      shapes: opts.shapes || [],
      addons: opts.addons || [],
      setting_types: prod.setting_types || []
    })

    // Pre-populate simulator defaults
    const defaultMetal = opts.metals?.[0] || (metals.length > 0 ? metals[0].id : '')
    const selectedMetalObj = metals.find(m => m.id === defaultMetal)
    const defaultKarat = selectedMetalObj?.karats?.[0]?.karat || 18
    const defaultStone = opts.stone_types?.[0] || (stoneTypes.length > 0 ? stoneTypes[0].id : '')
    const defaultShape = opts.shapes?.[0] || (shapes.length > 0 ? shapes[0].id : '')
    
    setSimMetal(defaultMetal)
    setSimKarat(String(defaultKarat))
    setSimFinish(opts.finishes?.[0] || '')
    setSimStoneType(defaultStone)
    setSimShape(defaultShape)
    setSimClarity(clarityGrades[0]?.id || '')
    setSimColor(colorGrades[0]?.id || '')
    setSimSelectedAddons([])

    setEditModalOpen(true)
  }

  // Handle option checklist toggles
  function toggleOption(field: 'metals' | 'finishes' | 'stone_types' | 'shapes' | 'addons' | 'setting_types', id: string) {
    setMappingForm(prev => {
      const list = prev[field] as string[]
      const exists = list.includes(id)
      return {
        ...prev,
        [field]: exists ? list.filter(x => x !== id) : [...list, id]
      }
    })
  }

  async function saveMapping(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProduct) return

    const payload = {
      is_configurable: mappingForm.is_configurable,
      canonical_weight_g: mappingForm.canonical_weight_g ? Number(mappingForm.canonical_weight_g) : null,
      setting_types: mappingForm.setting_types.length > 0 ? mappingForm.setting_types : null,
      configurator_options: {
        metals: mappingForm.metals,
        finishes: mappingForm.finishes,
        stone_types: mappingForm.stone_types,
        shapes: mappingForm.shapes,
        addons: mappingForm.addons
      }
    }

    try {
      const res = await fetch(`/api/configurator/product-config/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save product options')

      toast(`Configurator options for ${editingProduct.code} updated`, 'success')
      setEditModalOpen(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Pricing Simulator Calculator
  async function runSimulation() {
    if (!editingProduct) return
    setSimLoading(true)
    setSimResult(null)

    // Build stone config payload
    const selectedStoneTypeObj = stoneTypes.find(t => t.id === simStoneType)
    const isDiamond = selectedStoneTypeObj?.category === 'diamond'

    const stone_config = simStoneType && simShape && simSize ? [{
      stone_type_id: simStoneType,
      shape_id: simShape,
      size_id: simSize,
      clarity_grade_id: isDiamond ? simClarity : null,
      color_grade_id: isDiamond ? simColor : null,
      count: 1
    }] : []

    const selected_addons = simSelectedAddons.map(aid => ({
      addon_id: aid,
      text: 'TEST' // Mock text for engraving character count pricing
    }))

    const payload = {
      productId: editingProduct.id,
      metal_id: simMetal,
      karat: Number(simKarat),
      finish_id: simFinish || null,
      stone_config,
      selected_addons
    }

    try {
      const res = await fetch('/api/configurator/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Price calculation failed')
      setSimResult(data)
    } catch (err: any) {
      toast('Simulation error: ' + err.message, 'error')
    } finally {
      setSimLoading(false)
    }
  }

  const selectedSimMetalObj = metals.find(m => m.id === simMetal)
  const simMetalKarats = selectedSimMetalObj?.karats || []

  // Filter sizes for sim shape
  const simShapeSizes = sizes.filter(s => s.shape_id === simShape)
  useEffect(() => {
    if (simShapeSizes.length > 0 && !simShapeSizes.some(s => s.id === simSize)) {
      setSimSize(simShapeSizes[0].id)
    }
  }, [simShape, sizes])

  // Filter products by query
  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase()
    if (p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
      if (filterCategory !== 'all' && p.category !== filterCategory) return false
      return true
    }
    return false
  })

  // Categories list
  const categories = Array.from(new Set(products.map(p => p.category)))

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Product Configuration Mapper</h1>
          <p className="text-stone-500 text-sm mt-0.5">Map allowed customize options per catalog product</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products by SKU code or name..."
            className="pl-9 bg-stone-50"
          />
        </div>
        <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full sm:w-44 bg-white">
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
          ))}
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading products...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center text-stone-400 border border-dashed border-stone-250 rounded-xl bg-white">
          No products found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4">SKU Code</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Ref Weight</th>
                  <th className="px-6 py-4">Configurator</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-stone-50/40">
                    <td className="px-6 py-4 font-mono font-bold text-stone-900">{prod.code}</td>
                    <td className="px-6 py-4 text-stone-800 font-medium">{prod.name}</td>
                    <td className="px-6 py-4 text-stone-500 capitalize">{prod.category}</td>
                    <td className="px-6 py-4 text-stone-600">
                      {prod.gold_weight_g ? `${prod.gold_weight_g}g (${prod.gold_karat}K)` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {prod.is_configurable ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold uppercase border border-emerald-250">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] bg-stone-100 text-stone-400 px-2 py-0.5 rounded-md font-medium uppercase">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button onClick={() => openEditProduct(prod)} variant="tertiary" size="sm" className="flex items-center gap-1.5 ml-auto">
                        <Edit className="w-3.5 h-3.5" /> Map Options
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options Mapping modal */}
      {editingProduct && (
        <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} size="lg"
          title={`Configure Options: ${editingProduct.code} - ${editingProduct.name}`}>
          
          <div className="flex gap-2 border-b border-stone-150 mb-5">
            <button onClick={() => setActiveSubTab('mapping')}
              className={`pb-2.5 text-sm font-semibold border-b-2 px-1 transition-all ${
                activeSubTab === 'mapping' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}>
              Allowed Options & Constraints
            </button>
            <button onClick={() => { setActiveSubTab('simulator'); runSimulation(); }}
              className={`pb-2.5 text-sm font-semibold border-b-2 px-1 transition-all flex items-center gap-1.5 ${
                activeSubTab === 'simulator' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}>
              <Play className="w-3.5 h-3.5" /> Live Price Simulator
            </button>
          </div>

          {activeSubTab === 'mapping' ? (
            <form onSubmit={saveMapping} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center mt-5 bg-stone-50 border border-stone-200 rounded-xl p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                      checked={mappingForm.is_configurable}
                      onChange={e => setMappingForm(p => ({ ...p, is_configurable: e.target.checked }))} />
                    <div>
                      <span className="text-sm font-semibold text-stone-900 block">Enable Configurator UI</span>
                      <span className="text-[10px] text-stone-450 block">Exposes custom options to storefront shoppers.</span>
                    </div>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Canonical gold weight (g)</label>
                  <Input type="number" step="0.001" value={mappingForm.canonical_weight_g}
                    onChange={e => setMappingForm(p => ({ ...p, canonical_weight_g: e.target.value }))}
                    placeholder={`Reference base gold weight (currently ${editingProduct.gold_weight_g}g)`} />
                  <p className="text-[10px] text-stone-400 mt-1">Weight used as baseline to scale other metal configurations.</p>
                </div>
              </div>

              {/* Compatible lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-96 overflow-y-auto pr-1">
                {/* Metals */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Metals</h4>
                  <div className="space-y-1.5">
                    {metals.map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.metals.includes(m.id)}
                          onChange={() => toggleOption('metals', m.id)} />
                        <span>{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Finishes */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Finishes</h4>
                  <p className="text-[9px] text-stone-450 mb-2">Leave all unchecked to support all configured finishes.</p>
                  <div className="space-y-1.5">
                    {finishes.map(f => (
                      <label key={f.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.finishes.includes(f.id)}
                          onChange={() => toggleOption('finishes', f.id)} />
                        <span>{f.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Stone Types */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Stone Types</h4>
                  <div className="space-y-1.5">
                    {stoneTypes.map(st => (
                      <label key={st.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.stone_types.includes(st.id)}
                          onChange={() => toggleOption('stone_types', st.id)} />
                        <span>{st.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Setting Types */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Setting Types</h4>
                  <div className="space-y-1.5">
                    {SETTING_TYPES_OPTIONS.map(st => (
                      <label key={st} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.setting_types.includes(st.toLowerCase())}
                          onChange={() => toggleOption('setting_types', st.toLowerCase())} />
                        <span>{st} Setting</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Shapes */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl md:col-span-2">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Stone Shapes</h4>
                  <p className="text-[9px] text-stone-450 mb-2">Leave all unchecked to support all shapes registered in base tables.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {shapes.map(s => (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.shapes.includes(s.id)}
                          onChange={() => toggleOption('shapes', s.id)} />
                        <span>{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Add-ons */}
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl md:col-span-2">
                  <h4 className="font-semibold text-xs text-stone-800 mb-2 uppercase tracking-wide">Allowed Checkout Add-ons</h4>
                  <p className="text-[9px] text-stone-450 mb-2">Select add-ons specific to this product. Unchecked defaults to global catalog rules.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {addons.map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={mappingForm.addons.includes(a.id)}
                          onChange={() => toggleOption('addons', a.id)} />
                        <span>{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-stone-150 pt-4">
                <Button type="button" variant="tertiary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save Options</Button>
              </div>
            </form>
          ) : (
            // LIVE PRICE SIMULATOR
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 border border-stone-200 rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Metal</label>
                  <Select value={simMetal} onChange={e => { setSimMetal(e.target.value); setSimKarat(''); }}>
                    {metals.filter(m => mappingForm.metals.length === 0 || mappingForm.metals.includes(m.id)).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Karat</label>
                  <Select value={simKarat} onChange={e => setSimKarat(e.target.value)}>
                    {simMetalKarats.map(k => (
                      <option key={k.id} value={k.karat}>{k.karat_label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Finish</label>
                  <Select value={simFinish} onChange={e => setSimFinish(e.target.value)}>
                    <option value="">Default Finish</option>
                    {finishes.filter(f => mappingForm.finishes.length === 0 || mappingForm.finishes.includes(f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Stone Type</label>
                  <Select value={simStoneType} onChange={e => setSimStoneType(e.target.value)}>
                    <option value="">No Stone (Metal Only)</option>
                    {stoneTypes.filter(s => mappingForm.stone_types.length === 0 || mappingForm.stone_types.includes(s.id)).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                    ))}
                  </Select>
                </div>
                {simStoneType && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Shape</label>
                      <Select value={simShape} onChange={e => setSimShape(e.target.value)}>
                        {shapes.filter(s => mappingForm.shapes.length === 0 || mappingForm.shapes.includes(s.id)).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Size</label>
                      <Select value={simSize} onChange={e => setSimSize(e.target.value)}>
                        {simShapeSizes.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </Select>
                    </div>
                    {stoneTypes.find(t => t.id === simStoneType)?.category === 'diamond' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Clarity</label>
                          <Select value={simClarity} onChange={e => setSimClarity(e.target.value)}>
                            {clarityGrades.map(c => (
                              <option key={c.id} value={c.id}>{c.code}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-0.5">Color</label>
                          <Select value={simColor} onChange={e => setSimColor(e.target.value)}>
                            {colorGrades.map(c => (
                              <option key={c.id} value={c.id}>{c.code}</option>
                            ))}
                          </Select>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Addons checkbox in sim */}
              {mappingForm.addons.length > 0 && (
                <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Simulate Addons</p>
                  <div className="grid grid-cols-2 gap-2">
                    {addons.filter(a => mappingForm.addons.includes(a.id)).map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-xs text-stone-650 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          checked={simSelectedAddons.includes(a.id)}
                          onChange={() => {
                            setSimSelectedAddons(prev =>
                              prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                            )
                          }} />
                        <span>{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={runSimulation} disabled={simLoading} className="w-full">
                {simLoading ? 'Calculating Price...' : 'Calculate Price Breakdown'}
              </Button>

              {simResult && (
                <div className="bg-stone-900 text-white rounded-2xl p-5 border border-stone-850 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div>
                      <p className="text-xs text-stone-400">Total B2B Floor Price</p>
                      <h4 className="text-2xl font-bold text-emerald-400">
                        ₹{simResult.breakup.floor_price_total.toLocaleString('en-IN')}
                      </h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider">Calculated net Gold Weight</p>
                      <p className="text-sm font-semibold text-white">{simResult.weights.calculated_net_gold_weight.toFixed(3)}g</p>
                      <p className="text-[10px] text-stone-500">Base weight: {simResult.weights.base_net_gold_weight}g</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="text-stone-400 uppercase tracking-wider font-bold text-[9px] mb-2">Simulated Price Breakup</p>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Metal alloy cost:</span>
                      <span className="font-semibold text-stone-200">₹{simResult.breakup.metal_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Labour (Making) charges:</span>
                      <span className="font-semibold text-stone-200">₹{simResult.breakup.labour_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Stone cost:</span>
                      <span className="font-semibold text-stone-200">₹{simResult.breakup.stone_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Add-on cost:</span>
                      <span className="font-semibold text-stone-200">₹{simResult.breakup.addon_cost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 text-sm">
                      <span className="text-stone-300 font-semibold">Total Floor Cost:</span>
                      <span className="font-bold text-emerald-400">₹{simResult.breakup.floor_price_total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
