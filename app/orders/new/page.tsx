'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, computeOrderCogs } from '@/lib/supabase'
import { ArrowLeft, Save, Heart } from 'lucide-react'
import Link from 'next/link'

function NewOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prePartner = searchParams.get('partner_id') || ''
  const preProduct = searchParams.get('product_id') || ''

  const [saving, setSaving] = useState(false)
  const [partners, setPartners] = useState<{ id: string; store_name: string; city: string }[]>([])
  const [products, setProducts] = useState<{ id: string; code: string; name: string; trade_price: number; delivery_days: number; gold_karat?: number; gold_weight_g?: number; making_charges?: number }[]>([])
  const [mfgPartners, setMfgPartners] = useState<{ id: string; name: string; city: string }[]>([])
  const [goldRate, setGoldRate] = useState(0)
  const [fromInterest, setFromInterest] = useState(false)

  const [form, setForm] = useState({
    partner_id: prePartner,
    product_id: preProduct,
    type: 'catalog',
    model: 'wholesale', quantity: '1', ring_size: '',
    special_notes: '', brief_text: '',
    trade_price: '', total_amount: '', advance_paid: '0',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    internal_notes: '',
    // COGS / gold
    gold_source: 'self' as 'self' | 'manufacturer',
    gold_karat: '18',
    gold_weight_estimated: '',
    making_charges: '',
    cad_cost: '0',
    stone_cost: '0',
    assigned_manufacturer_id: '',
  })

  useEffect(() => {
    if (prePartner || preProduct) setFromInterest(true)
    Promise.all([
      supabase.from('partners').select('id, store_name, city').order('store_name'),
      supabase.from('products').select('id, code, name, trade_price, delivery_days, gold_karat, gold_weight_g, making_charges').eq('is_active', true).order('code'),
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
      supabase.from('manufacturing_partners').select('id, name, city').eq('status', 'active').order('name'),
    ]).then(([{ data: p }, { data: pr }, { data: g }, { data: mp }]) => {
      setPartners(p || [])
      const prods = pr || []
      setProducts(prods)
      setMfgPartners(mp || [])
      if (g?.[0]) setGoldRate(g[0].rate_24k)
      if (preProduct) {
        const product = prods.find(x => x.id === preProduct)
        if (product) {
          const days = product.delivery_days || 14
          setForm(prev => ({
            ...prev,
            trade_price: String(product.trade_price || ''),
            total_amount: String(product.trade_price || ''),
            expected_delivery: new Date(Date.now() + days * 86400000).toISOString().split('T')[0],
            gold_karat: product.gold_karat ? String(product.gold_karat) : prev.gold_karat,
            gold_weight_estimated: product.gold_weight_g ? String(product.gold_weight_g) : prev.gold_weight_estimated,
            making_charges: product.making_charges ? String(product.making_charges) : prev.making_charges,
          }))
        }
      }
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
        gold_karat: product.gold_karat ? String(product.gold_karat) : prev.gold_karat,
        gold_weight_estimated: product.gold_weight_g ? String(product.gold_weight_g) : prev.gold_weight_estimated,
        making_charges: product.making_charges ? String(product.making_charges) : prev.making_charges,
      }))
    } else {
      set('product_id', productId)
    }
  }

  // Estimated COGS preview
  const estCogs = computeOrderCogs({
    gold_weight_actual: parseFloat(form.gold_weight_estimated) || 0,
    gold_rate_at_order: goldRate,
    gold_karat: parseInt(form.gold_karat),
    making_charges: parseFloat(form.making_charges) || 0,
    cad_cost: parseFloat(form.cad_cost) || 0,
    stone_cost: parseFloat(form.stone_cost) || 0,
    total_amount: parseFloat(form.total_amount) || 0,
  })

  async function handleSave() {
    if (!form.partner_id) { alert('Select a partner'); return }
    if (!form.trade_price || !form.total_amount) { alert('Enter pricing'); return }

    setSaving(true)
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
    const orderNumber = `SH-ORD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const payload: any = {
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
      trade_price: parseFloat(form.trade_price),
      total_amount: parseFloat(form.total_amount),
      advance_paid: parseFloat(form.advance_paid) || 0,
      balance_due: parseFloat(form.total_amount) - (parseFloat(form.advance_paid) || 0),
      order_date: form.order_date,
      expected_delivery: form.expected_delivery,
      internal_notes: form.internal_notes || null,
      status: 'brief_received',
      // COGS / gold
      gold_source: form.gold_source,
      gold_weight_estimated: parseFloat(form.gold_weight_estimated) || null,
      making_charges: parseFloat(form.making_charges) || null,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      assigned_manufacturer_id: form.assigned_manufacturer_id || null,
    }

    const { error } = await supabase.from('orders').insert([payload]).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/orders')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"
  const balanceDue = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/orders" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">New order</h1>
          <p className="text-stone-500 text-sm">Create order for a partner</p>
        </div>
      </div>

      {fromInterest && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <Heart className="w-4 h-4 text-amber-600 shrink-0" />
          Partner and product pre-filled from their design interest.
        </div>
      )}

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
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
              <div className="col-span-1 sm:col-span-2">
                <label className={label}>Product</label>
                <select className={input} value={form.product_id} onChange={e => onProductSelect(e.target.value)}>
                  <option value="">Select product (optional)...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} (₹{p.trade_price?.toLocaleString('en-IN')})</option>)}
                </select>
              </div>
            )}
            {form.type === 'custom' && (
              <div className="col-span-1 sm:col-span-2">
                <label className={label}>Design brief</label>
                <textarea className={`${input} resize-none`} rows={3}
                  value={form.brief_text} onChange={e => set('brief_text', e.target.value)}
                  placeholder="Describe the customer's design requirement..." />
              </div>
            )}
            <div>
              <label className={label}>Quantity</label>
              <input type="number" inputMode="decimal" min="1" className={input} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div>
              <label className={label}>Ring size</label>
              <input className={input} value={form.ring_size} onChange={e => set('ring_size', e.target.value)} placeholder="e.g. 16, 17, 18" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Special notes</label>
              <input className={input} value={form.special_notes} onChange={e => set('special_notes', e.target.value)}
                placeholder="Any specific instructions..." />
            </div>
          </div>
        </div>

        {/* Costing & gold */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Costing &amp; gold source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Gold source</label>
              <select className={input} value={form.gold_source} onChange={e => set('gold_source', e.target.value)}>
                <option value="self">Self (consumed from our float)</option>
                <option value="manufacturer">Manufacturer (karigar supplies)</option>
              </select>
            </div>
            <div>
              <label className={label}>Assigned manufacturer{form.gold_source === 'self' ? ' *' : ''}</label>
              <select className={input} value={form.assigned_manufacturer_id} onChange={e => set('assigned_manufacturer_id', e.target.value)}>
                <option value="">Select manufacturer...</option>
                {mfgPartners.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Gold karat</label>
              <select className={input} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Estimated gold weight (g)</label>
              <input type="number" inputMode="decimal" step="0.01" className={input}
                value={form.gold_weight_estimated} onChange={e => set('gold_weight_estimated', e.target.value)} />
            </div>
            <div>
              <label className={label}>Making charges (₹)</label>
              <input type="number" inputMode="decimal" className={input}
                value={form.making_charges} onChange={e => set('making_charges', e.target.value)} />
            </div>
            <div>
              <label className={label}>CAD cost (₹)</label>
              <input type="number" inputMode="decimal" className={input}
                value={form.cad_cost} onChange={e => set('cad_cost', e.target.value)} />
            </div>
            <div>
              <label className={label}>Stone cost (₹)</label>
              <input type="number" inputMode="decimal" className={input}
                value={form.stone_cost} onChange={e => set('stone_cost', e.target.value)} />
            </div>
          </div>
          {(parseFloat(form.gold_weight_estimated) > 0 || parseFloat(form.making_charges) > 0) && (
            <div className="mt-3 bg-stone-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-stone-500">
                <span>Estimated gold cost</span>
                <span>₹{Math.round(estCogs.gold_cost).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1">
                <span>Estimated COGS</span>
                <span className="text-[#C49C64]">₹{Math.round(estCogs.total_cogs).toLocaleString('en-IN')}</span>
              </div>
              {parseFloat(form.total_amount) > 0 && (
                <div className="flex justify-between font-medium">
                  <span>Estimated margin</span>
                  <span className={estCogs.margin >= 0 ? 'text-green-600' : 'text-red-500'}>
                    ₹{Math.round(estCogs.margin).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Pricing &amp; payment</h2>
          {goldRate > 0 && (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Gold rate locked at: ₹{goldRate.toLocaleString('en-IN')}/g (24K)
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Trade price (₹) *</label>
              <input type="number" inputMode="decimal" className={input} value={form.trade_price} onChange={e => set('trade_price', e.target.value)} />
            </div>
            <div>
              <label className={label}>Total amount (₹) *</label>
              <input type="number" inputMode="decimal" className={input} value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
            </div>
            <div>
              <label className={label}>Advance paid (₹)</label>
              <input type="number" inputMode="decimal" className={input} value={form.advance_paid} onChange={e => set('advance_paid', e.target.value)} />
            </div>
          </div>
          {form.total_amount && (
            <div className={`mt-3 p-3 rounded-lg text-sm flex justify-between items-center ${balanceDue > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <span className={balanceDue > 0 ? 'text-amber-700' : 'text-green-700'}>Balance due at delivery</span>
              <span className={`font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-green-800'}`}>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Order date</label>
              <input type="date" className={input} value={form.order_date} onChange={e => set('order_date', e.target.value)} />
            </div>
            <div>
              <label className={label}>Expected delivery</label>
              <input type="date" className={input} value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)} />
            </div>
            <div className="col-span-1 sm:col-span-2">
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

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <NewOrderForm />
    </Suspense>
  )
}
