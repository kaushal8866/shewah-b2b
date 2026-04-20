'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MATERIALS = [
  { value: 'gold_18k', label: 'Gold 18K', unit: 'g' },
  { value: 'gold_22k', label: 'Gold 22K', unit: 'g' },
  { value: 'gold_14k', label: 'Gold 14K', unit: 'g' },
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'ct' },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'ct' },
  { value: 'finding', label: 'Finding (specify name)', unit: 'pcs' },
]

const SOURCES = [
  { value: 'vendor', label: 'Purchase from vendor' },
  { value: 'partner', label: 'Return from karigar' },
  { value: 'adjustment_in', label: 'Adjustment (stock found / re-weigh up)' },
  { value: 'adjustment_out', label: 'Adjustment (shrinkage / re-weigh down)' },
]

export default function StockReceivePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    from: 'vendor',
    material_type: 'gold_18k',
    item_label: '',
    quantity: '',
    vendor_id: '',
    manufacturing_partner_id: '',
    reference: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    Promise.all([
      supabase.from('vendors').select('id, name').order('name'),
      supabase.from('manufacturing_partners').select('id, name').eq('active', true).order('name'),
    ]).then(([v, p]) => {
      setVendors(v.data || [])
      setPartners(p.data || [])
    })
  }, [])

  function set<K extends keyof typeof form>(k: K, v: string) { setForm(prev => ({ ...prev, [k]: v })) }
  const mat = MATERIALS.find(m => m.value === form.material_type)

  async function handleSave() {
    setError('')
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) { setError('Enter a positive quantity.'); return }
    if (form.from === 'vendor' && !form.vendor_id) { setError('Pick a vendor.'); return }
    if (form.from === 'partner' && !form.manufacturing_partner_id) { setError('Pick a karigar.'); return }
    if (form.material_type === 'finding' && !form.item_label.trim()) { setError('Findings need a name.'); return }

    setSaving(true)
    try {
      const r = await fetch('/api/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: qty,
          item_label: form.material_type === 'finding' ? form.item_label.trim() : null,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not record')
      router.push('/stock')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/stock" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Receive into stock</h1>
          <p className="text-stone-500 text-sm">Vendor purchase, karigar return, or adjustment</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <div>
            <label className={lbl}>Source *</label>
            <select className={inp} value={form.from} onChange={e => set('from', e.target.value)}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {form.from === 'vendor' && (
            <div>
              <label className={lbl}>Vendor *</label>
              <select className={inp} value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          {form.from === 'partner' && (
            <div>
              <label className={lbl}>Karigar *</label>
              <select className={inp} value={form.manufacturing_partner_id}
                onChange={e => set('manufacturing_partner_id', e.target.value)}>
                <option value="">Select karigar...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Material *</label>
              <select className={inp} value={form.material_type}
                onChange={e => { set('material_type', e.target.value); set('item_label', '') }}>
                {MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Quantity ({mat?.unit}) *</label>
              <input type="number" inputMode="decimal" step="0.0001" className={inp}
                value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
          </div>
          {form.material_type === 'finding' && (
            <div>
              <label className={lbl}>Finding name *</label>
              <input className={inp} value={form.item_label}
                onChange={e => set('item_label', e.target.value)}
                placeholder="e.g. Screw back 18K Y" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" className={inp} value={form.movement_date}
                onChange={e => set('movement_date', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Reference (bill no)</label>
              <input className={inp} value={form.reference}
                onChange={e => set('reference', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={`${inp} resize-none`} rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Optional context for the audit log" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/stock" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Receive'}
          </button>
        </div>
      </div>
    </div>
  )
}
