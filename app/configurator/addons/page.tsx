'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Edit2, Trash2, X, Check, ArrowLeft, RefreshCw, Info, PlusCircle
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'

type Addon = {
  id: string
  name: string
  addon_type: 'engraving' | 'certification' | 'packaging' | 'shipping' | 'insurance'
  pricing_type: 'fixed' | 'per_character' | 'percent'
  price: number
  description?: string
  max_characters?: number | null
  font_options?: { value: string; label: string }[] | null
  is_active: boolean
  sort_order: number
  created_at?: string
}

const ADDON_TYPES = [
  { value: 'engraving', label: 'Engraving' },
  { value: 'certification', label: 'Certification (IGI/GIA/etc)' },
  { value: 'packaging', label: 'Premium Packaging' },
  { value: 'shipping', label: 'Special Shipping (Express)' },
  { value: 'insurance', label: 'Insurance' }
]

const PRICING_TYPES = [
  { value: 'fixed', label: 'Fixed Rate (₹ flat)' },
  { value: 'per_character', label: 'Per Character (₹/char)' },
  { value: 'percent', label: 'Percentage (% of cart)' }
]

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [form, setForm] = useState({
    name: '',
    addon_type: 'engraving' as 'engraving' | 'certification' | 'packaging' | 'shipping' | 'insurance',
    pricing_type: 'fixed' as 'fixed' | 'per_character' | 'percent',
    price: '',
    description: '',
    max_characters: '',
    font_options_raw: '', // comma-separated fonts
    is_active: true,
    sort_order: 100
  })

  useEffect(() => {
    loadAddons()
  }, [])

  async function loadAddons() {
    setLoading(true)
    try {
      const res = await fetch('/api/configurator/addons')
      const data = await res.json()
      setAddons(data.addons || [])
    } catch (err: any) {
      toast('Failed to load add-ons: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openAddAddon() {
    setEditingAddon(null)
    setForm({
      name: '',
      addon_type: 'engraving',
      pricing_type: 'fixed',
      price: '',
      description: '',
      max_characters: '30',
      font_options_raw: 'Classic Serif, Script, Block',
      is_active: true,
      sort_order: 100
    })
    setModalOpen(true)
  }

  function openEditAddon(addon: Addon) {
    setEditingAddon(addon)
    const rawFonts = addon.font_options
      ? addon.font_options.map(f => f.label).join(', ')
      : ''
    setForm({
      name: addon.name,
      addon_type: addon.addon_type,
      pricing_type: addon.pricing_type,
      price: String(addon.price),
      description: addon.description || '',
      max_characters: addon.max_characters ? String(addon.max_characters) : '',
      font_options_raw: rawFonts,
      is_active: addon.is_active,
      sort_order: addon.sort_order
    })
    setModalOpen(true)
  }

  async function saveAddon(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.addon_type || !form.pricing_type || !form.price) {
      toast('Required fields missing', 'error')
      return
    }

    // Convert raw font options list to JSON array
    let font_options = null
    if (form.addon_type === 'engraving' && form.font_options_raw) {
      font_options = form.font_options_raw
        .split(',')
        .map(f => f.trim())
        .filter(Boolean)
        .map(f => ({
          value: f.toLowerCase().replace(/\s+/g, '-'),
          label: f
        }))
    }

    const payload = {
      name: form.name,
      addon_type: form.addon_type,
      pricing_type: form.pricing_type,
      price: Number(form.price),
      description: form.description,
      max_characters: form.addon_type === 'engraving' && form.max_characters ? Number(form.max_characters) : null,
      font_options,
      is_active: form.is_active,
      sort_order: form.sort_order
    }

    try {
      const method = editingAddon ? 'PUT' : 'POST'
      const url = editingAddon ? `/api/configurator/addons/${editingAddon.id}` : '/api/configurator/addons'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save add-on')

      toast(`Add-on "${form.name}" saved`, 'success')
      setModalOpen(false)
      loadAddons()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteAddon(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete add-on "${name}"?`)) return
    try {
      const res = await fetch(`/api/configurator/addons/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete add-on')
      toast(`Add-on "${name}" deleted`, 'success')
      loadAddons()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  function getPricingDisplay(addon: Addon) {
    if (addon.pricing_type === 'fixed') {
      return `₹${addon.price.toLocaleString('en-IN')} flat`
    }
    if (addon.pricing_type === 'per_character') {
      return `₹${addon.price.toLocaleString('en-IN')} per character`
    }
    if (addon.pricing_type === 'percent') {
      return `${addon.price}% surcharge`
    }
    return `₹${addon.price}`
  }

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Product Add-on Options</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage customer-facing checkout add-ons</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-stone-500">
          Add-ons appear at checkout or product page to offer premium certificates, custom text, packaging upgrades, etc.
        </p>
        <Button onClick={openAddAddon} size="sm" className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Option
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading add-on options...
        </div>
      ) : addons.length === 0 ? (
        <div className="p-12 text-center text-stone-400 border border-dashed border-stone-250 rounded-2xl bg-white">
          <PlusCircle className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="font-semibold text-stone-700">No add-ons defined</p>
          <p className="text-xs text-stone-500 mt-1">Add your first checkout addition using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {addons.map(addon => (
            <div key={addon.id} className={`bg-white rounded-xl border p-5 flex flex-col justify-between hover:shadow-sm transition-shadow ${
              addon.is_active ? 'border-stone-200' : 'border-stone-200 opacity-60 bg-stone-50/50'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-stone-900 flex items-center gap-1.5">
                    {addon.name}
                    {!addon.is_active && (
                      <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                    )}
                  </h3>
                  <div className="flex gap-1">
                    <button onClick={() => openEditAddon(addon)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteAddon(addon.id, addon.name)}
                      className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-stone-100 text-stone-550 rounded">
                    {addon.addon_type}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-800/10 text-stone-800 rounded">
                    {getPricingDisplay(addon)}
                  </span>
                </div>

                {addon.description && (
                  <p className="text-xs text-stone-500 mb-4 leading-normal">{addon.description}</p>
                )}

                {addon.addon_type === 'engraving' && (
                  <div className="border-t border-stone-100 pt-3 text-xs text-stone-450 space-y-1">
                    <p className="font-semibold text-stone-400 uppercase tracking-wider text-[9px] mb-1">Engraving Specs</p>
                    <p>Max length: <span className="font-bold text-stone-700">{addon.max_characters || 'Uncapped'} chars</span></p>
                    {addon.font_options && addon.font_options.length > 0 && (
                      <p>Fonts: <span className="text-stone-700">{addon.font_options.map(f => f.label).join(', ')}</span></p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingAddon ? `Edit Addon: ${editingAddon.name}` : 'Create Addon Option'}>
        <form onSubmit={saveAddon} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Addon Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. IGI Certification, Laser Engraving" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Addon Type *</label>
              <Select value={form.addon_type} onChange={e => setForm(p => ({ ...p, addon_type: e.target.value as any }))}>
                {ADDON_TYPES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Pricing Model *</label>
              <Select value={form.pricing_type} onChange={e => setForm(p => ({ ...p, pricing_type: e.target.value as any }))}>
                {PRICING_TYPES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Price / Surcharge value *</label>
              <div className="relative">
                {form.pricing_type === 'percent' ? (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-semibold">%</span>
                ) : (
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-semibold">₹</span>
                )}
                <Input type="number" step="0.01" value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder={form.pricing_type === 'percent' ? 'e.g. 2' : 'e.g. 1500'}
                  className={form.pricing_type === 'percent' ? 'pr-8' : 'pl-7'} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sort Order</label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Explain to the customer what they get with this addon option" rows={2} />
          </div>

          {form.addon_type === 'engraving' && (
            <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl space-y-3">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Engraving Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Maximum characters</label>
                  <Input type="number" value={form.max_characters} onChange={e => setForm(p => ({ ...p, max_characters: e.target.value }))}
                    placeholder="e.g. 30" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Available fonts (comma separated)</label>
                  <Input value={form.font_options_raw} onChange={e => setForm(p => ({ ...p, font_options_raw: e.target.value }))}
                    placeholder="e.g. Classic Serif, Script, Block" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center border-t border-stone-150 pt-4 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-stone-800"
                checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <span className="text-sm font-medium text-stone-700">Option Active</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="tertiary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Addon</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
