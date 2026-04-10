'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const CIRCUITS = ['Gujarat', 'Maharashtra', 'Madhya Pradesh', 'Rajasthan', 'Delhi NCR', 'Punjab', 'Karnataka', 'Tamil Nadu', 'Other']

export default function NewCollectionPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', circuit_target: '' })

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.name.trim()) { alert('Collection name is required'); return }
    setSaving(true)
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), description: form.description || null, circuit_target: form.circuit_target || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert('Error: ' + (data.error || res.statusText)); return }
    router.push(`/catalog/collections/${data.id}`)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog?tab=collections" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">New collection</h1>
          <p className="text-stone-400 text-sm">Create a curated lookbook for partners</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div>
          <label className={lbl}>Collection name *</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Summer 2026 Collection" autoFocus />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea className={`${inp} resize-none`} rows={3} value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="What's special about this collection? Occasion, style, price range…" />
        </div>
        <div>
          <label className={lbl}>Target circuit (optional)</label>
          <select className={inp} value={form.circuit_target} onChange={e => set('circuit_target', e.target.value)}>
            <option value="">All circuits</option>
            {CIRCUITS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-xs text-stone-400 mt-1">Helps you filter which partners to share this with</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Link href="/catalog?tab=collections" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
          Cancel
        </Link>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Creating...' : 'Create & add products'}
        </button>
      </div>
    </div>
  )
}
