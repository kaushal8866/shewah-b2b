'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, toFineGold24k, fromFineGold24k, KARAT_PURITY } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Save, Upload, X, Printer, Package, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

function NewMfgOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [partners, setPartners] = useState<any[]>([])
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [floats, setFloats] = useState<any[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [labourRates, setLabourRates] = useState<Record<number, number>>({})

  const defaultPartnerId = searchParams.get('partner') || ''

  const [form, setForm] = useState({
    manufacturing_partner_id: defaultPartnerId,
    customer_order_id: '',
    description: '',
    quantity: '1',
    ring_size: '',
    special_notes: '',
    material_from_float: false,
    gold_weight_required: '',
    gold_karat: '18',
    diamond_weight: '',
    material_notes: '',
    labour_per_gram: '',
    gold_weight_actual: '',
    other_charges: '0',
    expected_date: '',
    internal_notes: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('manufacturing_partners').select('*').eq('status', 'active').order('name'),
      supabase.from('orders').select('id, order_number, type, model, quantity, ring_size, special_notes, brief_text, brief_images, product_id, partner_id, partners(store_name), products(name, code, gold_karat, gold_weight_g, diamond_weight)').order('order_date', { ascending: false }).limit(30),
      supabase.from('labour_rates').select('*'),
    ]).then(([{ data: p }, { data: co }, { data: lr }]) => {
      setPartners(p || [])
      setCustomerOrders(co || [])
      const rateMap: Record<number, number> = {}
      lr?.forEach((r: any) => { rateMap[r.karat] = r.rate_per_gram })
      setLabourRates(rateMap)
    })
  }, [])

  useEffect(() => {
    if (form.manufacturing_partner_id) {
      supabase.from('material_float')
        .select('*')
        .eq('manufacturing_partner_id', form.manufacturing_partner_id)
        .then(({ data }) => setFloats(data || []))
    }
  }, [form.manufacturing_partner_id])

  // Prefill form from linked customer order
  function onOrderSelect(orderId: string) {
    const order = customerOrders.find((o: any) => o.id === orderId)
    if (!order) { set('customer_order_id', ''); return }
    setForm(prev => ({
      ...prev,
      customer_order_id: orderId,
      description: order.brief_text || order.products?.name || prev.description,
      quantity: String(order.quantity || 1),
      ring_size: order.ring_size || '',
      special_notes: order.special_notes || '',
      gold_karat: String(order.products?.gold_karat || 18),
      gold_weight_required: String(order.products?.gold_weight_g || ''),
      diamond_weight: String(order.products?.diamond_weight || ''),
    }))
    if (order.brief_images?.length) setUploadedImages(order.brief_images)
  }

  // 24kt fine gold computation for current weight/karat
  const goldWeightReq = parseFloat(form.gold_weight_required || '0')
  const goldKarat = parseInt(form.gold_karat) || 18
  const fineGold24k = toFineGold24k(goldWeightReq, goldKarat)

  // Check float balance (24kt gold) for stock gating
  const goldFloat = floats.find(f => f.material_type === 'gold_24k')
    || floats.find(f => f.material_type === `gold_${form.gold_karat}k`)
  const availableFloat = goldFloat?.balance || 0
  const insufficientFloat = form.material_from_float && fineGold24k > 0 && fineGold24k > availableFloat

  // Auto-fill labour rate when karat changes
  useEffect(() => {
    const rate = labourRates[parseInt(form.gold_karat)]
    if (rate) set('labour_per_gram', String(rate))
  }, [form.gold_karat, labourRates])

  function set(k: string, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      setUploadedImages(prev => [...prev, url])
    } catch (err) {
      alert('Image upload failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setUploading(false)
  }

  // Calculate labour amount
  const goldWeight = parseFloat(form.gold_weight_actual || form.gold_weight_required || '0')
  const effectiveWeight = Math.max(goldWeight, parseFloat('1')) // minimum 1 gram
  const labourAmount = effectiveWeight * parseFloat(form.labour_per_gram || '0')
  const otherCharges = parseFloat(form.other_charges || '0')
  const totalMfgCost = labourAmount + otherCharges

  function handlePrint() {
    window.print()
  }

  async function handleSave() {
    if (!form.manufacturing_partner_id || !form.description) {
      alert('Select a manufacturing partner and add description')
      return
    }
    if (insufficientFloat) {
      alert(`Insufficient material with partner. Need ${fineGold24k.toFixed(3)}g (24kt), available: ${availableFloat.toFixed(3)}g (24kt)`)
      return
    }
    setSaving(true)
    const { count } = await supabase.from('manufacturing_orders').select('*', { count: 'exact', head: true })
    const orderNumber = `SH-MFG-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const payload = {
      order_number: orderNumber,
      manufacturing_partner_id: form.manufacturing_partner_id,
      customer_order_id: form.customer_order_id || null,
      description: form.description,
      quantity: parseInt(form.quantity) || 1,
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      reference_images: uploadedImages,
      material_from_float: form.material_from_float,
      gold_weight_required: parseFloat(form.gold_weight_required) || null,
      gold_karat: parseInt(form.gold_karat),
      diamond_weight: parseFloat(form.diamond_weight) || null,
      material_notes: form.material_notes || null,
      labour_per_gram: parseFloat(form.labour_per_gram) || null,
      gold_weight_actual: parseFloat(form.gold_weight_actual) || null,
      labour_amount: labourAmount || null,
      other_charges: otherCharges,
      total_manufacturing_cost: totalMfgCost || null,
      expected_date: form.expected_date || null,
      internal_notes: form.internal_notes || null,
      status: 'issued',
      issued_date: new Date().toISOString().split('T')[0],
    }

    const { data: mfgOrder, error: mfgError } = await supabase.from('manufacturing_orders').insert([payload]).select().single()
    
    if (mfgError) { 
      setSaving(false)
      alert('Error: ' + mfgError.message)
      return 
    }

    // Material Ledger Transaction (Phase 2 - Existing Schema Alignment)
    if (form.material_from_float && fineGold24k > 0) {
      const goldFloat = floats.find(f => f.material_type === 'gold_24k' || f.material_type === `gold_${form.gold_karat}k`)
      
      if (goldFloat) {
        const { error: txError } = await supabase.from('material_transactions').insert([{
          float_id: goldFloat.id,
          manufacturing_partner_id: form.manufacturing_partner_id,
          transaction_type: 'consumption',
          quantity: -fineGold24k,
          reference: orderNumber,
          notes: `Issued for order ${orderNumber}`,
          date: new Date().toISOString().split('T')[0]
        }])
        
        if (txError) {
          console.error('Ledger sync failed:', txError.message)
          alert('Order issued, but material ledger synchronization failed.')
        }
      }
    }

    setSaving(false)
    router.push('/manufacturing')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"
  const selectedPartner = partners.find(p => p.id === form.manufacturing_partner_id)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Print-only order sheet */}
      <div className="hidden print:block" ref={printRef}>
        <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '700px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #C49C64', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1C1A17' }}>SHEWAH</h1>
              <p style={{ fontSize: '12px', color: '#666' }}>Manufacturing Order</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#666' }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
              <p style={{ fontSize: '12px', fontWeight: 'bold' }}>To: {selectedPartner?.name}</p>
            </div>
          </div>

          <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Order Details</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <tbody>
              {[
                ['Description', form.description],
                ['Quantity', form.quantity],
                ['Ring Size', form.ring_size || '—'],
                ['Gold Karat', `${form.gold_karat}K`],
                ['Gold Weight Required', form.gold_weight_required ? `${form.gold_weight_required}g` : '—'],
                ['Diamond Weight', form.diamond_weight ? `${form.diamond_weight}ct` : '—'],
                ['Material From Float', form.material_from_float ? 'Yes — use from deposited material' : 'No — own material'],
                ['Expected Completion', form.expected_date || '—'],
              ].map(([k, v]) => (
                <tr key={String(k)} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 8px', fontWeight: '600', fontSize: '12px', color: '#555', width: '40%' }}>{k}</td>
                  <td style={{ padding: '6px 8px', fontSize: '12px' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {form.special_notes && (
            <div style={{ background: '#FFF8EC', border: '1px solid #C49C64', padding: '10px', borderRadius: '6px', marginBottom: '16px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>Special Instructions:</p>
              <p style={{ fontSize: '12px' }}>{form.special_notes}</p>
            </div>
          )}

          <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Labour & Charges</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '6px 8px', fontSize: '12px' }}>Labour rate</td><td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>₹{form.labour_per_gram}/g</td></tr>
              <tr><td style={{ padding: '6px 8px', fontSize: '12px' }}>Weight (min 1g)</td><td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>{effectiveWeight}g</td></tr>
              <tr><td style={{ padding: '6px 8px', fontSize: '12px' }}>Labour amount</td><td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>₹{labourAmount.toLocaleString('en-IN')}</td></tr>
              {otherCharges > 0 && <tr><td style={{ padding: '6px 8px', fontSize: '12px' }}>Other charges</td><td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>₹{otherCharges.toLocaleString('en-IN')}</td></tr>}
              <tr style={{ borderTop: '2px solid #C49C64' }}>
                <td style={{ padding: '8px', fontWeight: 'bold', fontSize: '13px' }}>Total</td>
                <td style={{ padding: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'right' }}>₹{totalMfgCost.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '160px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
              <p style={{ fontSize: '11px', color: '#666' }}>Issued by (Shewah)</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '160px', borderBottom: '1px solid #333', marginBottom: '4px' }}></div>
              <p style={{ fontSize: '11px', color: '#666' }}>Received by ({selectedPartner?.name})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Screen UI */}
      <div className="print:hidden">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/manufacturing" className="text-stone-400 hover:text-stone-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Issue manufacturing order</h1>
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-2 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        <div className="space-y-4">
          {/* Partner + basic */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Manufacturing partner *</label>
                <select className={inp} value={form.manufacturing_partner_id} onChange={e => set('manufacturing_partner_id', e.target.value)}>
                  <option value="">Select partner...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Link to customer order (optional — auto-prefills details)</label>
                <select className={inp} value={form.customer_order_id} onChange={e => onOrderSelect(e.target.value)}>
                  <option value="">No linked order</option>
                  {customerOrders.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.order_number} — {o.partners?.store_name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Description / what to make *</label>
                <textarea className={`${inp} resize-none`} rows={2}
                  value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Oval solitaire ring, 0.5ct center stone, pavé band, 18K yellow gold" />
              </div>
              <div>
                <label className={lbl}>Quantity</label>
                <input type="number" min="1" className={inp} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Ring size</label>
                <input className={inp} value={form.ring_size} onChange={e => set('ring_size', e.target.value)} placeholder="e.g. 16, 17, 18" />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Special instructions</label>
                <textarea className={`${inp} resize-none`} rows={2}
                  value={form.special_notes} onChange={e => set('special_notes', e.target.value)}
                  placeholder="Any specific notes for the manufacturer..." />
              </div>
              <div>
                <label className={lbl}>Expected completion date</label>
                <input type="date" className={inp} value={form.expected_date} onChange={e => set('expected_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Reference images */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-3">Reference images</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {uploadedImages.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="aspect-square border-2 border-dashed border-stone-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#C49C64] hover:bg-yellow-50 transition-colors">
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { Array.from(e.target.files || []).forEach(f => uploadImage(f)); e.target.value = '' }} />
                <Upload className="w-5 h-5 text-stone-300" />
                <span className="text-xs text-stone-300 mt-1">{uploading ? 'Uploading...' : 'Upload'}</span>
              </label>
            </div>
            <p className="text-xs text-stone-400">Upload customer's reference images, sketches, or inspiration photos</p>
          </div>

          {/* Material */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-4">Material</h2>
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.material_from_float}
                  onChange={e => set('material_from_float', e.target.checked)}
                  className="w-4 h-4 accent-[#C49C64]" />
                <div>
                  <p className="text-sm font-medium text-stone-700">Use material from float (deposited gold)</p>
                  <p className="text-xs text-stone-400">Deduct gold weight from this partner's deposited material balance</p>
                </div>
              </label>
            </div>
            {form.material_from_float && floats.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-amber-700 mb-2">Current material balance:</p>
                <div className="flex flex-wrap gap-2">
                  {floats.map(f => (
                    <span key={f.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2 py-1 rounded-lg">
                      {f.material_type.replace(/_/g, ' ')}: {f.balance}g available
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className={lbl}>Gold karat</label>
                <select className={inp} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                  {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Gold weight needed (g) — in {form.gold_karat}K</label>
                <input type="number" step="0.01" className={inp} value={form.gold_weight_required} onChange={e => set('gold_weight_required', e.target.value)} placeholder="e.g. 3.5" />
                {goldWeightReq > 0 && (
                  <p className="text-xs text-secondary mt-1">
                    = <strong>{fineGold24k.toFixed(3)}g in 24kt</strong> fine gold
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>Diamond weight (ct)</label>
                <input type="number" step="0.01" className={inp} value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5" />
              </div>
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <label className={lbl}>Material notes</label>
                <input className={inp} value={form.material_notes} onChange={e => set('material_notes', e.target.value)} placeholder="e.g. Using 3g from deposited float + 0.5g from our stock" />
              </div>
            </div>
          </div>

          {/* Labour */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-4">Labour charges</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className={lbl}>Labour rate (₹/gram)</label>
                <input type="number" className={inp} value={form.labour_per_gram} onChange={e => set('labour_per_gram', e.target.value)}
                  placeholder={`Default: ₹${labourRates[parseInt(form.gold_karat)] || '—'}`} />
                <p className="text-xs text-stone-400 mt-1">Auto-filled from karat settings</p>
              </div>
              <div>
                <label className={lbl}>Actual gold weight (g)</label>
                <input type="number" step="0.01" className={inp} value={form.gold_weight_actual} onChange={e => set('gold_weight_actual', e.target.value)} placeholder="Fill after making" />
                <p className="text-xs text-stone-400 mt-1">Min 1g rule applies</p>
              </div>
              <div>
                <label className={lbl}>Other charges (₹)</label>
                <input type="number" className={inp} value={form.other_charges} onChange={e => set('other_charges', e.target.value)} />
              </div>
            </div>

            {/* Cost summary */}
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-stone-500">
                <span>Effective weight (min 1g)</span>
                <span>{effectiveWeight}g</span>
              </div>
              <div className="flex justify-between text-sm text-stone-500">
                <span>Labour (₹{form.labour_per_gram}/g × {effectiveWeight}g)</span>
                <span>₹{labourAmount.toLocaleString('en-IN')}</span>
              </div>
              {otherCharges > 0 && (
                <div className="flex justify-between text-sm text-stone-500">
                  <span>Other charges</span>
                  <span>₹{otherCharges.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-stone-900 pt-2 border-t border-stone-200">
                <span>Total manufacturing cost</span>
                <span className="text-[#C49C64]">₹{totalMfgCost.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pb-6">
            <Link href="/manufacturing" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg">
              Cancel
            </Link>
            <button onClick={handlePrint}
              className="flex items-center gap-2 border border-stone-300 text-stone-700 px-5 py-2.5 rounded-lg text-sm hover:bg-stone-50">
              <Printer className="w-4 h-4" /> Save & Print
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? 'Issuing...' : 'Issue order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewMfgOrderPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400">Loading...</div>}>
      <NewMfgOrderForm />
    </Suspense>
  )
}
