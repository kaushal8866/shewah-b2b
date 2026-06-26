'use client'

import { useEffect, useState } from 'react'
import {
  Hammer, Plus, Edit2, Trash2, X, Check, ArrowLeft, RefreshCw, Filter
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Metal = {
  id: string
  name: string
  karats?: { karat: number; karat_label: string }[]
}

type Finish = {
  id: string
  name: string
}

type LabourRate = {
  id: string
  metal_id: string
  karat: number | null
  finish_id: string | null
  category: string | null
  rate_per_gram: number
  metal?: { name: string }
  finish?: { name: string }
  updated_at: string
}

const CATEGORIES = [
  { value: 'ring', label: 'Rings' },
  { value: 'pendant', label: 'Pendants' },
  { value: 'earring', label: 'Earrings' },
  { value: 'bracelet', label: 'Bracelets' },
  { value: 'necklace', label: 'Necklaces' },
  { value: 'bangle', label: 'Bangles' }
]

export default function LabourRatesPage() {
  const [rates, setRates] = useState<LabourRate[]>([])
  const [metals, setMetals] = useState<Metal[]>([])
  const [finishes, setFinishes] = useState<Finish[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<LabourRate | null>(null)
  const [form, setForm] = useState({
    metal_id: '',
    karat: '',
    finish_id: '',
    category: '',
    rate_per_gram: ''
  })

  // Filters State
  const [filterMetal, setFilterMetal] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [rRes, mRes, fRes] = await Promise.all([
        fetch('/api/configurator/labour'),
        fetch('/api/configurator/metals'),
        fetch('/api/configurator/finishes')
      ])

      const rData = await rRes.json()
      const mData = await mRes.json()
      const fData = await fRes.json()

      setRates(rData.rates || [])
      setMetals(mData.metals || [])
      setFinishes(fData.finishes || [])

      if (mData.metals && mData.metals.length > 0) {
        setForm(prev => ({ ...prev, metal_id: mData.metals[0].id }))
      }
    } catch (err: any) {
      toast('Failed to load data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openAddRate() {
    setEditingRate(null)
    setForm({
      metal_id: metals.length > 0 ? metals[0].id : '',
      karat: '',
      finish_id: '',
      category: '',
      rate_per_gram: ''
    })
    setModalOpen(true)
  }

  function openEditRate(rate: LabourRate) {
    setEditingRate(rate)
    setForm({
      metal_id: rate.metal_id,
      karat: rate.karat ? String(rate.karat) : '',
      finish_id: rate.finish_id || '',
      category: rate.category || '',
      rate_per_gram: String(rate.rate_per_gram)
    })
    setModalOpen(true)
  }

  async function saveRate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.metal_id || !form.rate_per_gram) {
      toast('Metal and Rate per gram are required', 'error')
      return
    }

    const payload = {
      metal_id: form.metal_id,
      karat: form.karat ? Number(form.karat) : null,
      finish_id: form.finish_id || null,
      category: form.category || null,
      rate_per_gram: Number(form.rate_per_gram)
    }

    try {
      const method = editingRate ? 'PUT' : 'POST'
      const url = editingRate ? `/api/configurator/labour/${editingRate.id}` : '/api/configurator/labour'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save rate')

      toast('Labour rate saved', 'success')
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteRate(id: string) {
    if (!confirm('Are you sure you want to delete this labour rate?')) return
    try {
      const res = await fetch(`/api/configurator/labour/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete rate')
      toast('Labour rate deleted', 'success')
      loadData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Get karats for selected metal in form
  const selectedMetalObj = metals.find(m => m.id === form.metal_id)
  const availableKarats = selectedMetalObj?.karats || []

  // Filtered rates to display
  const filteredRates = rates.filter(rate => {
    if (filterMetal !== 'all' && rate.metal_id !== filterMetal) return false
    if (filterCategory !== 'all' && rate.category !== filterCategory) return false
    return true
  })

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Labour Costs Matrix</h1>
          <p className="text-stone-500 text-sm mt-0.5">Define standard karigar making charges per gram</p>
        </div>
      </div>

      {/* Filters and Add button */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-semibold shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter by:
          </div>
          <Select value={filterMetal} onChange={e => setFilterMetal(e.target.value)} className="w-36 h-9 bg-white">
            <option value="all">All Metals</option>
            {metals.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-36 h-9 bg-white">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <Button onClick={openAddRate} size="sm" className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
          <Plus className="w-4 h-4" /> Add Labour Rate
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading labour rates...
        </div>
      ) : filteredRates.length === 0 ? (
        <div className="p-12 text-center text-stone-405 border border-dashed border-stone-250 rounded-2xl bg-white">
          No labour rates found matching the filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4">Metal Alloy</th>
                  <th className="px-6 py-4">Karat Purity</th>
                  <th className="px-6 py-4">Finish</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Rate / Gram</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredRates.map(rate => (
                  <tr key={rate.id} className="hover:bg-stone-50/40">
                    <td className="px-6 py-4 font-semibold text-stone-900">
                      {rate.metal?.name || 'Unknown Metal'}
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      {rate.karat ? `${rate.karat}K` : <span className="text-stone-400 italic">All Karats</span>}
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      {rate.finish?.name || <span className="text-stone-400 italic">Default Finish</span>}
                    </td>
                    <td className="px-6 py-4 text-stone-600 capitalize">
                      {rate.category || <span className="text-stone-400 italic">All Categories</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-stone-850">
                      ₹{rate.rate_per_gram.toLocaleString('en-IN')}/g
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEditRate(rate)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteRate(rate.id)}
                          className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingRate ? 'Edit Labour Rate' : 'Add Labour Cost Rate'}>
        <form onSubmit={saveRate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Metal Alloy *</label>
            <Select value={form.metal_id} onChange={e => setForm(p => ({ ...p, metal_id: e.target.value, karat: '' }))}>
              {metals.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Karat Purity</label>
            <Select value={form.karat} onChange={e => setForm(p => ({ ...p, karat: e.target.value }))}>
              <option value="">All Karats (Global default for metal)</option>
              {availableKarats.map(k => (
                <option key={k.karat} value={k.karat}>{k.karat_label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Finish Compatibility</label>
            <Select value={form.finish_id} onChange={e => setForm(p => ({ ...p, finish_id: e.target.value }))}>
              <option value="">Default Finish (All surface finishes)</option>
              {finishes.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Category Scoping</label>
            <Select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">All Categories (Global default)</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Rate per Gram (₹) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-semibold">₹</span>
              <Input type="number" step="1" value={form.rate_per_gram}
                onChange={e => setForm(p => ({ ...p, rate_per_gram: e.target.value }))}
                placeholder="e.g. 450" className="pl-7" required />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">Standards making charges karigar is paid per gram of gross weight.</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-stone-150 pt-4 mt-6">
            <Button type="button" variant="tertiary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Rate</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
