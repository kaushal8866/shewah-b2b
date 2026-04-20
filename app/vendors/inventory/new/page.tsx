'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewInventoryItemPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState({
    name: '',
    category: 'diamonds',
    vendor_id: '',
    quantity_in_stock: '0',
    unit: 'carats',
    avg_purchase_price: '',
    low_stock_alert: '10',
    diamond_material_type: 'diamond_lgd',
    diamond_shape_id: null as string | null,
    diamond_size_id: null as string | null,
    diamond_shape_name: '',
    diamond_size_label: '',
    pieces: '',
    diamond_quality: '',
    diamond_color: '',
    sku: '',
    notes: '',
  })

  useEffect(() => {
    supabase.from('vendors').select('id, name').order('name').then(({ data }) => setVendors(data || []))
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.name) { alert('Item name is required'); return }
    const qty = parseFloat(form.quantity_in_stock) || 0
    const isDiamonds = form.category === 'diamonds'

    if (isDiamonds && qty > 0) {
      if (!form.diamond_shape_id || !form.diamond_size_id) {
        alert('Please select a catalog shape and size for diamond stock entries')
        return
      }
      const pcs = parseInt(form.pieces)
      if (!pcs || pcs <= 0) {
        alert('Please enter a whole-number pieces count for diamond stock entries')
        return
      }
    }

    setSaving(true)

    const inventoryPayload = {
      name: form.name,
      category: form.category,
      vendor_id: form.vendor_id || null,
      quantity_in_stock: qty,
      unit: form.unit,
      avg_purchase_price: parseFloat(form.avg_purchase_price) || null,
      low_stock_alert: parseFloat(form.low_stock_alert) || null,
      diamond_shape: form.diamond_shape_name || null,
      diamond_quality: form.diamond_quality || null,
      diamond_color: form.diamond_color || null,
      sku: form.sku || null,
      notes: form.notes || null,
    }
    const { error: invErr } = await supabase.from('inventory').insert([inventoryPayload])
    if (invErr) { setSaving(false); alert('Error: ' + invErr.message); return }

    if (isDiamonds && qty > 0 && form.vendor_id) {
      const res = await fetch('/api/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'vendor',
          material_type: form.diamond_material_type,
          quantity: qty,
          pieces: parseInt(form.pieces),
          vendor_id: form.vendor_id,
          diamond_shape_id: form.diamond_shape_id,
          diamond_size_id: form.diamond_size_id,
          reference: form.sku || null,
          notes: form.notes || `Vendor purchase: ${form.name}`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSaving(false)
        alert('Item saved but stock update failed: ' + (err.error || res.statusText))
        router.push('/vendors')
        return
      }
    }

    setSaving(false)
    router.push('/vendors')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"
  const isDiamonds = form.category === 'diamonds'

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/vendors" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Add inventory item</h1>
          <p className="text-stone-500 text-sm">Stock a new item from a vendor</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Item details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Item name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Round Brilliant 0.5ct SI1 G" />
            </div>
            <div>
              <label className={lbl}>Category</label>
              <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="diamonds">Diamonds</option>
                <option value="gemstones">Gemstones</option>
                <option value="findings">Findings</option>
                <option value="gold">Gold / Metal</option>
                <option value="packaging">Packaging</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>SKU / code</label>
              <input className={inp} value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Optional internal code" />
            </div>
            <div>
              <label className={lbl}>Vendor / supplier</label>
              <select className={inp} value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                <option value="">No specific vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {isDiamonds && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-1">Diamond specifications</h2>
            <p className="text-xs text-stone-400 mb-4">Shape &amp; size are required to update central diamond stock.</p>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Type</label>
                <select className={inp} value={form.diamond_material_type} onChange={e => set('diamond_material_type', e.target.value)}>
                  <option value="diamond_lgd">Lab Grown (LGD)</option>
                  <option value="diamond_natural">Natural</option>
                </select>
              </div>
              <DiamondCatalogPicker
                shapeId={form.diamond_shape_id}
                sizeId={form.diamond_size_id}
                lblClass={lbl}
                inpClass={inp}
                onChange={({ shape_id, size_id, shape_name, size_label, approx_carats }) => {
                  setForm(prev => ({
                    ...prev,
                    diamond_shape_id: shape_id,
                    diamond_size_id: size_id,
                    diamond_shape_name: shape_name,
                    diamond_size_label: size_label,
                    quantity_in_stock: approx_carats && prev.pieces
                      ? String(Number(prev.pieces) * approx_carats)
                      : prev.quantity_in_stock,
                  }))
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Quality / Clarity</label>
                  <select className={inp} value={form.diamond_quality} onChange={e => set('diamond_quality', e.target.value)}>
                    <option value="">Any</option>
                    {['FL','IF','VVS1','VVS2','VS1','VS2','SI1','SI2','I1','I2'].map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Color grade</label>
                  <select className={inp} value={form.diamond_color} onChange={e => set('diamond_color', e.target.value)}>
                    <option value="">Any</option>
                    {['D','E','F','G','H','I','J','K','L','M'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Stock &amp; pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isDiamonds && (
              <div>
                <label className={lbl}>Pieces (no. of stones) *</label>
                <input type="number" inputMode="numeric" step="1" className={inp}
                  value={form.pieces} onChange={e => set('pieces', e.target.value)}
                  placeholder="e.g. 20" />
              </div>
            )}
            <div>
              <label className={lbl}>{isDiamonds ? 'Total carats' : 'Quantity in stock'}</label>
              <input type="number" inputMode="decimal" step="0.001" className={inp}
                value={form.quantity_in_stock} onChange={e => set('quantity_in_stock', e.target.value)} />
            </div>
            {!isDiamonds && (
              <div>
                <label className={lbl}>Unit</label>
                <select className={inp} value={form.unit} onChange={e => set('unit', e.target.value)}>
                  <option value="carats">Carats</option>
                  <option value="grams">Grams</option>
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kilograms</option>
                </select>
              </div>
            )}
            <div>
              <label className={lbl}>Avg purchase price (₹/{isDiamonds ? 'ct' : form.unit === 'grams' ? 'g' : 'unit'})</label>
              <input type="number" inputMode="decimal" className={inp} value={form.avg_purchase_price} onChange={e => set('avg_purchase_price', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Low stock alert threshold</label>
              <input type="number" inputMode="decimal" step="0.001" className={inp} value={form.low_stock_alert} onChange={e => set('low_stock_alert', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any additional details about this item..." />
            </div>
          </div>
        </div>

        {isDiamonds && form.vendor_id && parseFloat(form.quantity_in_stock) > 0 && form.diamond_shape_id && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            This purchase will also be recorded in central diamond stock so shortage alerts stay accurate.
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/vendors" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  )
}
