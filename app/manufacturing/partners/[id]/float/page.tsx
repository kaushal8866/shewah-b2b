'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const MATERIAL_TYPES = [
  { value: 'gold_14k', label: 'Gold 14K', unit: 'grams' },
  { value: 'gold_18k', label: 'Gold 18K', unit: 'grams' },
  { value: 'gold_22k', label: 'Gold 22K', unit: 'grams' },
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'carats' },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'carats' },
]

export default function MaterialFloatPage() {
  const params = useParams()
  const partnerId = params.id as string
  const [partner, setPartner] = useState<any>(null)
  const [floats, setFloats] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'adjust'>('deposit')

  const [form, setForm] = useState({
    material_type: 'gold_18k',
    quantity: '',
    rate_per_unit: '',
    reference: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { load() }, [partnerId])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: f }, { data: t }] = await Promise.all([
      supabase.from('manufacturing_partners').select('*').eq('id', partnerId).single(),
      supabase.from('material_float').select('*').eq('manufacturing_partner_id', partnerId),
      supabase.from('material_transactions')
        .select('*, material_float(material_type)')
        .eq('manufacturing_partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    setPartner(p)
    setFloats(f || [])
    setTransactions(t || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleTransaction() {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) { alert('Enter a valid quantity'); return }

    setSaving(true)

    // Find or create float record for this material type
    let floatRecord = floats.find(f => f.material_type === form.material_type)
    if (!floatRecord) {
      const materialInfo = MATERIAL_TYPES.find(m => m.value === form.material_type)
      const { data } = await supabase.from('material_float').insert([{
        manufacturing_partner_id: partnerId,
        material_type: form.material_type,
        unit: materialInfo?.unit || 'grams',
        total_deposited: 0,
        total_consumed: 0,
        total_withdrawn: 0,
      }]).select().single()
      floatRecord = data
    }

    const txType = activeTab === 'deposit' ? 'deposit' : activeTab === 'withdraw' ? 'withdrawal' : 'adjustment'

    await supabase.from('material_transactions').insert([{
      float_id: floatRecord.id,
      manufacturing_partner_id: partnerId,
      transaction_type: txType,
      quantity: qty,
      unit: floatRecord.unit,
      rate_per_unit: parseFloat(form.rate_per_unit) || null,
      total_value: form.rate_per_unit ? qty * parseFloat(form.rate_per_unit) : null,
      reference: form.reference || null,
      notes: form.notes || null,
      date: form.date,
    }])

    setSaving(false)
    setForm(prev => ({ ...prev, quantity: '', reference: '', notes: '' }))
    load()
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  const txColors = {
    deposit: 'text-green-600',
    consumption: 'text-red-500',
    withdrawal: 'text-orange-500',
    adjustment: 'text-blue-500',
  }
  const txIcons = {
    deposit: <ArrowDown className="w-3.5 h-3.5 text-green-500" />,
    consumption: <RefreshCw className="w-3.5 h-3.5 text-red-400" />,
    withdrawal: <ArrowUp className="w-3.5 h-3.5 text-orange-400" />,
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

      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {floats.map(f => {
          const info = MATERIAL_TYPES.find(m => m.value === f.material_type)
          const pct = f.total_deposited > 0 ? (f.balance / f.total_deposited) * 100 : 0
          return (
            <div key={f.id} className={`bg-white rounded-xl border p-4 ${f.balance < 1 ? 'border-amber-300' : 'border-stone-200'}`}>
              <p className="text-xs text-stone-400 mb-1">{info?.label || f.material_type}</p>
              <p className={`text-2xl font-semibold ${f.balance < 1 ? 'text-amber-600' : 'text-stone-900'}`}>
                {f.balance?.toFixed(3)}{info?.unit === 'carats' ? 'ct' : 'g'}
              </p>
              <div className="h-1.5 bg-stone-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${f.balance < 1 ? 'bg-amber-400' : 'bg-[#C49C64]'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-xs text-stone-400 mt-1">of {f.total_deposited}{info?.unit === 'carats' ? 'ct' : 'g'} deposited</p>
            </div>
          )
        })}
        {floats.length === 0 && !loading && (
          <div className="col-span-3 text-center py-6 text-stone-400 text-sm">
            No material deposited yet — use the form below to deposit gold
          </div>
        )}
      </div>

      {/* Transaction form */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
        <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1">
          {[
            { key: 'deposit', label: 'Deposit', color: 'text-green-700' },
            { key: 'withdraw', label: 'Withdraw', color: 'text-orange-700' },
            { key: 'adjust', label: 'Adjust', color: 'text-blue-700' },
          ].map(t => (
            <button key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? `bg-white shadow-sm ${t.color}` : 'text-stone-500 hover:text-stone-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Material type</label>
            <select className={inp} value={form.material_type} onChange={e => set('material_type', e.target.value)}>
              {MATERIAL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>
              Quantity ({MATERIAL_TYPES.find(m => m.value === form.material_type)?.unit})
            </label>
            <input type="number" step="0.001" className={inp}
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              placeholder={activeTab === 'deposit' ? 'e.g. 10' : 'Amount to withdraw'} />
          </div>
          {activeTab === 'deposit' && (
            <div>
              <label className={lbl}>Rate per gram (₹) — optional</label>
              <input type="number" className={inp} value={form.rate_per_unit} onChange={e => set('rate_per_unit', e.target.value)} placeholder="Gold rate today" />
            </div>
          )}
          <div>
            <label className={lbl}>Reference / voucher no.</label>
            <input className={inp} value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Optional receipt no." />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Notes</label>
            <input className={inp} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder={activeTab === 'deposit' ? 'e.g. Initial deposit for April orders' : 'Reason for withdrawal'} />
          </div>
          <div>
            <label className={lbl}>Date</label>
            <input type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>

        <button onClick={handleTransaction} disabled={saving}
          className={`w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            activeTab === 'deposit' ? 'bg-green-600 text-white hover:bg-green-700'
            : activeTab === 'withdraw' ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}>
          {saving ? 'Saving...'
            : activeTab === 'deposit' ? 'Record deposit'
            : activeTab === 'withdraw' ? 'Record withdrawal'
            : 'Record adjustment'}
        </button>
      </div>

      {/* Transaction history */}
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
                  {txIcons[t.transaction_type as keyof typeof txIcons]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 capitalize">{t.transaction_type}</p>
                  <p className="text-xs text-stone-400 truncate">
                    {t.material_float?.material_type?.replace(/_/g, ' ')}
                    {t.reference && ` · ${t.reference}`}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${txColors[t.transaction_type as keyof typeof txColors]}`}>
                    {['consumption','withdrawal'].includes(t.transaction_type) ? '-' : '+'}{t.quantity}g
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
