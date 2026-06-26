'use client'

import { useEffect, useState } from 'react'
import {
  Layers, Plus, Edit2, Trash2, X, Check, Save, Info, RefreshCw, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Karat = {
  id?: string
  metal_id?: string
  karat: number
  karat_label: string
  purity_factor: number
  sort_order: number
  is_active: boolean
}

type Metal = {
  id: string
  name: string
  metal_type: string
  color_hex: string
  color_name: string
  swatch_url?: string
  alloy_notes?: string
  sort_order: number
  is_active: boolean
  karats?: Karat[]
}

type FinishCompat = {
  id?: string
  finish_id?: string
  metal_id: string
  karat: number | null
}

type Finish = {
  id: string
  name: string
  description?: string
  swatch_url?: string
  labour_surcharge_percent: number
  sort_order: number
  is_active: boolean
  compatibilities?: FinishCompat[]
}

const PRESET_COLORS = [
  { hex: '#FFD700', name: 'Yellow Gold' },
  { hex: '#E8E8E8', name: 'White Gold / Platinum' },
  { hex: '#E8B4B8', name: 'Rose Gold' },
  { hex: '#C0C0C0', name: 'Silver' },
  { hex: '#E5E4E2', name: 'Platinum' }
]

export default function MaterialsPage() {
  const [tab, setTab] = useState<'metals' | 'finishes'>('metals')
  const [metals, setMetals] = useState<Metal[]>([])
  const [finishes, setFinishes] = useState<Finish[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Metal Modal State
  const [metalModalOpen, setMetalModalOpen] = useState(false)
  const [editingMetal, setEditingMetal] = useState<Metal | null>(null)
  const [metalForm, setMetalForm] = useState({
    name: '',
    metal_type: 'gold',
    color_hex: '#FFD700',
    color_name: 'Yellow',
    alloy_notes: '',
    sort_order: 100,
    is_active: true,
    karats: [] as Karat[]
  })

  // Finish Modal State
  const [finishModalOpen, setFinishModalOpen] = useState(false)
  const [editingFinish, setEditingFinish] = useState<Finish | null>(null)
  const [finishForm, setFinishForm] = useState({
    name: '',
    description: '',
    swatch_url: '',
    labour_surcharge_percent: 0,
    sort_order: 100,
    is_active: true,
    compatibilities: [] as FinishCompat[]
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [mRes, fRes] = await Promise.all([
        fetch('/api/configurator/metals'),
        fetch('/api/configurator/finishes')
      ])

      const mData = await mRes.json()
      const fData = await fRes.json()

      setMetals(mData.metals || [])
      setFinishes(fData.finishes || [])
    } catch (err: any) {
      toast('Failed to load materials data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Metal Actions
  function openAddMetal() {
    setEditingMetal(null)
    setMetalForm({
      name: '',
      metal_type: 'gold',
      color_hex: '#FFD700',
      color_name: 'Yellow',
      alloy_notes: '',
      sort_order: 100,
      is_active: true,
      karats: [
        { karat: 18, karat_label: '18K', purity_factor: 0.75, sort_order: 10, is_active: true }
      ]
    })
    setMetalModalOpen(true)
  }

  function openEditMetal(metal: Metal) {
    setEditingMetal(metal)
    setMetalForm({
      name: metal.name,
      metal_type: metal.metal_type,
      color_hex: metal.color_hex || '#FFD700',
      color_name: metal.color_name || '',
      alloy_notes: metal.alloy_notes || '',
      sort_order: metal.sort_order,
      is_active: metal.is_active,
      karats: metal.karats ? [...metal.karats] : []
    })
    setMetalModalOpen(true)
  }

  async function saveMetal(e: React.FormEvent) {
    e.preventDefault()
    if (!metalForm.name || !metalForm.metal_type) {
      toast('Name and metal type are required', 'error')
      return
    }

    try {
      const method = editingMetal ? 'PUT' : 'POST'
      const url = editingMetal ? `/api/configurator/metals/${editingMetal.id}` : '/api/configurator/metals'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metalForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save metal')

      toast(`Metal "${metalForm.name}" saved successfully`, 'success')
      setMetalModalOpen(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteMetal(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete metal "${name}"? All associated karats and rates will be removed.`)) return
    try {
      const res = await fetch(`/api/configurator/metals/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete metal')
      toast(`Metal "${name}" deleted`, 'success')
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  function addKaratRow() {
    setMetalForm(prev => {
      const current = prev.karats
      const lastK = current.length > 0 ? current[current.length - 1].karat : 18
      const nextK = lastK > 4 ? lastK - 4 : 10
      return {
        ...prev,
        karats: [
          ...current,
          {
            karat: nextK,
            karat_label: nextK === 925 ? '925' : `${nextK}K`,
            purity_factor: Number((nextK / 24).toFixed(3)),
            sort_order: (current.length + 1) * 10,
            is_active: true
          }
        ]
      }
    })
  }

  function updateKaratRow(index: number, field: keyof Karat, val: any) {
    setMetalForm(prev => {
      const list = [...prev.karats]
      const updated = { ...list[index], [field]: val }
      
      if (field === 'karat') {
        const num = Number(val)
        updated.karat_label = num === 925 ? '925' : num === 950 ? '950' : `${num}K`
        updated.purity_factor = num === 925 ? 0.925 : num === 950 ? 0.950 : Number((num / 24).toFixed(3))
      }
      
      list[index] = updated
      return { ...prev, karats: list }
    })
  }

  function removeKaratRow(index: number) {
    setMetalForm(prev => ({
      ...prev,
      karats: prev.karats.filter((_, i) => i !== index)
    }))
  }

  // Finish Actions
  function openAddFinish() {
    setEditingFinish(null)
    setFinishForm({
      name: '',
      description: '',
      swatch_url: '',
      labour_surcharge_percent: 0,
      sort_order: 100,
      is_active: true,
      compatibilities: []
    })
    setFinishModalOpen(true)
  }

  function openEditFinish(finish: Finish) {
    setEditingFinish(finish)
    setFinishForm({
      name: finish.name,
      description: finish.description || '',
      swatch_url: finish.swatch_url || '',
      labour_surcharge_percent: finish.labour_surcharge_percent,
      sort_order: finish.sort_order,
      is_active: finish.is_active,
      compatibilities: finish.compatibilities ? [...finish.compatibilities] : []
    })
    setFinishModalOpen(true)
  }

  async function saveFinish(e: React.FormEvent) {
    e.preventDefault()
    if (!finishForm.name) {
      toast('Name is required', 'error')
      return
    }

    try {
      const method = editingFinish ? 'PUT' : 'POST'
      const url = editingFinish ? `/api/configurator/finishes/${editingFinish.id}` : '/api/configurator/finishes'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finishForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save finish')

      toast(`Finish "${finishForm.name}" saved successfully`, 'success')
      setFinishModalOpen(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteFinish(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete finish "${name}"?`)) return
    try {
      const res = await fetch(`/api/configurator/finishes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete finish')
      toast(`Finish "${name}" deleted`, 'success')
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  function toggleFinishCompat(metalId: string, karatVal: number | null) {
    setFinishForm(prev => {
      const list = [...prev.compatibilities]
      const existingIdx = list.findIndex(c => c.metal_id === metalId && c.karat === karatVal)
      
      if (existingIdx >= 0) {
        // remove
        return {
          ...prev,
          compatibilities: list.filter((_, idx) => idx !== existingIdx)
        }
      } else {
        // add
        return {
          ...prev,
          compatibilities: [...list, { metal_id: metalId, karat: karatVal }]
        }
      }
    })
  }

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Materials Master</h1>
          <p className="text-stone-500 text-sm mt-0.5">Configure alloys, purity grades, and finishes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6 max-w-md">
        <button onClick={() => setTab('metals')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'metals' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Metals & Karats
        </button>
        <button onClick={() => setTab('finishes')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'finishes' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}>
          Surface Finishes
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading materials...
        </div>
      ) : (
        <div>
          {/* Metals Tab */}
          {tab === 'metals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-stone-500">Configure metals and their purity levels (e.g. 18K Gold, 950 Platinum).</p>
                <Button onClick={openAddMetal} size="sm" className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Metal
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {metals.map(metal => (
                  <div key={metal.id} className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center shadow-inner overflow-hidden shrink-0"
                            style={{ backgroundColor: metal.color_hex || '#CCC' }} />
                          <div>
                            <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                              {metal.name}
                              {!metal.is_active && (
                                <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                              )}
                            </h3>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider">{metal.metal_type}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditMetal(metal)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMetal(metal.id, metal.name)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {metal.alloy_notes && (
                        <p className="text-xs text-stone-500 bg-stone-50 rounded-lg p-2.5 mb-4 italic leading-relaxed">
                          "{metal.alloy_notes}"
                        </p>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Purity & Karat Grades</h4>
                        <div className="flex flex-wrap gap-2">
                          {metal.karats && metal.karats.length > 0 ? (
                            metal.karats.map(k => (
                              <span key={k.id} className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
                                k.is_active ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-red-50/30 border-red-100 text-red-450'
                              }`}>
                                <span className="font-bold">{k.karat_label}</span>
                                <span className="text-[10px] text-stone-400">({k.purity_factor})</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-stone-400 italic">No karats configured</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finishes Tab */}
          {tab === 'finishes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-stone-500">Configure surface finishes and surcharge rates for jewelry textures.</p>
                <Button onClick={openAddFinish} size="sm" className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Finish
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {finishes.map(finish => (
                  <div key={finish.id} className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                            {finish.name}
                            {!finish.is_active && (
                              <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                            )}
                          </h3>
                          <p className="text-xs text-[#1E3A5F] font-medium mt-0.5">
                            Labour surcharge: +{finish.labour_surcharge_percent}%
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditFinish(finish)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteFinish(finish.id, finish.name)}
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {finish.description && (
                        <p className="text-xs text-stone-500 mb-4">{finish.description}</p>
                      )}

                      <div>
                        <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Compatible Metals</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {finish.compatibilities && finish.compatibilities.length > 0 ? (
                            finish.compatibilities.map((c, i) => {
                              const met = metals.find(m => m.id === c.metal_id)
                              return (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#1E3A5F]/5 text-[#1E3A5F] border border-[#1E3A5F]/10 font-medium">
                                  {met?.name || 'Unknown Metal'} {c.karat ? `(${c.karat}K)` : '(All)'}
                                </span>
                              )
                            })
                          ) : (
                            <span className="text-xs text-stone-400 italic">Compatible with all metals</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metal Modal */}
      <Modal open={metalModalOpen} onClose={() => setMetalModalOpen(false)} size="lg"
        title={editingMetal ? `Edit Metal: ${editingMetal.name}` : 'Create Metal Option'}>
        <form onSubmit={saveMetal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Metal Name *</label>
              <Input value={metalForm.name} onChange={e => setMetalForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Yellow Gold, Platinum 950" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Metal Type *</label>
              <Select value={metalForm.metal_type} onChange={e => setMetalForm(p => ({ ...p, metal_type: e.target.value }))}>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="platinum">Platinum</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Color Name</label>
              <Input value={metalForm.color_name} onChange={e => setMetalForm(p => ({ ...p, color_name: e.target.value }))}
                placeholder="e.g. Yellow, White, Silver" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Color Hex Code</label>
              <div className="flex gap-2">
                <Input value={metalForm.color_hex} onChange={e => setMetalForm(p => ({ ...p, color_hex: e.target.value }))}
                  placeholder="#FFFFFF" className="flex-1" />
                <input type="color" value={metalForm.color_hex} onChange={e => setMetalForm(p => ({ ...p, color_hex: e.target.value }))}
                  className="w-10 h-10 border border-stone-200 rounded-xl cursor-pointer" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_COLORS.map(c => (
                  <button key={c.hex} type="button" onClick={() => setMetalForm(p => ({ ...p, color_hex: c.hex, color_name: c.name.split(' ')[0] }))}
                    className="w-5 h-5 rounded-full border border-stone-300 shadow-sm"
                    style={{ backgroundColor: c.hex }} title={c.name} />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Alloy composition / notes</label>
              <Textarea value={metalForm.alloy_notes} onChange={e => setMetalForm(p => ({ ...p, alloy_notes: e.target.value }))}
                placeholder="e.g. 75% Pure Gold, 15% Copper, 10% Silver" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sort Order</label>
              <Input type="number" value={metalForm.sort_order} onChange={e => setMetalForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                  checked={metalForm.is_active} onChange={e => setMetalForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-medium text-stone-700">Active and Configurable</span>
              </label>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm text-stone-850">Karat Grades</h4>
              <Button type="button" variant="tertiary" size="sm" onClick={addKaratRow} className="flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Karat
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {metalForm.karats.map((k, i) => (
                <div key={i} className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                  <div className="w-20">
                    <label className="block text-[10px] text-stone-400 font-semibold mb-0.5">Karat Grade</label>
                    <Input type="number" value={k.karat} onChange={e => updateKaratRow(i, 'karat', e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-stone-400 font-semibold mb-0.5">Label</label>
                    <Input value={k.karat_label} onChange={e => updateKaratRow(i, 'karat_label', e.target.value)} placeholder="e.g. 18K" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-stone-400 font-semibold mb-0.5">Purity factor</label>
                    <Input type="number" step="0.001" value={k.purity_factor} onChange={e => updateKaratRow(i, 'purity_factor', e.target.value)} />
                  </div>
                  <div className="w-16">
                    <label className="block text-[10px] text-stone-400 font-semibold mb-0.5">Order</label>
                    <Input type="number" value={k.sort_order} onChange={e => updateKaratRow(i, 'sort_order', Number(e.target.value))} />
                  </div>
                  <div className="flex items-center self-end mb-2.5">
                    <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                      checked={k.is_active} onChange={e => updateKaratRow(i, 'is_active', e.target.checked)} />
                  </div>
                  <button type="button" onClick={() => removeKaratRow(i)} className="self-end mb-1.5 p-1.5 text-stone-400 hover:text-red-650 hover:bg-stone-100 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {metalForm.karats.length === 0 && (
                <div className="p-4 text-center text-xs text-stone-400 border border-dashed border-stone-250 rounded-xl">
                  No karats specified. Configure at least one karat purity.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <Button type="button" variant="tertiary" onClick={() => setMetalModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Metal</Button>
          </div>
        </form>
      </Modal>

      {/* Finish Modal */}
      <Modal open={finishModalOpen} onClose={() => setFinishModalOpen(false)} size="lg"
        title={editingFinish ? `Edit Finish: ${editingFinish.name}` : 'Create Surface Finish'}>
        <form onSubmit={saveFinish} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Finish Name *</label>
              <Input value={finishForm.name} onChange={e => setFinishForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. High Polish, Hammered" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Labour surcharge percent (%)</label>
              <Input type="number" step="0.1" value={finishForm.labour_surcharge_percent}
                onChange={e => setFinishForm(p => ({ ...p, labour_surcharge_percent: Number(e.target.value) }))}
                placeholder="e.g. 5 for +5% charge" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
              <Textarea value={finishForm.description} onChange={e => setFinishForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description shown to customers" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Swatch texture URL</label>
              <Input value={finishForm.swatch_url} onChange={e => setFinishForm(p => ({ ...p, swatch_url: e.target.value }))}
                placeholder="Link to uploaded texture image" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sort Order</label>
              <Input type="number" value={finishForm.sort_order} onChange={e => setFinishForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                  checked={finishForm.is_active} onChange={e => setFinishForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-medium text-stone-700">Active and Configurable</span>
              </label>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-4">
            <h4 className="font-semibold text-sm text-stone-850 mb-2">Compatible Metal/Karat Combinations</h4>
            <p className="text-xs text-stone-400 mb-4">
              Select which metals and karats are compatible with this finish. Leave all unchecked to make this finish globally available on all options.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-56 overflow-y-auto p-1">
              {metals.map(m => (
                <div key={m.id} className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                  <p className="text-xs font-bold text-stone-800 mb-1.5">{m.name}</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                        checked={finishForm.compatibilities.some(c => c.metal_id === m.id && c.karat === null)}
                        onChange={() => toggleFinishCompat(m.id, null)} />
                      <span>All {m.name}</span>
                    </label>
                    {m.karats?.map(k => (
                      <label key={k.id} className="flex items-center gap-2 text-xs text-stone-600 pl-4 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#1E3A5F]"
                          disabled={finishForm.compatibilities.some(c => c.metal_id === m.id && c.karat === null)}
                          checked={finishForm.compatibilities.some(c => c.metal_id === m.id && c.karat === k.karat)}
                          onChange={() => toggleFinishCompat(m.id, k.karat)} />
                        <span>{k.karat_label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <Button type="button" variant="tertiary" onClick={() => setFinishModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Finish</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
