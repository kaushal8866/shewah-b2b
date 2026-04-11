'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from './Toast'

type Props = {
  isOpen: boolean
  onClose: () => void
  partnerId: string
  partnerCity?: string
  partnerCircuit?: string
  onSaved: () => void
}

const OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'callback', label: 'Callback requested' },
  { value: 'sample_requested', label: 'Sample requested' },
  { value: 'order_placed', label: 'Order placed' },
]

export default function VisitModal({ isOpen, onClose, partnerId, partnerCity, partnerCircuit, onSaved }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    outcome: 'interested',
    notes: '',
    catalog_left: false,
    sample_offered: false,
    next_action: '',
    next_action_date: '',
  })

  if (!isOpen) return null

  function set(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('visits').insert([{
      partner_id: partnerId,
      visit_date: new Date().toISOString().split('T')[0],
      city: partnerCity,
      circuit: partnerCircuit,
      outcome: form.outcome,
      notes: form.notes,
      catalog_left: form.catalog_left,
      sample_offered: form.sample_offered,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
    }])
    setSaving(false)

    if (error) {
      toast('Failed to log visit: ' + error.message, 'error')
      return
    }

    toast('Visit logged successfully')
    setForm({
      outcome: 'interested', notes: '', catalog_left: false,
      sample_offered: false, next_action: '', next_action_date: '',
    })
    onSaved()
    onClose()
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1.5"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-900">Log visit</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={lbl}>Outcome *</label>
            <select className={inp} value={form.outcome} onChange={e => set('outcome', e.target.value)}>
              {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Notes</label>
            <textarea className={`${inp} resize-none`} rows={3}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What happened during the visit..." />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input type="checkbox" checked={form.catalog_left}
                onChange={e => set('catalog_left', e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-[#C49C64] focus:ring-[#C49C64]" />
              Catalog left
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input type="checkbox" checked={form.sample_offered}
                onChange={e => set('sample_offered', e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-[#C49C64] focus:ring-[#C49C64]" />
              Sample offered
            </label>
          </div>

          <div>
            <label className={lbl}>Next action</label>
            <input className={inp} value={form.next_action}
              onChange={e => set('next_action', e.target.value)}
              placeholder="e.g. Send pricing, Follow up call" />
          </div>

          <div>
            <label className={lbl}>Next action date</label>
            <input type="date" className={inp} value={form.next_action_date}
              onChange={e => set('next_action_date', e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#C49C64] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Log visit'}
          </button>
        </div>
      </div>
    </div>
  )
}
