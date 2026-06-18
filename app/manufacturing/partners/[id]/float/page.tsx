'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { KARAT_FACTORS, normalizeGoldMaterialType } from '@/lib/karat'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, ArrowDown, ArrowUp, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const GOLD_KARATS = [
  { value: 14, label: '14K', purity: 0.585 },
  { value: 18, label: '18K', purity: 0.750 },
  { value: 22, label: '22K', purity: 0.916 },
  { value: 24, label: '24K', purity: 1.000 },
]

const MATERIAL_TYPES = [
  { value: 'gold_24k', label: 'Gold (24kt net)', unit: 'grams' },
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'carats' },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'carats' },
]

type Tab = 'deposit' | 'return' | 'consumption' | 'adjust'

function MaterialFloatInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const partnerId = params.id as string

  // Pre-fill from order context (e.g. "Record gold consumption for this order")
  const orderIdParam = searchParams ? (searchParams.get('order_id') || '') : ''
  // Accept both `type` (full word) and `deposit` (just the material type for
  // the over-issue shortcut from the new-order page).
  const depositShortcut = searchParams ? searchParams.get('deposit') : null
  const typeParam = depositShortcut
    ? ('deposit' as Tab)
    : (searchParams ? ((searchParams.get('type') as Tab) || 'deposit') : 'deposit')
  const materialParam = depositShortcut || (searchParams ? searchParams.get('material_type') : null) || 'gold_24k'
  const amountParam = searchParams ? (searchParams.get('amount') || '') : ''

  const [partner, setPartner] = useState<any>(null)
  const [floats, setFloats] = useState<any[]>([])
  const [buckets, setBuckets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>(['deposit','return','consumption','adjust'].includes(typeParam) ? typeParam : 'deposit')
  const [pendingNegative, setPendingNegative] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [txOk, setTxOk] = useState<string | null>(null)

  const [form, setForm] = useState({
    material_type: MATERIAL_TYPES.find(m => m.value === materialParam) ? materialParam : 'gold_24k',
    quantity: amountParam || '',
    rate_per_unit: '',
    reference: '',
    notes: depositShortcut ? 'Top-up before issuing manufacturing order' : '',
    date: new Date().toISOString().split('T')[0],
    order_id: orderIdParam,
  })

  useEffect(() => { load() }, [partnerId])

  useEffect(() => {
    if (orderIdParam) {
      supabase.from('orders').select('id, order_number, gold_weight_estimated, gold_weight_actual, gold_karat')
        .eq('id', orderIdParam).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setOrderInfo(data)
            // Task 78: order weights are gross-at-karat but the gold float is
            // 24kt-net. Pre-fill the converted 24kt-pure value so the karigar's
            // ledger reflects the right currency.
            const wGross = Number(data.gold_weight_actual) || Number(data.gold_weight_estimated) || 0
            if (wGross > 0) {
              const k = Number(data.gold_karat) || 24
              const f = KARAT_FACTORS[k] ?? 1
              const wNet = Math.round(wGross * f * 10000) / 10000
              setForm(prev => ({ ...prev, quantity: String(wNet) }))
            }
          }
        })
    }
  }, [orderIdParam])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: f }, { data: t }] = await Promise.all([
      supabase.from('manufacturing_partners').select('*').eq('id', partnerId).single(),
      supabase.from('material_float').select('*').eq('manufacturing_partner_id', partnerId),
      supabase.from('material_transactions')
        .select('*, material_float(material_type), orders(order_number)')
        .eq('manufacturing_partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setPartner(p)
    // Task 78 read-layer safety net: collapse any legacy gold_<N>k float rows
    // into a single canonical gold_24k entry (qty × KARAT_FACTORS[N]) so the
    // consumption-form "Current balance" lookup matches the bucket view above
    // and the operator never sees the legacy/24k mismatch.
    setFloats(normalizeFloatsForDisplay(f || []))
    setTransactions(t || [])
    try {
      const r = await fetch(`/api/manufacturing/partners/${partnerId}/buckets`)
      const j = await r.json()
      setBuckets(j.buckets || [])
    } catch { setBuckets([]) }
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  // Sum any pre-Task-78 legacy gold rows (gold_18k / gold_22k / gold_14k …)
  // into the canonical gold_24k row using the same conversion as the bucket
  // helper. Keeps the consumption form, the bucket cards, and the available
  // check perfectly aligned even when the migration script hasn't run yet.
  function normalizeFloatsForDisplay(rows: any[]) {
    // Two-pass: first pass keeps real (already-canonical) rows so we reuse
    // their `id` for new transactions; second pass folds any legacy karat
    // rows into them (or seeds a synthetic row whose id MUST NOT be used
    // when writing — handleTransaction creates a fresh gold_24k float in
    // that case so the new transaction's float_id never points back at a
    // gold_18k row that would re-trigger the 0.75 conversion on next read).
    const out = new Map<string, any>()
    const acc = (key: string, r: any, f: number, synthetic: boolean) => {
      const existing = out.get(key)
      const b  = Math.round((Number(r.balance        ) || 0) * f * 10000) / 10000
      const td = Math.round((Number(r.total_deposited) || 0) * f * 10000) / 10000
      const tr = Math.round((Number(r.total_returned ) || 0) * f * 10000) / 10000
      const tc = Math.round((Number(r.total_consumed ) || 0) * f * 10000) / 10000
      if (!existing) {
        out.set(key, {
          ...r,
          material_type: key,
          balance: b, total_deposited: td, total_returned: tr, total_consumed: tc,
          _synthetic: synthetic,
        })
      } else {
        existing.balance += b
        existing.total_deposited += td
        existing.total_returned += tr
        existing.total_consumed += tc
        // If a real row joins later, drop the synthetic flag so we reuse its id.
        if (!synthetic) existing._synthetic = false
      }
    }
    for (const r of rows) {
      const norm = normalizeGoldMaterialType(r.material_type)
      if (!norm.wasLegacy) acc(norm.material_type, r, 1, false)
    }
    for (const r of rows) {
      const norm = normalizeGoldMaterialType(r.material_type)
      if (norm.wasLegacy) acc(norm.material_type, r, norm.factor, true)
    }
    return Array.from(out.values())
  }

  // Compute the would-be new balance for the current form input
  const qty = parseFloat(form.quantity) || 0
  const currentFloat = floats.find(f => f.material_type === form.material_type)
  const currentBal = currentFloat?.balance ?? 0
  const delta = activeTab === 'deposit' ? Math.abs(qty)
              : activeTab === 'return' ? -Math.abs(qty)
              : activeTab === 'consumption' ? -Math.abs(qty)
              : qty   // adjustment: signed by user (negative allowed to decrease)
  const projectedBal = currentBal + delta
  const willGoNegative = qty !== 0 && projectedBal < 0

  async function handleTransaction() {
    setTxError(null)
    setTxOk(null)
    if (activeTab === 'adjust') {
      if (!qty || qty === 0) { setTxError('Enter a non-zero adjustment (use a minus sign to decrease)'); return }
    } else {
      if (!qty || qty <= 0) { setTxError('Enter a valid quantity greater than zero.'); return }
    }

    if (willGoNegative && !pendingNegative) {
      setPendingNegative(true)
      return
    }

    setSaving(true)

    let floatRecord = floats.find(f => f.material_type === form.material_type)
    // If the matching float row is purely synthetic (only legacy karat rows
    // existed for this material), seed a real gold_24k float row before
    // writing — never link a new 24kt-net transaction to a legacy gold_18k id.
    if (floatRecord?._synthetic) floatRecord = undefined
    if (!floatRecord) {
      const materialInfo = MATERIAL_TYPES.find(m => m.value === form.material_type)
      const { data: newFloat, error: floatErr } = await supabase.from('material_float').insert([{
        manufacturing_partner_id: partnerId,
        material_type: form.material_type,
        unit: materialInfo?.unit || 'grams',
        total_deposited: 0,
        total_consumed: 0,
      }]).select().single()
      if (floatErr || !newFloat) {
        setSaving(false)
        setTxError('Could not create the karigar\'s float row: ' + (floatErr?.message || 'unknown error'))
        return
      }
      floatRecord = newFloat
    }

    if (!floatRecord?.id) {
      setSaving(false)
      setTxError('Internal error — float row is missing an id. Refresh and try again.')
      return
    }

    const transactionType = activeTab === 'adjust' ? 'adjustment' : activeTab

    const { error: txErr } = await supabase.from('material_transactions').insert([{
      float_id: floatRecord.id,
      manufacturing_partner_id: partnerId,
      transaction_type: transactionType,
      quantity: qty,
      unit: floatRecord.unit,
      rate_per_unit: parseFloat(form.rate_per_unit) || null,
      total_value: form.rate_per_unit ? storedQty * parseFloat(form.rate_per_unit) : null,
      reference: form.reference || null,
      notes: isGoldType && inputKarat !== 24
        ? `${inputQty}g @ ${inputKarat}K → ${storedQty.toFixed(3)}g 24kt${form.notes ? '. ' + form.notes : ''}`
        : form.notes || null,
      date: form.date,
      order_id: form.order_id || null,
      negative_confirmed: willGoNegative,
    }])

    // Auto-update float balance
    const balanceUpdate: Record<string, any> = {}
    if (txType === 'deposit') {
      balanceUpdate.total_deposited = (floatRecord.total_deposited || 0) + storedQty
      balanceUpdate.balance = (floatRecord.balance || 0) + storedQty
    } else if (txType === 'withdrawal') {
      balanceUpdate.total_withdrawn = (floatRecord.total_withdrawn || 0) + storedQty
      balanceUpdate.balance = (floatRecord.balance || 0) - storedQty
    } else {
      // Adjustment — can be positive (add) or negative (subtract)
      balanceUpdate.balance = (floatRecord.balance || 0) + storedQty
    }

    await supabase.from('material_float')
      .update(balanceUpdate)
      .eq('id', floatRecord.id)

    setSaving(false)

    if (txErr) {
      // Surface the actual reason instead of clearing the form silently.
      // Common causes: RLS (must be master), the negative-balance check, or
      // a missing column from a not-yet-applied migration.
      setTxError('Could not record this transaction: ' + (txErr.message || 'unknown error'))
      return
    }

    setPendingNegative(false)
    setForm(prev => ({ ...prev, quantity: '', reference: '', notes: '' }))
    setTxOk(
      `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} of ${qty} ` +
      `${floatRecord.unit} recorded${form.order_id ? ' against this order' : ''}.`
    )
    load()
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  const txColors: Record<string, string> = {
    deposit: 'text-green-600',
    consumption: 'text-red-500',
    return: 'text-orange-500',
    adjustment: 'text-blue-500',
  }
  const txIcons: Record<string, JSX.Element> = {
    deposit: <ArrowDown className="w-3.5 h-3.5 text-green-500" />,
    consumption: <RefreshCw className="w-3.5 h-3.5 text-red-400" />,
    return: <ArrowUp className="w-3.5 h-3.5 text-orange-400" />,
    adjustment: <Plus className="w-3.5 h-3.5 text-blue-400" />,
  }

  return (
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32 max-w-3xl">
      <div className="flex items-center gap-4 mb-10">
        <Link href={`/manufacturing/partners/${partnerId}`} className="text-secondary hover:text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="display-sm">Material Float</h1>
          <p className="text-secondary mt-1">{partner?.name}</p>
        </div>
      </div>

      {orderInfo && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <div>
            <p className="text-amber-800 font-medium">Recording for order {orderInfo.order_number}</p>
            <p className="text-amber-700 text-xs">
              {orderInfo.gold_karat ? `${orderInfo.gold_karat}K · ` : ''}
              estimated {orderInfo.gold_weight_estimated || '—'}g, actual {orderInfo.gold_weight_actual || '—'}g
            </p>
          </div>
          <Link href={`/orders/${orderInfo.id}`} className="text-xs text-amber-700 hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Order
          </Link>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {buckets.map(b => {
          const info = MATERIAL_TYPES.find(m => m.value === b.material_type)
          const u = info?.unit === 'carats' ? 'ct' : 'g'
          const lowAvail = b.available < 1
          return (
            <div key={b.material_type} className={`bg-white rounded-xl border p-4 ${lowAvail ? 'border-amber-300' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-stone-800">{info?.label || b.material_type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-stone-400">In custody: {b.in_custody.toFixed(3)}{u}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 rounded-lg py-2.5 px-3 border border-emerald-100">
                  <p className="text-[10px] uppercase text-emerald-700 tracking-wider">Available</p>
                  <p className={`text-lg font-semibold ${lowAvail ? 'text-amber-700' : 'text-emerald-700'}`}>{b.available.toFixed(3)}{u}</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-2.5 px-3 border border-amber-100">
                  <p className="text-[10px] uppercase text-amber-700 tracking-wider">Reserved</p>
                  <p className="text-lg font-semibold text-amber-700">{b.reserved.toFixed(3)}{u}</p>
                </div>
                <div className="bg-stone-50 rounded-lg py-2.5 px-3 border border-stone-200">
                  <p className="text-[10px] uppercase text-stone-500 tracking-wider">Used</p>
                  <p className="text-lg font-semibold text-stone-700">{b.used.toFixed(3)}{u}</p>
                </div>
              </div>
            </div>
          )
        })}
        {buckets.length === 0 && !loading && (
          <div className="text-center py-6 text-stone-400 text-sm bg-white rounded-xl border border-stone-200">
            No material deposited yet — use the form below to deposit gold
          </div>
          <p className="display-md mb-4">{goldFloat.balance.toFixed(3)}g <span className="text-secondary text-lg font-normal">24kt fine gold</span></p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            {GOLD_KARATS.map(k => (
              <div key={k.value} className="bg-surface-lowest px-4 py-3">
                <p className="label-md text-outline-variant">{k.label}</p>
                <p className="text-lg font-semibold text-primary mt-1">
                  {fromFineGold24k(goldFloat.balance, k.value).toFixed(3)}g
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary mt-3">
            Of {goldFloat.total_deposited?.toFixed(3)}g total deposited (24kt) · {((goldFloat.total_withdrawn || 0) + (goldFloat.total_consumed || 0)).toFixed(3)}g consumed/withdrawn
          </p>
        </div>
      )}

      {/* Non-gold balances */}
      {floats.filter(f => f.material_type !== 'gold_24k').length > 0 && (
        <div className="grid grid-cols-2 gap-1 mb-8">
          {floats.filter(f => f.material_type !== 'gold_24k').map(f => {
            const info = MATERIAL_TYPES.find(m => m.value === f.material_type)
            return (
              <div key={f.id} className="bg-surface-low px-5 py-4">
                <p className="label-md">{info?.label || f.material_type.replace(/_/g, ' ')}</p>
                <p className="display-sm mt-2">{f.balance?.toFixed(3)}{info?.unit === 'carats' ? 'ct' : 'g'}</p>
                <p className="text-xs text-secondary mt-1">of {f.total_deposited}{info?.unit === 'carats' ? 'ct' : 'g'} deposited</p>
              </div>
            )
          })}
        </div>
      )}

      {floats.length === 0 && !loading && (
        <div className="bg-surface-low p-8 text-center mb-8">
          <Scale className="w-10 h-10 text-outline-variant mx-auto mb-4" />
          <p className="text-secondary text-sm">No material deposited yet — use the form below to deposit gold</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
        <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1">
          {[
            { key: 'deposit',     label: 'Deposit',     color: 'text-green-700' },
            { key: 'consumption', label: 'Consumption', color: 'text-red-700' },
            { key: 'return',      label: 'Return',      color: 'text-orange-700' },
            { key: 'adjust',      label: 'Adjust',      color: 'text-blue-700' },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key as Tab); setPendingNegative(false); setTxError(null); setTxOk(null) }}
              className={`flex-1 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === t.key ? `bg-white shadow-sm ${t.color}` : 'text-stone-500 hover:text-stone-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'deposit' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3 text-sm">
            <p className="text-blue-900 font-medium">Deposits now go through Central Stock</p>
            <p className="text-blue-700 text-xs mt-1">
              To keep one source of truth for inventory, all material handed to a karigar
              must be issued from the Central Stock ledger. The karigar's float will update
              automatically the moment you issue.
            </p>
            <Link
              href={`/stock/issue?partner_id=${partnerId}&material_type=${encodeURIComponent(form.material_type)}${form.quantity ? `&amount=${encodeURIComponent(form.quantity)}` : ''}`}
              className="inline-flex items-center gap-1.5 mt-3 bg-[#1E3A5F] text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#162B47]"
            >
              Issue from Central Stock →
            </Link>
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${activeTab === 'deposit' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className={lbl}>Material type</label>
            <select className={inp} value={form.material_type} onChange={e => { set('material_type', e.target.value); setPendingNegative(false) }}>
              {MATERIAL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>
              Quantity ({MATERIAL_TYPES.find(m => m.value === form.material_type)?.unit})
            </label>
            <input type="number" inputMode="decimal" step="0.0001" className={inp}
              value={form.quantity} onChange={e => { set('quantity', e.target.value); setPendingNegative(false) }}
              placeholder={activeTab === 'deposit' ? 'e.g. 10' : activeTab === 'adjust' ? 'e.g. -0.2 to reduce, 0.5 to add' : 'Quantity'} />
          </div>
          {activeTab === 'deposit' && (
            <div>
              <label className={lbl}>Rate per gram (₹) — optional</label>
              <input type="number" inputMode="decimal" className={inp} value={form.rate_per_unit} onChange={e => set('rate_per_unit', e.target.value)} placeholder="Gold rate today" />
            </div>
          )}

          <div>
            <label className="label-md block mb-2">
              Quantity ({MATERIAL_TYPES.find(m => m.value === form.material_type)?.unit})
            </label>
            <input type="number" step="0.001"
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              placeholder={activeTab === 'deposit' ? 'e.g. 10' : 'Amount to withdraw'} />
            {isGoldType && inputQty > 0 && inputKarat !== 24 && (
              <p className="text-xs text-secondary mt-2">
                = <strong>{fineGoldQty.toFixed(3)}g in 24kt</strong> fine gold ({inputQty}g × {KARAT_PURITY[inputKarat]})
              </p>
            )}
            {insufficientBalance && (
              <p className="text-xs text-red-500 mt-2 font-medium">
                Insufficient balance. Available: {currentBalance.toFixed(3)}g (24kt)
              </p>
            )}
          </div>
          <div className="col-span-2">
            <label className={lbl}>Notes</label>
            <input className={inp} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Date</label>
            <input type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          {form.order_id && (
            <div>
              <label className={lbl}>Linked order ID</label>
              <input className={`${inp} bg-stone-50`} value={form.order_id} readOnly />
            </div>
          )}
        </div>

        {/* Projected balance preview / warning */}
        {qty > 0 && activeTab !== 'deposit' && (
          <div className={`mt-3 rounded-lg p-3 text-sm border ${willGoNegative ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
            <div className="flex justify-between text-stone-500">
              <span>Current balance</span>
              <span>{currentBal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>After this transaction</span>
              <span className={willGoNegative ? 'text-red-600 font-semibold' : 'text-stone-800 font-medium'}>
                {projectedBal.toFixed(3)}
              </span>
            </div>
          </div>
        )}

        {willGoNegative && pendingNegative && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              This will push the {MATERIAL_TYPES.find(m => m.value === form.material_type)?.label} balance to{' '}
              <strong>{projectedBal.toFixed(3)}</strong>. Click the button again to confirm and save anyway.
            </p>
          </div>
        )}

        {txError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="break-words">{txError}</p>
          </div>
        )}
        {txOk && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
            {txOk}
          </div>
        )}

        <button onClick={handleTransaction} disabled={saving || activeTab === 'deposit'}
          className={`w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            willGoNegative && pendingNegative ? 'bg-red-600 text-white hover:bg-red-700'
            : activeTab === 'deposit' ? 'bg-green-600 text-white hover:bg-green-700'
            : activeTab === 'consumption' ? 'bg-red-500 text-white hover:bg-red-600'
            : activeTab === 'return' ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}>
          {saving ? 'Saving...'
            : willGoNegative && pendingNegative ? 'Confirm and save (negative balance)'
            : activeTab === 'deposit' ? 'Record deposit'
            : activeTab === 'consumption' ? 'Record consumption'
            : activeTab === 'return' ? 'Record return'
            : 'Record adjustment'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-medium text-stone-900 text-sm">Transaction history</h2>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-sm text-secondary text-center">No transactions yet</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-stone-50 flex items-center justify-center shrink-0">
                  {txIcons[t.transaction_type as string]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 capitalize flex items-center gap-2">
                    {t.transaction_type}
                    {t.creates_negative_balance && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase">neg</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-400 truncate">
                    {(normalizeGoldMaterialType(t.material_float?.material_type || '').material_type || '').replace(/_/g, ' ')}
                    {t.orders?.order_number && (
                      <> · <Link href={`/orders/${t.order_id}`} className="text-[#1E3A5F] hover:underline">{t.orders.order_number}</Link></>
                    )}
                    {t.reference && ` · ${t.reference}`}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${txColors[t.transaction_type as string]}`}>
                    {['consumption','return'].includes(t.transaction_type) ? '-' : '+'}{t.quantity}
                  </p>
                  <p className="text-xs text-secondary">{formatDate(t.date)}</p>
                  {t.total_value && <p className="text-xs text-outline-variant">₹{Math.round(t.total_value).toLocaleString('en-IN')}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function MaterialFloatPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <MaterialFloatInner />
    </Suspense>
  )
}
