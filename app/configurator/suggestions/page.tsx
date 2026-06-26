'use client'

import { useEffect, useState } from 'react'
import {
  FileText, Plus, Edit2, Trash2, X, Check, ArrowLeft, RefreshCw, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Suggestion = {
  id: string
  trigger_type: 'stone_type' | 'metal' | 'chain_type' | 'finish'
  trigger_value: string
  suggest_type: 'stone_type' | 'metal' | 'chain_type' | 'finish'
  suggest_value: string
  message: string
  savings_text?: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
}

const TRIGGER_TYPES = [
  { value: 'stone_type', label: 'Stone Type (e.g. Natural Diamond)' },
  { value: 'metal', label: 'Metal (e.g. Silver)' },
  { value: 'chain_type', label: 'Chain Type (e.g. Standard Chain)' },
  { value: 'finish', label: 'Finish (e.g. High Polish)' }
]

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null)
  const [form, setForm] = useState({
    trigger_type: 'stone_type' as 'stone_type' | 'metal' | 'chain_type' | 'finish',
    trigger_value: '',
    suggest_type: 'stone_type' as 'stone_type' | 'metal' | 'chain_type' | 'finish',
    suggest_value: '',
    message: '',
    savings_text: '',
    sort_order: 100,
    is_active: true
  })

  useEffect(() => {
    loadSuggestions()
  }, [])

  async function loadSuggestions() {
    setLoading(true)
    try {
      const res = await fetch('/api/configurator/suggestions')
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch (err: any) {
      toast('Failed to load suggestions: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openAddSuggestion() {
    setEditingSuggestion(null)
    setForm({
      trigger_type: 'stone_type',
      trigger_value: 'Natural Diamond',
      suggest_type: 'stone_type',
      suggest_value: 'Lab-Grown Diamond',
      message: 'Same optical and chemical brilliance at a fraction of the cost.',
      savings_text: 'Save up to 40%',
      sort_order: 100,
      is_active: true
    })
    setModalOpen(true)
  }

  function openEditSuggestion(sug: Suggestion) {
    setEditingSuggestion(sug)
    setForm({
      trigger_type: sug.trigger_type,
      trigger_value: sug.trigger_value,
      suggest_type: sug.suggest_type,
      suggest_value: sug.suggest_value,
      message: sug.message,
      savings_text: sug.savings_text || '',
      sort_order: sug.sort_order,
      is_active: sug.is_active
    })
    setModalOpen(true)
  }

  async function saveSuggestion(e: React.FormEvent) {
    e.preventDefault()
    if (!form.trigger_value || !form.suggest_value || !form.message) {
      toast('Required fields missing', 'error')
      return
    }

    const payload = {
      trigger_type: form.trigger_type,
      trigger_value: form.trigger_value,
      suggest_type: form.suggest_type,
      suggest_value: form.suggest_value,
      message: form.message,
      savings_text: form.savings_text || null,
      sort_order: form.sort_order,
      is_active: form.is_active
    }

    try {
      const method = editingSuggestion ? 'PUT' : 'POST'
      const url = editingSuggestion ? `/api/configurator/suggestions/${editingSuggestion.id}` : '/api/configurator/suggestions'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save suggestion')

      toast('Suggestion saved', 'success')
      setModalOpen(false)
      loadSuggestions()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteSuggestion(id: string) {
    if (!confirm('Are you sure you want to delete this suggestion rule?')) return
    try {
      const res = await fetch(`/api/configurator/suggestions/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete suggestion')
      toast('Suggestion deleted', 'success')
      loadSuggestions()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Alternative Suggestions</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage material replacement and upgrade suggestions</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-stone-500">
          Configure non-intrusive alternative suggestions to present to buyers (e.g. upgrade standard chains or opt for LGD savings).
        </p>
        <Button onClick={openAddSuggestion} size="sm" className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Suggestion
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading suggestions...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-12 text-center text-stone-400 border border-dashed border-stone-250 rounded-2xl bg-white">
          <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="font-semibold text-stone-700">No suggestions defined</p>
          <p className="text-xs text-stone-500 mt-1">Configure your first replacement rule using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {suggestions.map(sug => (
            <div key={sug.id} className={`bg-white rounded-xl border p-5 flex flex-col justify-between hover:shadow-sm transition-shadow ${
              sug.is_active ? 'border-stone-200' : 'border-stone-200 opacity-60 bg-stone-50/50'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-[#1E3A5F]">{sug.trigger_value}</span>
                    <span className="text-stone-400">➔</span>
                    <span className="font-bold text-emerald-600">{sug.suggest_value}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditSuggestion(sug)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSuggestion(sug.id)}
                      className="p-1.5 text-red-400 hover:text-red-750 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-stone-50 border border-stone-150 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-stone-850">"{sug.message}"</p>
                </div>

                {sug.savings_text && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                    {sug.savings_text}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingSuggestion ? 'Edit Suggestion Rule' : 'Add Alternative Suggestion'}>
        <form onSubmit={saveSuggestion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Trigger Type *</label>
              <Select value={form.trigger_type}
                onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value as any, suggest_type: e.target.value as any }))}>
                {TRIGGER_TYPES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Trigger Value *</label>
              <Input value={form.trigger_value} onChange={e => setForm(p => ({ ...p, trigger_value: e.target.value }))}
                placeholder="e.g. Natural Diamond, High Polish" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Suggestion Value *</label>
              <Input value={form.suggest_value} onChange={e => setForm(p => ({ ...p, suggest_value: e.target.value }))}
                placeholder="e.g. Lab-Grown Diamond, Satin" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Savings label / banner text</label>
              <Input value={form.savings_text} onChange={e => setForm(p => ({ ...p, savings_text: e.target.value }))}
                placeholder="e.g. Save up to 40%" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Message shown to user *</label>
            <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Upgrade to White Gold for lasting durability and a premium, modern shine." rows={2} required />
          </div>

          <div className="flex justify-between items-center border-t border-stone-150 pt-4 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <span className="text-sm font-medium text-stone-700">Suggestion Active</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="tertiary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Suggestion</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
