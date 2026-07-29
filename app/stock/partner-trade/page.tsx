'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle, Diamond } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MATERIALS = [
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'ct' },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'ct' },
]

const TRADE_TYPES = [
  { value: 'sale', label: 'Sale to Partner' },
  { value: 'return', label: 'Return from Partner' },
]

function PartnerTradeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [partners, setPartners] = useState<{ id: string; store_name: string; owner_name: string }[]>([])
  const [shapes, setShapes] = useState<{ id: string; name: string; active: boolean }[]>([])
  const [sizes, setSizes] = useState<{ id: string; shape_id: string; label: string; active: boolean }[]>([])
  const [groups, setGroups] = useState<{ diamond_shape_id: string | null; diamond_size_id: string | null; material_type: string; carats: number; pieces: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allowNegative, setAllowNegative] = useState(false)

  const [form, setForm] = useState({
    partner_id: '',
    trade_type: 'sale',
    material_type: 'diamond_lgd',
    diamond_shape_id: '',
    diamond_size_id: '',
    carats: '',
    pieces: '',
    rate_per_carat: '',
    reference: '',
    notes: '',
    trade_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    supabase.from('partners')
      .select('id, store_name, owner_name')
      .order('store_name')
      .then(({ data }) => setPartners(data || []))

    fetch('/api/diamonds/shapes').then(r => r.json()).then(d => setShapes(d.shapes || []))
    fetch('/api/diamonds/sizes').then(r => r.json()).then(d => setSizes(d.sizes || []))
    fetch('/api/diamonds/stock').then(r => r.json()).then(d => setGroups(d.groups || []))
  }, [])

  // Prefill partner_id from query string if available
  useEffect(() => {
    if (!searchParams) return
    const pId = searchParams.get('partner_id') || ''
    if (pId) {
      setForm(prev => ({ ...prev, partner_id: pId }))
    }
  }, [searchParams])

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  const mat = MATERIALS.find(m => m.value === form.material_type)
  const activeShapes = shapes.filter(s => s.active || s.id === form.diamond_shape_id)
  const activeSizes = sizes.filter(z => z.shape_id === form.diamond_shape_id && (z.active || z.id === form.diamond_size_id))

  // Find on-hand stock for the selected shape and size
  const selectedGroupStock = groups.find(g =>
    g.material_type === form.material_type &&
    g.diamond_shape_id === form.diamond_shape_id &&
    g.diamond_size_id === form.diamond_size_id
  )
  const onHandCt = selectedGroupStock?.carats || 0
  const onHandPcs = selectedGroupStock?.pieces || 0

  // Computed total price
  const caratsVal = parseFloat(form.carats) || 0
  const rateVal = parseFloat(form.rate_per_carat) || 0
  const totalAmount = Math.round(caratsVal * rateVal * 100) / 100

  async function handleSave() {
    setError('')
    if (!form.partner_id) { setError('Select a B2B partner.'); return }
    if (!form.diamond_shape_id) { setError('Pick a diamond shape.'); return }
    if (!form.diamond_size_id) { setError('Pick a diamond size.'); return }

    const cts = parseFloat(form.carats)
    if (isNaN(cts) || cts <= 0) { setError('Enter a positive carats value.'); return }

    const pcs = parseInt(form.pieces, 10)
    if (isNaN(pcs) || pcs <= 0) { setError('Enter a positive pieces count.'); return }

    const rate = parseFloat(form.rate_per_carat)
    if (isNaN(rate) || rate < 0) { setError('Enter a non-negative rate per carat.'); return }

    // Client-side stock check for Sales
    if (form.trade_type === 'sale' && !allowNegative) {
      if (onHandPcs < pcs || onHandCt < cts) {
        setError(`Not enough stock. Available: ${onHandCt} ct / ${onHandPcs} pcs. Requested: ${cts} ct / ${pcs} pcs.`);
        return;
      }
    }

    setSaving(true)
    try {
      const r = await fetch('/api/stock/partner-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          carats: cts,
          pieces: pcs,
          rate_per_carat: rate,
          allow_negative_central: allowNegative,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to save trade')
      router.push(`/partners/${form.partner_id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/stock" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Diamond className="w-6 h-6 text-stone-800" />
            Record partner trade
          </h1>
          <p className="text-stone-500 text-sm">Sell or return loose diamonds directly to B2B partners</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Transaction Type *</label>
              <select className={inp} value={form.trade_type} onChange={e => set('trade_type', e.target.value)}>
                {TRADE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Partner *</label>
              <select className={inp} value={form.partner_id} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.store_name} ({p.owner_name})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Material Type *</label>
              <select className={inp} value={form.material_type} onChange={e => set('material_type', e.target.value)}>
                {MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Date *</label>
              <input type="date" className={inp} value={form.trade_date} onChange={e => set('trade_date', e.target.value)} />
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-stone-700">Diamond Specifications</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Shape *</label>
                <select className={inp} value={form.diamond_shape_id}
                  onChange={e => { set('diamond_shape_id', e.target.value); set('diamond_size_id', '') }}>
                  <option value="">Select...</option>
                  {activeShapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Size *</label>
                <select className={inp} value={form.diamond_size_id}
                  disabled={!form.diamond_shape_id}
                  onChange={e => set('diamond_size_id', e.target.value)}>
                  <option value="">{form.diamond_shape_id ? 'Select...' : 'Pick shape first'}</option>
                  {activeSizes.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Pieces *</label>
                <input type="number" inputMode="numeric" min="1" className={inp}
                  value={form.pieces} onChange={e => set('pieces', e.target.value)} />
              </div>
            </div>

            {form.diamond_shape_id && form.diamond_size_id && (
              <div className="text-xs text-stone-500 flex justify-between bg-white border border-stone-200 rounded p-2">
                <span>Central stock on hand:</span>
                <span className="font-medium text-stone-700">{onHandCt.toFixed(3)} ct / {onHandPcs} pcs</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Carats (ct) *</label>
              <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                value={form.carats} onChange={e => set('carats', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Rate per carat (₹) *</label>
              <input type="number" inputMode="decimal" min="0" className={inp}
                value={form.rate_per_carat} onChange={e => set('rate_per_carat', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Total Amount (₹)</label>
              <div className="w-full bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-sm font-semibold text-stone-700 h-9 flex items-center">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Reference (bill no)</label>
              <input className={inp} value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional details" />
            </div>
          </div>

          {form.trade_type === 'sale' && (
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-stone-800"
                checked={allowNegative} onChange={e => setAllowNegative(e.target.checked)} />
              <div>
                <p className="text-xs font-semibold text-red-900">Allow negative central stock</p>
                <p className="text-[10px] text-red-700 mt-0.5">Override stock checks if physically inventory is available but not logged yet.</p>
              </div>
            </label>
          )}
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
            className="flex items-center gap-2 bg-stone-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Record Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PartnerTradePage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <PartnerTradeInner />
    </Suspense>
  )
}
