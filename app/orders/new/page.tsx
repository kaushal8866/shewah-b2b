'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewOrderPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [partners, setPartners] = useState<{ id: string; store_name: string; city: string }[]>([])
  const [products, setProducts] = useState<{ id: string; code: string; name: string; trade_price: number; delivery_days: number }[]>([])
  const [goldRate, setGoldRate] = useState(0)

  const [form, setForm] = useState({
    partner_id: '', product_id: '', type: 'catalog',
    model: 'wholesale', quantity: '1', ring_size: '',
    special_notes: '', brief_text: '',
    trade_price: '', total_amount: '', advance_paid: '0',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    internal_notes: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('partners').select('id, store_name, city').order('store_name'),
      supabase.from('products').select('id, code, name, trade_price, delivery_days').eq('is_active', true).order('code'),
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
    ]).then(([{ data: p }, { data: pr }, { data: g }]) => {
      setPartners(p || [])
      setProducts(pr || [])
      if (g?.[0]) setGoldRate(g[0].rate_24k)
    })
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  function onProductSelect(productId: string) {
    const product = products.find(p => p.id === productId)
    if (product) {
      const days = product.delivery_days || 14
      const delivery = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
      setForm(prev => ({
        ...prev,
        product_id: productId,
        trade_price: String(product.trade_price || ''),
        total_amount: String(product.trade_price || ''),
        expected_delivery: delivery,
      }))
    } else {
      set('product_id', productId)
    }
  }

  async function handleSave() {
    if (!form.partner_id) { alert('Select a partner'); return }
    if (!form.trade_price || !form.total_amount) { alert('Enter pricing'); return }

    setSaving(true)
    
    // 1. Fetch Partner for Credit Evaluation
    const { data: partner } = await supabase.from('partners').select('*').eq('id', form.partner_id).single()
    if (!partner) { alert('Partner not found'); setSaving(false); return }

    // 2. Evaluate Risk
    const totalAmountPaise = parseFloat(form.total_amount) * 100
    const { evaluateCreditRisk } = await import('@/lib/ethics')
    const risk = evaluateCreditRisk(partner, totalAmountPaise)

    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
    const orderNumber = `SH-ORD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const payload = {
      order_number: orderNumber,
      partner_id: form.partner_id,
      product_id: form.product_id || null,
      type: form.type,
      model: form.model,
      quantity: parseInt(form.quantity) || 1,
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      brief_text: form.type === 'custom' ? form.brief_text : null,
      gold_rate_at_order: goldRate,
      trade_price: parseFloat(form.trade_price) * 100, // stored in paise
      total_amount: totalAmountPaise, // stored in paise
      advance_paid: (parseFloat(form.advance_paid) || 0) * 100, // stored in paise
      balance_due: (parseFloat(form.total_amount) - (parseFloat(form.advance_paid) || 0)) * 100, // stored in paise
      order_date: form.order_date,
      expected_delivery: form.expected_delivery,
      internal_notes: form.internal_notes || null,
      status: 'brief_received',
      gov_status: risk.requiresApproval ? 'pending_approval' : 'auto_approved',
      gov_notes: risk.reason || null,
    }

    const { data, error } = await supabase.from('orders').insert([payload]).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    
    if (risk.requiresApproval) {
      alert(`⚠️ Order flagged for approval: ${risk.reason}`)
    }
    router.push('/orders')
  }


  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  const balanceDue = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/orders" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">New order</h1>
          <p className="text-stone-500 text-sm">Create order for a partner</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Order basics */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={label}>Partner *</label>
              <select className={input} value={form.partner_id} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.store_name} — {p.city}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Order type</label>
              <select className={input} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="catalog">Catalog order</option>
                <option value="custom">Custom design</option>
              </select>
            </div>
            <div>
              <label className={label}>Model</label>
              <select className={input} value={form.model} onChange={e => set('model', e.target.value)}>
                <option value="wholesale">Wholesale</option>
                <option value="design_make">Design + Make</option>
                <option value="white_label">White Label</option>
              </select>
            </div>
            {form.type === 'catalog' && (
              <div className="col-span-2">
                <label className={label}>Product</label>
                <select className={input} value={form.product_id} onChange={e => onProductSelect(e.target.value)}>
                  <option value="">Select product (optional)...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} (₹{p.trade_price?.toLocaleString('en-IN')})</option>)}
                </select>
              </div>
            )}
            {form.type === 'custom' && (
              <div className="col-span-2">
                <label className={label}>Design brief</label>
                <textarea className={`${input} resize-none`} rows={3}
                  value={form.brief_text} onChange={e => set('brief_text', e.target.value)}
                  placeholder="Describe the customer's design requirement..." />
              </div>
            )}
            <div>
              <label className={label}>Quantity</label>
              <input type="number" min="1" className={input} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div>
              <label className={label}>Ring size</label>
              <input className={input} value={form.ring_size} onChange={e => set('ring_size', e.target.value)} placeholder="e.g. 16, 17, 18" />
            </div>
            <div className="col-span-2">
              <label className={label}>Special notes</label>
              <input className={input} value={form.special_notes} onChange={e => set('special_notes', e.target.value)}
                placeholder="Any specific instructions..." />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Pricing & payment</h2>
          {goldRate > 0 && (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Gold rate locked at: ₹{goldRate.toLocaleString('en-IN')}/g (24K)
            </p>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={label}>Trade price (₹) *</label>
              <input type="number" className={input} value={form.trade_price} onChange={e => set('trade_price', e.target.value)} />
            </div>
            <div>
              <label className={label}>Total amount (₹) *</label>
              <input type="number" className={input} value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
            </div>
            <div>
              <label className={label}>Advance paid (₹)</label>
              <input type="number" className={input} value={form.advance_paid} onChange={e => set('advance_paid', e.target.value)} />
            </div>
          </div>
          {form.total_amount && (
            <div className={`mt-3 p-3 rounded-lg text-sm flex justify-between items-center ${balanceDue > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <span className={balanceDue > 0 ? 'text-amber-700' : 'text-green-700'}>Balance due at delivery</span>
              <span className={`font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                ₹{balanceDue.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Order date</label>
              <input type="date" className={input} value={form.order_date} onChange={e => set('order_date', e.target.value)} />
            </div>
            <div>
              <label className={label}>Expected delivery</label>
              <input type="date" className={input} value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>Internal notes</label>
              <input className={input} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)}
                placeholder="Production notes, special instructions for workshop..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/orders" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Creating...' : 'Create order'}
          </button>
        </div>
      </div>
    </div>
  )
}
