'use client'

import { useEffect, useState } from 'react'
import {
  Diamond, Plus, Edit2, Trash2, X, Check, Save, ArrowLeft, RefreshCw, Search
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'

type StoneType = {
  id: string
  name: string
  category: 'diamond' | 'moissanite' | 'cz' | 'gemstone'
  default_cert_body?: string
  sort_order: number
  is_active: boolean
}

type ClarityGrade = {
  id: string
  code: string
  label: string
  bucket_id?: string
  sort_order: number
  is_active: boolean
}

type ColorGrade = {
  id: string
  code: string
  label: string
  bucket_id?: string
  sort_order: number
  is_active: boolean
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

type StonePrice = {
  id?: string
  stone_type_id: string
  shape_id: string
  size_id: string
  clarity_grade_id: string | null
  color_grade_id: string | null
  price_per_piece: number
  is_available: boolean
  lead_time_days: number | null
}

export default function StonesPage() {
  const [activeTab, setActiveTab] = useState<'types' | 'grades' | 'pricing'>('types')
  const [stoneTypes, setStoneTypes] = useState<StoneType[]>([])
  const [clarityGrades, setClarityGrades] = useState<ClarityGrade[]>([])
  const [colorGrades, setColorGrades] = useState<ColorGrade[]>([])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Stone Type Modal State
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<StoneType | null>(null)
  const [typeForm, setTypeForm] = useState({
    name: '',
    category: 'diamond' as 'diamond' | 'moissanite' | 'cz' | 'gemstone',
    default_cert_body: '',
    sort_order: 100,
    is_active: true
  })

  // Pricing State
  const [selectedStoneType, setSelectedStoneType] = useState<string>('')
  const [selectedShape, setSelectedShape] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [pricesList, setPricesList] = useState<StonePrice[]>([])
  const [savingPrices, setSavingPrices] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)

  // Quick Multiplier State
  const [bulkMultiplier, setBulkMultiplier] = useState<string>('1.0')

  // Local grid edits cache
  const [gridEdits, setGridEdits] = useState<Record<string, number>>({})

  useEffect(() => {
    loadAllData()
  }, [])

  async function loadAllData() {
    setLoading(true)
    try {
      // 1. Fetch from stones master endpoint
      const res = await fetch('/api/configurator/stones')
      const data = await res.json()
      setStoneTypes(data.stoneTypes || [])
      setClarityGrades(data.clarityGrades || [])
      setColorGrades(data.colorGrades || [])

      // Set default selected type
      if (data.stoneTypes && data.stoneTypes.length > 0 && !selectedStoneType) {
        setSelectedStoneType(data.stoneTypes[0].id)
      }

      // 2. Fetch shapes and sizes from base tables via client
      const [shapesRes, sizesRes] = await Promise.all([
        supabase.from('diamond_shapes').select('id, name').order('name'),
        supabase.from('diamond_sizes').select('id, shape_id, label, approx_carats').order('approx_carats')
      ])

      setShapes(shapesRes.data || [])
      setSizes(sizesRes.data || [])

      if (shapesRes.data && shapesRes.data.length > 0 && !selectedShape) {
        setSelectedShape(shapesRes.data[0].id)
      }
    } catch (err: any) {
      toast('Failed to load stones data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load prices list when filters change
  useEffect(() => {
    if (selectedStoneType) {
      loadPrices()
    }
  }, [selectedStoneType, selectedShape, selectedSize, activeTab])

  async function loadPrices() {
    if (activeTab !== 'pricing') return
    setPricesLoading(true)
    setGridEdits({})
    try {
      const res = await fetch(`/api/configurator/stones/prices?stone_type_id=${selectedStoneType}`)
      const data = await res.json()
      setPricesList(data.prices || [])
    } catch (err: any) {
      console.error('Failed to load prices', err)
    } finally {
      setPricesLoading(false)
    }
  }

  // Filter sizes based on shape
  const filteredSizes = sizes.filter(s => s.shape_id === selectedShape)
  useEffect(() => {
    if (filteredSizes.length > 0) {
      // Auto select first size if current size isn't in shape's size list
      if (!filteredSizes.some(s => s.id === selectedSize)) {
        setSelectedSize(filteredSizes[0].id)
      }
    } else {
      setSelectedSize('')
    }
  }, [selectedShape, sizes])

  // Stone Type CRUD
  function openAddType() {
    setEditingType(null)
    setTypeForm({
      name: '',
      category: 'diamond',
      default_cert_body: '',
      sort_order: 100,
      is_active: true
    })
    setTypeModalOpen(true)
  }

  function openEditType(type: StoneType) {
    setEditingType(type)
    setTypeForm({
      name: type.name,
      category: type.category,
      default_cert_body: type.default_cert_body || '',
      sort_order: type.sort_order,
      is_active: type.is_active
    })
    setTypeModalOpen(true)
  }

  async function saveType(e: React.FormEvent) {
    e.preventDefault()
    if (!typeForm.name || !typeForm.category) {
      toast('Name and category are required', 'error')
      return
    }

    try {
      const method = editingType ? 'PUT' : 'POST'
      const url = editingType ? `/api/configurator/stones/${editingType.id}` : '/api/configurator/stones'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save stone type')

      toast(`Stone type "${typeForm.name}" saved`, 'success')
      setTypeModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteType(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? All custom prices in the matrix for this stone type will be deleted.`)) return
    try {
      const res = await fetch(`/api/configurator/stones/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete stone type')
      toast(`Stone type "${name}" deleted`, 'success')
      loadAllData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Get current category of selected stone type
  const selectedTypeObj = stoneTypes.find(t => t.id === selectedStoneType)
  const isDiamondCategory = selectedTypeObj?.category === 'diamond'

  // Helper key to look up price in list
  function getPriceKey(clarityId: string | null, colorId: string | null, sizeId: string) {
    return `${selectedShape}_${sizeId}_${clarityId || 'null'}_${colorId || 'null'}`
  }

  function getCellValue(clarityId: string | null, colorId: string | null, sizeId: string) {
    const key = getPriceKey(clarityId, colorId, sizeId)
    if (gridEdits[key] !== undefined) return gridEdits[key]
    
    const record = pricesList.find(
      p => p.shape_id === selectedShape &&
           p.size_id === sizeId &&
           p.clarity_grade_id === clarityId &&
           p.color_grade_id === colorId
    )
    return record ? record.price_per_piece : 0
  }

  function handleCellChange(clarityId: string | null, colorId: string | null, sizeId: string, value: string) {
    const key = getPriceKey(clarityId, colorId, sizeId)
    const num = value === '' ? 0 : Number(value)
    setGridEdits(prev => ({ ...prev, [key]: num }))
  }

  async function saveGridPrices() {
    setSavingPrices(true)
    try {
      const payload: any[] = []

      if (isDiamondCategory) {
        // Iterate only on selected size
        if (!selectedSize) {
          toast('Please select a size first', 'error')
          setSavingPrices(false)
          return
        }

        colorGrades.forEach(color => {
          clarityGrades.forEach(clarity => {
            const val = getCellValue(clarity.id, color.id, selectedSize)
            const existing = pricesList.find(
              p => p.shape_id === selectedShape &&
                   p.size_id === selectedSize &&
                   p.clarity_grade_id === clarity.id &&
                   p.color_grade_id === color.id
            )
            
            // Only send if it was modified or if it exists
            const key = getPriceKey(clarity.id, color.id, selectedSize)
            if (gridEdits[key] !== undefined || existing) {
              payload.push({
                id: existing?.id || undefined,
                stone_type_id: selectedStoneType,
                shape_id: selectedShape,
                size_id: selectedSize,
                clarity_grade_id: clarity.id,
                color_grade_id: color.id,
                price_per_piece: val,
                is_available: true
              })
            }
          })
        })
      } else {
        // Non-diamond pricing: list of sizes for selected shape
        filteredSizes.forEach(size => {
          const val = getCellValue(null, null, size.id)
          const existing = pricesList.find(
            p => p.shape_id === selectedShape &&
                 p.size_id === size.id &&
                 p.clarity_grade_id === null &&
                 p.color_grade_id === null
          )
          
          const key = getPriceKey(null, null, size.id)
          if (gridEdits[key] !== undefined || existing) {
            payload.push({
              id: existing?.id || undefined,
              stone_type_id: selectedStoneType,
              shape_id: selectedShape,
              size_id: size.id,
              clarity_grade_id: null,
              color_grade_id: null,
              price_per_piece: val,
              is_available: true
            })
          }
        })
      }

      if (payload.length === 0) {
        toast('No changes to save', 'info')
        setSavingPrices(false)
        return
      }

      const res = await fetch('/api/configurator/stones/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save prices')

      toast(`Successfully updated ${data.count} pricing records`, 'success')
      loadPrices()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSavingPrices(false)
    }
  }

  function applyBulkMultiplier() {
    const mult = Number(bulkMultiplier)
    if (isNaN(mult) || mult <= 0) {
      toast('Please enter a valid multiplier (e.g. 1.10 for +10%)', 'error')
      return
    }

    if (isDiamondCategory) {
      if (!selectedSize) return
      colorGrades.forEach(color => {
        clarityGrades.forEach(clarity => {
          const currentVal = getCellValue(clarity.id, color.id, selectedSize)
          const key = getPriceKey(clarity.id, color.id, selectedSize)
          setGridEdits(prev => ({
            ...prev,
            [key]: Math.round(currentVal * mult)
          }))
        })
      })
    } else {
      filteredSizes.forEach(size => {
        const currentVal = getCellValue(null, null, size.id)
        const key = getPriceKey(null, null, size.id)
        setGridEdits(prev => ({
          ...prev,
          [key]: Math.round(currentVal * mult)
        }))
      })
    }

    toast(`Applied ${bulkMultiplier}x multiplier locally. Click "Save Prices" to store.`, 'info')
  }

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Stones Registry & Pricing</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage stone types, grades, and prices matrix</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 max-w-md">
        <button onClick={() => setActiveTab('types')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'types' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Stone Types
        </button>
        <button onClick={() => setActiveTab('grades')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'grades' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Clarity & Color
        </button>
        <button onClick={() => setActiveTab('pricing')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pricing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Pricing Matrix
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading data...
        </div>
      ) : (
        <div>
          {/* Tab 1: Types */}
          {activeTab === 'types' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-stone-500">Configure core stone options and their certification bodies.</p>
                <Button onClick={openAddType} size="sm" className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Stone Type
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {stoneTypes.map(type => (
                  <div key={type.id} className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                          {type.name}
                          {!type.is_active && (
                            <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                          )}
                        </h3>
                        <div className="flex gap-1">
                          <button onClick={() => openEditType(type)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteType(type.id, type.name)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center mt-3">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-stone-100 text-stone-550 rounded-md">
                          Category: {type.category}
                        </span>
                        {type.default_cert_body && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-md">
                            Cert: {type.default_cert_body}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Grades */}
          {activeTab === 'grades' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Clarity Grades
                </h3>
                <p className="text-xs text-stone-400 mb-4">Seeded clarity codes used in diamond quality selection.</p>
                <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto pr-1">
                  {clarityGrades.map(g => (
                    <div key={g.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-semibold text-sm text-stone-850">{g.code}</span>
                      <span className="text-xs text-stone-500">{g.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-900 mb-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" /> Color Grades
                </h3>
                <p className="text-xs text-stone-400 mb-4">Seeded color spectrum variables used in diamond quality selection.</p>
                <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto pr-1">
                  {colorGrades.map(g => (
                    <div key={g.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-semibold text-sm text-stone-850">{g.code}</span>
                      <span className="text-xs text-stone-500">{g.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Pricing Matrix */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Stone Type</label>
                    <Select value={selectedStoneType} onChange={e => setSelectedStoneType(e.target.value)}>
                      {stoneTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Shape</label>
                    <Select value={selectedShape} onChange={e => setSelectedShape(e.target.value)}>
                      {shapes.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                  {isDiamondCategory && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Size Option</label>
                      <Select value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
                        <option value="">Select size...</option>
                        {filteredSizes.map(s => (
                          <option key={s.id} value={s.id}>{s.label} ({s.approx_carats} ct)</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                {/* Bulk adjustment tool */}
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-stone-700">Matrix Multiplier Tool</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">Scale all pricing values in the visible grid instantly.</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input type="number" step="0.01" value={bulkMultiplier} onChange={e => setBulkMultiplier(e.target.value)}
                      placeholder="e.g. 1.10" className="w-24 bg-white" />
                    <Button type="button" variant="tertiary" size="sm" onClick={applyBulkMultiplier}>
                      Apply Multiplier
                    </Button>
                  </div>
                </div>
              </div>

              {pricesLoading ? (
                <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Loading pricing records...
                </div>
              ) : isDiamondCategory ? (
                // DIAMOND MATRIX (Color x Clarity)
                selectedSize ? (
                  <div className="bg-white rounded-xl border border-stone-200 p-5 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          {selectedTypeObj?.name} Pricing Matrix
                        </h3>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Set the base rate (₹ per piece) for {shapes.find(s => s.id === selectedShape)?.name} shapes of size {filteredSizes.find(s => s.id === selectedSize)?.label}.
                        </p>
                      </div>
                      <Button onClick={saveGridPrices} disabled={savingPrices} size="sm">
                        {savingPrices ? 'Saving...' : 'Save Prices'}
                      </Button>
                    </div>

                    <div className="overflow-x-auto max-w-full">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-stone-50 text-stone-600 border-b border-stone-200">
                            <th className="p-3 text-left font-semibold border-r border-stone-200 w-24">Color / Clarity</th>
                            {clarityGrades.map(clarity => (
                              <th key={clarity.id} className="p-3 text-center font-semibold border-r border-stone-150 min-w-[100px]">
                                {clarity.code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {colorGrades.map(color => (
                            <tr key={color.id} className="border-b border-stone-150 hover:bg-stone-50/50">
                              <td className="p-3 font-semibold text-stone-700 bg-stone-50 border-r border-stone-200">{color.code}</td>
                              {clarityGrades.map(clarity => {
                                const val = getCellValue(clarity.id, color.id, selectedSize)
                                const isEdited = gridEdits[getPriceKey(clarity.id, color.id, selectedSize)] !== undefined
                                return (
                                  <td key={clarity.id} className="p-2 border-r border-stone-150 text-center">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-medium">₹</span>
                                      <input
                                        type="number"
                                        value={val === 0 ? '' : val}
                                        onChange={e => handleCellChange(clarity.id, color.id, selectedSize, e.target.value)}
                                        className={`w-full bg-stone-50 border rounded-lg pl-6 pr-2 py-1.5 text-center text-xs font-semibold focus:bg-white focus:outline-none focus:border-[#1E3A5F]/50 transition-colors ${
                                          isEdited ? 'border-amber-400 bg-amber-50/20' : 'border-stone-200'
                                        }`}
                                        placeholder="0"
                                      />
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-stone-400 border border-dashed border-stone-250 rounded-xl bg-white">
                    Select a shape and size to view and edit the diamond pricing matrix.
                  </div>
                )
              ) : (
                // NON-DIAMOND MATRIX (Simple list of sizes)
                <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-semibold text-stone-900">
                        {selectedTypeObj?.name} Pricing Matrix
                      </h3>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Set the flat price (₹ per piece) for {shapes.find(s => s.id === selectedShape)?.name} shape sizes.
                      </p>
                    </div>
                    <Button onClick={saveGridPrices} disabled={savingPrices} size="sm">
                      {savingPrices ? 'Saving...' : 'Save Prices'}
                    </Button>
                  </div>

                  {filteredSizes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {filteredSizes.map(size => {
                        const val = getCellValue(null, null, size.id)
                        const isEdited = gridEdits[getPriceKey(null, null, size.id)] !== undefined
                        return (
                          <div key={size.id} className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col justify-between">
                            <div>
                              <p className="text-xs font-semibold text-stone-850">{size.label}</p>
                              <p className="text-[10px] text-stone-400 mt-0.5">{size.approx_carats} ct average</p>
                            </div>
                            <div className="relative mt-3">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-medium">₹</span>
                              <input
                                type="number"
                                value={val === 0 ? '' : val}
                                onChange={e => handleCellChange(null, null, size.id, e.target.value)}
                                className={`w-full bg-white border rounded-xl pl-6 pr-3 py-2 text-sm font-semibold focus:outline-none focus:border-[#1E3A5F]/50 transition-colors ${
                                  isEdited ? 'border-amber-400 bg-amber-50/10' : 'border-stone-200'
                                }`}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-stone-400 italic">
                      No sizes registered for this shape. Add sizes first in diamond size settings.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stone Type Modal */}
      <Modal open={typeModalOpen} onClose={() => setTypeModalOpen(false)}
        title={editingType ? `Edit Stone: ${editingType.name}` : 'Register Stone Type'}>
        <form onSubmit={saveType} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Stone Name *</label>
            <Input value={typeForm.name} onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Lab-Grown Diamond, Sapphire" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Category *</label>
            <Select value={typeForm.category} onChange={e => setTypeForm(p => ({ ...p, category: e.target.value as any }))}>
              <option value="diamond">Diamond (Enables Color × Clarity pricing matrix)</option>
              <option value="moissanite">Moissanite (Flat size pricing)</option>
              <option value="cz">Cubic Zirconia (Flat size pricing)</option>
              <option value="gemstone">Gemstone (Flat size pricing)</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Default Certification Body</label>
            <Select value={typeForm.default_cert_body} onChange={e => setTypeForm(p => ({ ...p, default_cert_body: e.target.value }))}>
              <option value="">None (Uncertified)</option>
              <option value="IGI">IGI (International Gemological Institute)</option>
              <option value="GIA">GIA (Gemological Institute of America)</option>
              <option value="SGL">SGL (Solitaire Gemological Laboratories)</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sort Order</label>
              <Input type="number" value={typeForm.sort_order} onChange={e => setTypeForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center mt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                  checked={typeForm.is_active} onChange={e => setTypeForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-medium text-stone-700">Active Option</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4 mt-6">
            <Button type="button" variant="tertiary" onClick={() => setTypeModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Stone Type</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
