'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function StockIssueInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([])
  const [balances, setBalances] = useState<{ material_type: string; item_label: string; balance: number; unit: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allowNegative, setAllowNegative] = useState(false)

  const [form, setForm] = useState({
    material_type: sp.get('material_type') || 'gold_18k',
    item_label: '',
    quantity: sp.get('amount') || '',
    manufacturing_partner_id: sp.get('partner_id') || '',
    reference: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    supabase.from('manufacturing_partners')
      .select('id, name').eq('active', true).order('name')
      .then(({ data }) => setPartners(data || []))
    fetch('/api/stock/balances').then(r => r.json()).then(d => setBalances(d.balances || []))
  }, [])

  function set<K extends keyof typeof form>(k: K, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  const mat = MATERIALS.find(m => m.value === form.material_type)
  const onHand = balances.find(b =>
    b.material_type === form.material_type &&
    (b.item_label || '') === (form.item_label || ''),
  )?.balance || 0
  const wantQty = parseFloat(form.quantity) || 0
  const shortfall = wantQty > onHand ? wantQty - onHand : 0

  async function handleSave() {
    setError('')
    if (!form.manufacturing_partner_id) { setError('Pick a karigar to issue to.'); return }
    if (wantQty <= 0) { setError('Enter a positive quantity.'); return }
    if (form.material_type === 'finding' && !form.item_label.trim()) {
      setError('Findings need a name (e.g. "Screw back 18K Y").'); return
    }
    if (shortfall > 0 && !allowNegative) {
      setError(`Only ${onHand} ${mat?.unit || ''} on hand. Tick "Override" to issue anyway, or record a purchase first.`)
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/stock/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: wantQty,
          item_label: form.material_type === 'finding' ? form.item_label.trim() : null,
          allow_negative_central: allowNegative,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not issue')
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
          <h1 className="text-2xl font-semibold text-stone-900">Issue to karigar</h1>
          <p className="text-stone-500 text-sm">Hand material out from central stock</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <div>
            <label className={lbl}>Karigar *</label>
            <select className={inp} value={form.manufacturing_partner_id}
              onChange={e => set('manufacturing_partner_id', e.target.value)}>
              <option value="">Select karigar...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
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

          <div className={`rounded-lg p-3 text-sm ${shortfall > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'}`}>
            <p className="text-stone-700">
              On hand: <span className="font-semibold">{onHand} {mat?.unit}</span>
              {wantQty > 0 && <> · After issue: <span className={`font-semibold ${shortfall > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{(onHand - wantQty).toFixed(4)} {mat?.unit}</span></>}
            </p>
            {shortfall > 0 && (
              <label className="flex items-start gap-2 mt-2 text-xs text-amber-800">
                <input type="checkbox" checked={allowNegative} onChange={e => setAllowNegative(e.target.checked)} className="mt-0.5" />
                <span>Override — issue anyway and let the central balance go negative (record a purchase to clear it).</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" className={inp} value={form.movement_date}
                onChange={e => set('movement_date', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Reference (challan no)</label>
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
            {saving ? 'Issuing...' : 'Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StockIssuePage() {
  return (
    <Suspense fallback={<div className="p-7 text-stone-400">Loading...</div>}>
      <StockIssueInner />
    </Suspense>
  )
}
