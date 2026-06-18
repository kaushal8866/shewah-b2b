'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase, toFineGold24k, fromFineGold24k, KARAT_PURITY } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, ArrowDown, ArrowUp, RefreshCw, Scale } from 'lucide-react'
import Link from 'next/link'

const GOLD_KARATS = [
  { value: 14, label: '14K', purity: 0.585 },
  { value: 18, label: '18K', purity: 0.750 },
  { value: 22, label: '22K', purity: 0.916 },
  { value: 24, label: '24K', purity: 1.000 },
]

const MATERIAL_TYPES = [
  { value: 'gold_24k', label: 'Gold (tracked in 24kt)', unit: 'grams', isGold: true },
  { value: 'diamond_lgd', label: 'Lab Diamond', unit: 'carats', isGold: false },
  { value: 'diamond_natural', label: 'Natural Diamond', unit: 'carats', isGold: false },
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
    material_type: 'gold_24k',
    quantity: '',
    input_karat: '24',   // karat of the gold being deposited/withdrawn
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
        .limit(50),
    ])
    setPartner(p)
    setFloats(f || [])
    setTransactions(t || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  const isGoldType = form.material_type === 'gold_24k'
  const inputQty = parseFloat(form.quantity) || 0
  const inputKarat = parseInt(form.input_karat) || 24
  // Convert to 24kt if gold
  const fineGoldQty = isGoldType ? toFineGold24k(inputQty, inputKarat) : inputQty

  // Check balance for withdrawals
  const currentFloat = floats.find(f => f.material_type === form.material_type)
  const currentBalance = currentFloat?.balance || 0
  const insufficientBalance = activeTab === 'withdraw' && fineGoldQty > currentBalance

  async function handleTransaction() {
    if (!inputQty || inputQty <= 0) { alert('Enter a valid quantity'); return }
    if (insufficientBalance) {
      alert(`Insufficient balance. Available: ${currentBalance.toFixed(3)}g (24kt). Requested: ${fineGoldQty.toFixed(3)}g (24kt)`)
      return
    }

    setSaving(true)

    // Find or create float record
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
        balance: 0,
      }]).select().single()
      floatRecord = data
    }

    if (!floatRecord) { alert('Error creating float record'); setSaving(false); return }

    const txType = activeTab === 'deposit' ? 'deposit' : activeTab === 'withdraw' ? 'withdrawal' : 'adjustment'
    const storedQty = fineGoldQty  // Always store in 24kt for gold

    // Insert transaction
    await supabase.from('material_transactions').insert([{
      float_id: floatRecord.id,
      manufacturing_partner_id: partnerId,
      transaction_type: txType,
      quantity: storedQty,
      unit: floatRecord.unit,
      rate_per_unit: parseFloat(form.rate_per_unit) || null,
      total_value: form.rate_per_unit ? storedQty * parseFloat(form.rate_per_unit) : null,
      reference: form.reference || null,
      notes: isGoldType && inputKarat !== 24
        ? `${inputQty}g @ ${inputKarat}K → ${storedQty.toFixed(3)}g 24kt${form.notes ? '. ' + form.notes : ''}`
        : form.notes || null,
      date: form.date,
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
    setForm(prev => ({ ...prev, quantity: '', reference: '', notes: '' }))
    load()
  }

  const goldFloat = floats.find(f => f.material_type === 'gold_24k')

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

      {/* Gold Balance — 24kt with karat equivalents */}
      {goldFloat && goldFloat.balance > 0 && (
        <div className="bg-surface-low p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4 text-secondary" />
            <span className="label-md">Gold balance with partner</span>
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

      {/* Transaction form */}
      <div className="bg-surface-low p-6 mb-8">
        <div className="flex gap-0 mb-6 bg-surface-lowest">
          {[
            { key: 'deposit', label: 'Deposit' },
            { key: 'withdraw', label: 'Withdraw' },
            { key: 'adjust', label: 'Adjust' },
          ].map(t => (
            <button key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-primary text-surface-lowest'
                  : 'text-secondary hover:bg-surface-highest'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-md block mb-2">Material type</label>
            <select value={form.material_type} onChange={e => set('material_type', e.target.value)}>
              {MATERIAL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {isGoldType && (
            <div>
              <label className="label-md block mb-2">Gold karat being {activeTab === 'deposit' ? 'deposited' : 'withdrawn'}</label>
              <select value={form.input_karat} onChange={e => set('input_karat', e.target.value)}>
                {GOLD_KARATS.map(k => <option key={k.value} value={k.value}>{k.label} ({(k.purity * 100).toFixed(1)}% pure)</option>)}
              </select>
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

          {activeTab === 'deposit' && (
            <div>
              <label className="label-md block mb-2">Rate per gram (₹) — optional</label>
              <input type="number" value={form.rate_per_unit}
                onChange={e => set('rate_per_unit', e.target.value)} placeholder="Gold rate today" />
            </div>
          )}

          <div>
            <label className="label-md block mb-2">Reference / voucher no.</label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)}
              placeholder="Optional receipt no." />
          </div>

          <div>
            <label className="label-md block mb-2">Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="label-md block mb-2">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder={activeTab === 'deposit' ? 'e.g. Initial deposit for April orders' : 'Reason for withdrawal'} />
          </div>
        </div>

        <button onClick={handleTransaction} disabled={saving || insufficientBalance}
          className="w-full mt-6 bg-primary text-surface-lowest py-4 text-sm font-medium hover:bg-surface-highest hover:text-primary disabled:opacity-40 transition-colors">
          {saving ? 'Saving...'
            : activeTab === 'deposit' ? 'Record deposit'
            : activeTab === 'withdraw' ? 'Record withdrawal'
            : 'Record adjustment'}
        </button>
      </div>

      {/* Transaction history */}
      <div className="bg-surface-lowest ghost-border overflow-hidden">
        <div className="px-6 py-4 border-b ghost-border bg-surface-low">
          <h2 className="headline-md">Transaction history</h2>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-sm text-secondary text-center">No transactions yet</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-low transition-colors">
                <div className="w-8 h-8 bg-surface-low flex items-center justify-center shrink-0">
                  {t.transaction_type === 'deposit' && <ArrowDown className="w-4 h-4 text-green-600" />}
                  {t.transaction_type === 'consumption' && <RefreshCw className="w-4 h-4 text-red-500" />}
                  {t.transaction_type === 'withdrawal' && <ArrowUp className="w-4 h-4 text-orange-500" />}
                  {t.transaction_type === 'adjustment' && <Plus className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary capitalize">{t.transaction_type}</p>
                  <p className="text-xs text-secondary truncate">
                    {t.material_float?.material_type?.replace(/_/g, ' ')}
                    {t.reference && ` · ${t.reference}`}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    ['consumption', 'withdrawal'].includes(t.transaction_type) ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {['consumption', 'withdrawal'].includes(t.transaction_type) ? '-' : '+'}{t.quantity?.toFixed(3)}g
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
