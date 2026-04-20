'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, ArrowDown, ArrowUp, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const MATERIAL_TYPES = [
  { value: 'gold_14k', label: 'Gold 14K', unit: 'grams' },
  { value: 'gold_18k', label: 'Gold 18K', unit: 'grams' },
  { value: 'gold_22k', label: 'Gold 22K', unit: 'grams' },
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'carats' },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'carats' },
]

type Tab = 'deposit' | 'return' | 'consumption' | 'adjust'

function MaterialFloatInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const partnerId = params.id as string

  // Pre-fill from order context (e.g. "Record gold consumption for this order")
  const orderIdParam = searchParams.get('order_id') || ''
  // Accept both `type` (full word) and `deposit` (just the material type for
  // the over-issue shortcut from the new-order page).
  const depositShortcut = searchParams.get('deposit')
  const typeParam = depositShortcut
    ? ('deposit' as Tab)
    : ((searchParams.get('type') as Tab) || 'deposit')
  const materialParam = depositShortcut || searchParams.get('material_type') || 'gold_18k'
  const amountParam = searchParams.get('amount') || ''

  const [partner, setPartner] = useState<any>(null)
  const [floats, setFloats] = useState<any[]>([])
  const [buckets, setBuckets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>(['deposit','return','consumption','adjust'].includes(typeParam) ? typeParam : 'deposit')
  const [pendingNegative, setPendingNegative] = useState(false)

  const [form, setForm] = useState({
    material_type: MATERIAL_TYPES.find(m => m.value === materialParam) ? materialParam : 'gold_18k',
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
            // Pre-fill quantity from order's actual or estimated weight
            const w = data.gold_weight_actual || data.gold_weight_estimated
            if (w) setForm(prev => ({ ...prev, quantity: String(w) }))
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
        .limit(30),
    ])
    setPartner(p)
    setFloats(f || [])
    setTransactions(t || [])
    try {
      const r = await fetch(`/api/manufacturing/partners/${partnerId}/buckets`)
      const j = await r.json()
      setBuckets(j.buckets || [])
    } catch { setBuckets([]) }
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

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
    if (activeTab === 'adjust') {
      if (!qty || qty === 0) { alert('Enter a non-zero adjustment (use a minus sign to decrease)'); return }
    } else {
      if (!qty || qty <= 0) { alert('Enter a valid quantity'); return }
    }

    if (willGoNegative && !pendingNegative) {
      setPendingNegative(true)
      return
    }

    setSaving(true)

    let floatRecord = floats.find(f => f.material_type === form.material_type)
    if (!floatRecord) {
      const materialInfo = MATERIAL_TYPES.find(m => m.value === form.material_type)
      const { data } = await supabase.from('material_float').insert([{
        manufacturing_partner_id: partnerId,
        material_type: form.material_type,
        unit: materialInfo?.unit || 'grams',
        total_deposited: 0,
        total_consumed: 0,
      }]).select().single()
      floatRecord = data
    }

    const txType = activeTab // 'deposit' | 'return' | 'consumption' | 'adjustment'
    const transactionType = activeTab === 'adjust' ? 'adjustment' : activeTab

    await supabase.from('material_transactions').insert([{
      float_id: floatRecord.id,
      manufacturing_partner_id: partnerId,
      transaction_type: transactionType,
      quantity: qty,
      unit: floatRecord.unit,
      rate_per_unit: parseFloat(form.rate_per_unit) || null,
      total_value: form.rate_per_unit ? qty * parseFloat(form.rate_per_unit) : null,
      reference: form.reference || null,
      notes: form.notes || null,
      date: form.date,
      order_id: form.order_id || null,
      negative_confirmed: willGoNegative,
    }])

    setSaving(false)
    setPendingNegative(false)
    setForm(prev => ({ ...prev, quantity: '', reference: '', notes: '' }))
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
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/manufacturing/partners/${partnerId}`} className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Material Float</h1>
          <p className="text-stone-500 text-sm">{partner?.name}</p>
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
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
        <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1">
          {[
            { key: 'deposit',     label: 'Deposit',     color: 'text-green-700' },
            { key: 'consumption', label: 'Consumption', color: 'text-red-700' },
            { key: 'return',      label: 'Return',      color: 'text-orange-700' },
            { key: 'adjust',      label: 'Adjust',      color: 'text-blue-700' },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key as Tab); setPendingNegative(false) }}
              className={`flex-1 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === t.key ? `bg-white shadow-sm ${t.color}` : 'text-stone-500 hover:text-stone-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <label className={lbl}>Reference / voucher no.</label>
            <input className={inp} value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Optional receipt no." />
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

        <button onClick={handleTransaction} disabled={saving}
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
        <div className="divide-y divide-stone-50">
          {transactions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-400 text-center">No transactions yet</p>
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
                    {t.material_float?.material_type?.replace(/_/g, ' ')}
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
                  <p className="text-xs text-stone-400">{formatDate(t.date)}</p>
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
