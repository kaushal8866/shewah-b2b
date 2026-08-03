'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KARAT_FACTORS } from '@/lib/karat'

const MATERIALS = [
  { value: 'gold_24k', label: 'Gold (24kt net)', unit: 'g' },
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
  return (
    <Suspense fallback={<div className="p-4 text-sm text-secondary">Loading...</div>}>
      <StockReceiveForm />
    </Suspense>
  )
}

function StockReceiveForm() {
  const router = useRouter()
  // Order detail "Request stock" CTAs deep-link in here with a
  // material/shape/size/pieces prefill so the operator can save in one click.
  const searchParams = useSearchParams()
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([])
  const [shapes, setShapes] = useState<{ id: string; name: string; active: boolean }[]>([])
  const [sizes, setSizes] = useState<{ id: string; shape_id: string; label: string; active: boolean }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    from: 'vendor',
    material_type: 'gold_24k',
    item_label: '',
    quantity: '',
    vendor_id: '',
    manufacturing_partner_id: '',
    reference: '',
    notes: '',
    movement_date: new Date().toISOString().split('T')[0],
    diamond_shape_id: '',
    diamond_size_id: '',
    pieces: '',
    // Task 78: gold is stored only as 24kt-net. The karat picker below acts as
    // a calculator — operators may enter the gross weight at the karat they
    // bought it as, and we convert to 24kt-net before saving.
    gold_input_karat: '24',
    gold_gross_qty: '',
  })

  // One-shot prefill from query string (e.g. ?material_type=diamond_lgd&diamond_shape_id=…&diamond_size_id=…&pieces=3).
  // Carats are intentionally left blank so the operator can weigh + enter the
  // actual figure (carats are the source of truth — pieces is a count hint).
  useEffect(() => {
    if (!searchParams) return
    const mt = searchParams.get('material_type') || ''
    const sh = searchParams.get('diamond_shape_id') || ''
    const sz = searchParams.get('diamond_size_id') || ''
    const pcs = searchParams.get('pieces') || ''
    const item = searchParams.get('item_label') || ''
    if (!mt && !sh && !sz && !pcs && !item) return
    setForm(prev => ({
      ...prev,
      ...(mt ? { material_type: mt } : {}),
      ...(sh ? { diamond_shape_id: sh } : {}),
      ...(sz ? { diamond_size_id: sz } : {}),
      ...(pcs ? { pieces: pcs } : {}),
      ...(item ? { item_label: item } : {}),
    }))
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      supabase.from('vendors').select('id, name').order('name'),
      supabase.from('manufacturing_partners').select('id, name').eq('status', 'active').order('name'),
      fetch('/api/diamonds/shapes').then(r => r.json()),
      fetch('/api/diamonds/sizes').then(r => r.json()),
    ]).then(([v, p, sh, sz]: any[]) => {
      setVendors(v.data || [])
      setPartners(p.data || [])
      setShapes(sh.shapes || [])
      setSizes(sz.sizes || [])
    })
  }, [])

  function set<K extends keyof typeof form>(k: K, v: string) { setForm(prev => ({ ...prev, [k]: v })) }
  const mat = MATERIALS.find(m => m.value === form.material_type)
  const isDiamond = form.material_type.startsWith('diamond')
  const isGold = form.material_type === 'gold_24k'

  // Live conversion of gross-at-karat → 24kt-net. When operator types into the
  // calculator we keep `quantity` in sync so the existing save path is unchanged.
  const goldKaratNum = parseInt(form.gold_input_karat, 10) || 24
  const goldFactor = KARAT_FACTORS[goldKaratNum] ?? 1
  const goldGrossNum = parseFloat(form.gold_gross_qty) || 0
  const goldNet24k = isGold && goldGrossNum > 0
    ? Math.round(goldGrossNum * goldFactor * 10000) / 10000
    : 0
  useEffect(() => {
    if (!isGold) return
    if (goldGrossNum > 0) {
      const next = String(goldNet24k)
      setForm(prev => prev.quantity === next ? prev : { ...prev, quantity: next })
    }
  }, [isGold, goldGrossNum, goldFactor, goldNet24k])
  const activeShapes = shapes.filter(s => s.active || s.id === form.diamond_shape_id)
  const activeSizes = sizes.filter(z => z.shape_id === form.diamond_shape_id && (z.active || z.id === form.diamond_size_id))

  async function handleSave() {
    setError('')
    const qty = parseFloat(form.quantity)
    if (isGold) {
      if (!goldGrossNum || goldGrossNum <= 0) { setError('Enter a positive gross weight.'); return }
      if (!goldNet24k || goldNet24k <= 0) { setError('Computed 24kt-net is zero — check the karat.'); return }
    } else if (!qty || qty <= 0) { setError('Enter a positive quantity.'); return }
    if (form.from === 'vendor' && !form.vendor_id) { setError('Pick a vendor.'); return }
    if (form.from === 'partner' && !form.manufacturing_partner_id) { setError('Pick a karigar.'); return }
    if (form.material_type === 'finding' && !form.item_label.trim()) { setError('Findings need a name.'); return }
    if (isDiamond) {
      if (!form.diamond_shape_id) { setError('Pick a diamond shape from the catalog.'); return }
      if (!form.diamond_size_id)  { setError('Pick a diamond size from the catalog.'); return }
      const pcs = parseInt(form.pieces)
      if (!pcs || pcs <= 0) { setError('Enter the number of pieces.'); return }
    }

    setSaving(true)
    try {
      const finalQty = isGold ? goldNet24k : qty
      const goldNote = isGold && goldKaratNum !== 24
        ? `Vendor gross: ${goldGrossNum}g @ ${goldKaratNum}K → ${goldNet24k}g 24kt-net`
        : null
      const r = await fetch('/api/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: finalQty,
          notes: goldNote
            ? (form.notes ? `${form.notes} | ${goldNote}` : goldNote)
            : form.notes,
          item_label: form.material_type === 'finding' ? form.item_label.trim() : null,
          diamond_shape_id: isDiamond ? form.diamond_shape_id : null,
          diamond_size_id: isDiamond ? form.diamond_size_id : null,
          pieces: isDiamond ? parseInt(form.pieces) : null,
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

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white"
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
            {!isGold && (
              <div>
                <label className={lbl}>Quantity ({mat?.unit}) *</label>
                <input type="number" inputMode="decimal" step="0.0001" className={inp}
                  value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </div>
            )}
          </div>

          {isGold && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-stone-700">
                Gold inventory is held only as 24kt-net. Enter the gross weight + the karat you bought it at; we convert below.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Gross weight (g) *</label>
                  <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                    value={form.gold_gross_qty} onChange={e => set('gold_gross_qty', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Karat *</label>
                  <select className={inp} value={form.gold_input_karat}
                    onChange={e => set('gold_input_karat', e.target.value)}>
                    {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                  </select>
                </div>
              </div>
              <div className="text-xs text-stone-600 bg-white border border-stone-200 rounded-md px-3 py-2">
                Will credit central stock as <strong>{goldNet24k.toFixed(4)}g of 24kt-net</strong>
                {goldGrossNum > 0 && goldKaratNum !== 24 && (
                  <span className="text-stone-400"> ({goldGrossNum}g × {goldFactor.toFixed(3)})</span>
                )}
              </div>
            </div>
          )}
          {form.material_type === 'finding' && (
            <div>
              <label className={lbl}>Finding name *</label>
              <input className={inp} value={form.item_label}
                onChange={e => set('item_label', e.target.value)}
                placeholder="e.g. Screw back 18K Y" />
            </div>
          )}

          {isDiamond && (
            <div className="grid grid-cols-3 gap-3 bg-stone-50 border border-stone-100 rounded-lg p-3">
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
              <p className="col-span-3 text-[11px] text-stone-400">
                Manage shapes & sizes in <Link href="/diamonds/catalog" className="underline">Diamond catalog</Link>.
              </p>
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
            className="flex items-center gap-2 bg-stone-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Receive'}
          </button>
        </div>
      </div>
    </div>
  )
}
