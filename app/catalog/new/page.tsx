'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, calculateTradePrice } from '@/lib/supabase'
import { ArrowLeft, Save, Calculator } from 'lucide-react'
import Link from 'next/link'

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [goldRate, setGoldRate] = useState(0)

  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'ring',
    diamond_weight: '', diamond_shape: 'round', diamond_quality: 'VS2',
    diamond_color: 'F', diamond_type: 'lgd', gold_karat: '18',
    gold_weight_g: '', diamond_cost: '', making_charges: '2500',
    igi_cert_cost: '1500', trade_price: '', mrp_suggested: '',
    delivery_days: '14', models_available: ['wholesale', 'design_make'],
  })

  useEffect(() => {
    supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setGoldRate(data[0].rate_24k) })
  }, [])

  function set(key: string, val: string | string[]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function toggleModel(model: string) {
    const current = form.models_available
    if (current.includes(model)) {
      set('models_available', current.filter(m => m !== model))
    } else {
      set('models_available', [...current, model])
    }
  }

  function autoCalculate() {
    if (!goldRate) { alert('No gold rate found. Add a gold rate first.'); return }
    const price = calculateTradePrice(
      parseFloat(form.diamond_cost) || 0,
      parseInt(form.gold_karat),
      parseFloat(form.gold_weight_g) || 0,
      goldRate,
      parseFloat(form.making_charges) || 0,
      parseFloat(form.igi_cert_cost) || 0,
      1.28
    )
    set('trade_price', String(price))
    set('mrp_suggested', String(Math.round(price * 1.40)))
  }

  async function handleSave() {
    if (!form.code || !form.name) {
      alert('Product code and name are required')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      diamond_weight: parseFloat(form.diamond_weight) || null,
      gold_karat: parseInt(form.gold_karat) || null,
      gold_weight_g: parseFloat(form.gold_weight_g) || null,
      diamond_cost: parseFloat(form.diamond_cost) || null,
      making_charges: parseFloat(form.making_charges) || null,
      igi_cert_cost: parseFloat(form.igi_cert_cost) || null,
      trade_price: parseFloat(form.trade_price) || null,
      mrp_suggested: parseFloat(form.mrp_suggested) || null,
      delivery_days: parseInt(form.delivery_days) || 14,
    }
    const { data, error } = await supabase.from('products').insert([payload]).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/catalog')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"
  const models = [
    { id: 'wholesale', label: 'Wholesale catalog' },
    { id: 'design_make', label: 'Design + Make' },
    { id: 'white_label', label: 'White Label OEM' },
  ]

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/catalog" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Add product</h1>
          <p className="text-stone-500 text-sm">New ring design</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Basic information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Product code * (e.g. SH-007)</label>
              <input className={input} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SH-007" />
            </div>
            <div>
              <label className={label}>Product name *</label>
              <input className={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Marquise Illusion" />
            </div>
            <div className="col-span-2">
              <label className={label}>Description</label>
              <textarea className={`${input} resize-none`} rows={2}
                value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description for catalog" />
            </div>
          </div>
        </div>

        {/* Diamond specs */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Diamond specifications</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={label}>Weight (carats)</label>
              <input type="number" step="0.1" className={input} value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5" />
            </div>
            <div>
              <label className={label}>Shape</label>
              <select className={input} value={form.diamond_shape} onChange={e => set('diamond_shape', e.target.value)}>
                {['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Type</label>
              <select className={input} value={form.diamond_type} onChange={e => set('diamond_type', e.target.value)}>
                <option value="lgd">Lab-Grown (LGD)</option>
                <option value="natural">Natural</option>
              </select>
            </div>
            <div>
              <label className={label}>Quality (clarity)</label>
              <select className={input} value={form.diamond_quality} onChange={e => set('diamond_quality', e.target.value)}>
                {['IF','VVS1','VVS2','VS1','VS2','SI1','SI2'].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Color grade</label>
              <select className={input} value={form.diamond_color} onChange={e => set('diamond_color', e.target.value)}>
                {['D','E','F','G','H','I','J'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Diamond cost (₹)</label>
              <input type="number" className={input} value={form.diamond_cost} onChange={e => set('diamond_cost', e.target.value)} placeholder="e.g. 8000" />
            </div>
          </div>
        </div>

        {/* Gold specs */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Gold specifications</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={label}>Gold karat</label>
              <select className={input} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                <option value="14">14K (58.5%)</option>
                <option value="18">18K (75.0%)</option>
                <option value="22">22K (91.6%)</option>
              </select>
            </div>
            <div>
              <label className={label}>Gold weight (grams)</label>
              <input type="number" step="0.1" className={input} value={form.gold_weight_g} onChange={e => set('gold_weight_g', e.target.value)} placeholder="e.g. 3.0" />
            </div>
            <div>
              <label className={label}>Making charges (₹)</label>
              <input type="number" className={input} value={form.making_charges} onChange={e => set('making_charges', e.target.value)} />
            </div>
            <div>
              <label className={label}>IGI cert cost (₹)</label>
              <input type="number" className={input} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-900">Pricing</h2>
            <button onClick={autoCalculate}
              className="flex items-center gap-1.5 text-xs text-[#C49C64] hover:text-[#9B7A40] border border-[#C49C64] px-3 py-1.5 rounded-lg transition-colors">
              <Calculator className="w-3.5 h-3.5" />
              Auto-calculate from gold rate
            </button>
          </div>
          {goldRate === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              No gold rate found. <Link href="/gold-rates" className="underline">Add today's gold rate</Link> for auto-calculation.
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={label}>Trade price (₹) *</label>
              <input type="number" className={input} value={form.trade_price} onChange={e => set('trade_price', e.target.value)} placeholder="Your selling price to jeweler" />
            </div>
            <div>
              <label className={label}>Suggested MRP (₹)</label>
              <input type="number" className={input} value={form.mrp_suggested} onChange={e => set('mrp_suggested', e.target.value)} placeholder="What jeweler charges customer" />
            </div>
            <div>
              <label className={label}>Delivery (days)</label>
              <input type="number" className={input} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} />
            </div>
          </div>

          {form.trade_price && form.mrp_suggested && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex gap-6 text-sm">
              <div>
                <p className="text-xs text-green-600">Jeweler margin</p>
                <p className="font-semibold text-green-800">
                  ₹{(parseFloat(form.mrp_suggested) - parseFloat(form.trade_price)).toLocaleString('en-IN')}
                  {' '}({Math.round((parseFloat(form.mrp_suggested) - parseFloat(form.trade_price)) / parseFloat(form.mrp_suggested) * 100)}%)
                </p>
              </div>
              <div>
                <p className="text-xs text-green-600">Your margin over COGS</p>
                <p className="font-semibold text-green-800">~28% (estimated)</p>
              </div>
            </div>
          )}
        </div>

        {/* Models */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Available for models</h2>
          <div className="flex gap-3">
            {models.map(m => (
              <button key={m.id} onClick={() => toggleModel(m.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.models_available.includes(m.id)
                    ? 'bg-[#C49C64] text-white border-[#C49C64]'
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/catalog" className="px-5 py-2.5 text-sm text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
