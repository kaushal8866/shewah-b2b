'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, partnerLabourRate, type ManufacturingPartnerLite } from '@/lib/supabase'
import { KARAT_FACTORS, getMetalWeight } from '@/lib/karat'
import { uploadToCloudinary, uploadFileToCloudinary } from '@/lib/cloudinaryUpload'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Save, Upload, X, Printer, Package, FileUp, FileDown, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

function NewMfgOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [partners, setPartners] = useState<ManufacturingPartnerLite[]>([])
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [buckets, setBuckets] = useState<any[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [cadFiles, setCadFiles] = useState<{ url: string; filename: string }[]>([])
  const [uploadingCad, setUploadingCad] = useState(false)
  const [floatError, setFloatError] = useState<string | null>(null)
  const [overIssueModal, setOverIssueModal] = useState<{ available: number; required: number; shortfall: number } | null>(null)
  const [fifoPreview, setFifoPreview] = useState<any | null>(null)
  const [loadingFifo, setLoadingFifo] = useState(false)
  // Tracks fields the operator has manually edited so the customer-order autofill
  // doesn't clobber them on a second pick.
  const [touched, setTouched] = useState<Record<string, boolean>>({})

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
      supabase.from('orders').select('id, order_number, quantity, ring_size, special_notes, gold_karat, gold_color, gold_weight_estimated, gold_weight_actual, products(code, name, gold_karat, gold_weight_g, diamond_weight, diamond_shape, diamond_quality, diamond_color, metal_type, metal_weights, ref_karat, ref_color), partners(store_name)').order('order_date', { ascending: false }).limit(20),
    ]).then(([{ data: p }, { data: co }]) => {
      setPartners((p || []) as ManufacturingPartnerLite[])
      setCustomerOrders(co || [])
    })
  }, [])

  useEffect(() => {
    if (form.manufacturing_partner_id) {
      fetch(`/api/manufacturing/partners/${form.manufacturing_partner_id}/buckets`)
        .then(r => r.json())
        .then(d => setBuckets(d.buckets || []))
        .catch(() => setBuckets([]))
    } else {
      setBuckets([])
    }
  }, [form.manufacturing_partner_id])

  // Task 78: gold floats are denominated in 24kt-net only. The karat picker on
  // the form is purely a labour-rate input; we convert the required gross
  // weight into its 24kt-pure equivalent before checking/reserving from float.
  const requiredMaterialType = 'gold_24k'
  const activeBucket = buckets.find(b => b.material_type === requiredMaterialType)
  const requiredGross = parseFloat(form.gold_weight_required || '0') || 0
  const karatNum = parseInt(form.gold_karat, 10) || 24
  const karatFactor = KARAT_FACTORS[karatNum] ?? 1
  const required = Math.round(requiredGross * karatFactor * 10000) / 10000
  const shortfall =
    form.material_from_float && required > 0 && activeBucket
      ? Math.max(0, required - activeBucket.available)
      : 0
  const overIssue = form.material_from_float && required > 0 && (!activeBucket || activeBucket.available < required)

  // Auto-fill labour rate from the SELECTED partner's per-karat rate only
  // (Task #68 — no implicit global default). When the partner has no rate
  // for the chosen karat, the field is cleared and a hint surfaces beside
  // the input. A useRef tracks the last value WE wrote, so any value the
  // admin types (different from our last auto) is preserved as a manual
  // override.
  const selectedPartnerForLabour = partners.find(p => p.id === form.manufacturing_partner_id)
  const partnerKaratRate = partnerLabourRate(selectedPartnerForLabour, parseInt(form.gold_karat))
  const autoLabourRef = useRef<string>('')
  useEffect(() => {
    const nextStr = partnerKaratRate > 0 ? String(partnerKaratRate) : ''
    const isDirty = form.labour_per_gram !== '' && form.labour_per_gram !== autoLabourRef.current
    if (isDirty) return
    if (form.labour_per_gram !== nextStr) {
      autoLabourRef.current = nextStr
      set('labour_per_gram', nextStr)
    } else {
      autoLabourRef.current = nextStr
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gold_karat, form.manufacturing_partner_id, partnerKaratRate])

  function set(k: string, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }))
    setTouched(prev => ({ ...prev, [k]: true }))
  }

  // When the operator links a customer order, copy across everything we know
  // (description, qty, ring size, karat, gold weight, diamond carats, notes)
  // so they don't have to retype it. Manually-edited fields are preserved.
  function onLinkCustomerOrder(coId: string) {
    setForm(prev => ({ ...prev, customer_order_id: coId }))
    if (!coId) return
    const co: any = customerOrders.find((o: any) => o.id === coId)
    if (!co) return
    const product = co.products
    
    let goldWeight = co.gold_weight_actual || co.gold_weight_estimated || ''
    if (!goldWeight && product) {
      if (product.metal_weights && Object.keys(product.metal_weights).length > 0) {
        const isSil = product.metal_type === 'silver'
        if (isSil) {
          const k = product.ref_karat || 'silver_925'
          goldWeight = getMetalWeight(product.metal_weights, k, 'default') || ''
        } else {
          const k = co.gold_karat ? (String(co.gold_karat).toLowerCase() === 'silver' ? '22K' : `${co.gold_karat}K`) : '22K'
          const c = co.gold_color || 'yellow'
          goldWeight = getMetalWeight(product.metal_weights, k, c) || ''
        }
      } else {
        goldWeight = product.gold_weight_g || ''
      }
    }

    const diamondLine = product
      ? [
          product.diamond_weight ? `${product.diamond_weight}ct` : '',
          product.diamond_shape || '',
          [product.diamond_quality, product.diamond_color].filter(Boolean).join('/'),
        ].filter(Boolean).join(' ')
      : ''
    const desc = product ? `${product.code} — ${product.name}` : ''
    setForm(prev => ({
      ...prev,
      customer_order_id: coId,
      description: !touched.description && desc ? desc : prev.description,
      quantity:    !touched.quantity && co.quantity     ? String(co.quantity)        : prev.quantity,
      ring_size:   !touched.ring_size && co.ring_size   ? String(co.ring_size)       : prev.ring_size,
      special_notes: !touched.special_notes
        ? [co.special_notes, diamondLine ? `Diamond: ${diamondLine}` : ''].filter(Boolean).join(' | ') || prev.special_notes
        : prev.special_notes,
      gold_karat:    !touched.gold_karat && (co.gold_karat || product?.gold_karat)
        ? String(co.gold_karat || product.gold_karat)
        : prev.gold_karat,
      gold_weight_required: !touched.gold_weight_required && goldWeight
        ? String(goldWeight)
        : prev.gold_weight_required,
      diamond_weight: !touched.diamond_weight && product?.diamond_weight
        ? String(product.diamond_weight)
        : prev.diamond_weight,
    }))
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

  async function uploadCad(file: File) {
    setUploadingCad(true)
    try {
      const r = await uploadFileToCloudinary(file)
      setCadFiles(prev => [...prev, { url: r.url, filename: r.filename }])
    } catch (err) {
      alert('File upload failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setUploadingCad(false)
  }

  useEffect(() => {
    const qty = parseFloat(form.gold_weight_required)
    if (!qty || qty <= 0) {
      setFifoPreview(null)
      return
    }

    let active = true
    const fetchPreview = async () => {
      setLoadingFifo(true)
      try {
        const res = await fetch('/api/purchase-lots/fifo-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            material_type: 'gold_24k',
            required_qty: qty,
            gold_karat: `${form.gold_karat}K`
          })
        })
        if (res.ok && active) {
          const data = await res.json()
          setFifoPreview(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (active) setLoadingFifo(false)
      }
    }

    const timer = setTimeout(fetchPreview, 400) // debounce
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [form.gold_weight_required, form.gold_karat])

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
    setFloatError(null)
    if (!form.manufacturing_partner_id || !form.description) {
      alert('Select a manufacturing partner and add description')
      return
    }
    if (overIssue) {
      setOverIssueModal({
        available: activeBucket?.available || 0,
        required,
        shortfall,
      })
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
      cad_files: cadFiles.map(c => c.url),
      cad_file_names: cadFiles.map(c => c.filename),
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

    const { data, error } = await supabase.from('manufacturing_orders').insert([payload]).select().single()
    if (error) { setSaving(false); alert('Error: ' + error.message); return }

    // Reserve gold from float on the server — re-checks Available inside the
    // request to close the race window where two admins issue overlapping
    // orders. On rejection we delete the order we just created.
    if (form.material_from_float && required > 0) {
      const reserve = await fetch(`/api/manufacturing/orders/${data.id}/reserve-float`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: form.manufacturing_partner_id,
          material_type: requiredMaterialType,
          quantity: required,
          order_id: form.customer_order_id || null,
          notes: `Reserved for ${orderNumber}`,
        }),
      })
      if (!reserve.ok) {
        const j = await reserve.json().catch(() => ({}))
        await supabase.from('manufacturing_orders').delete().eq('id', data.id)
        setSaving(false)
        if (reserve.status === 409) {
          setOverIssueModal({
            available: Number(j.available || 0),
            required: Number(j.required || required),
            shortfall: Number(j.shortfall || Math.max(0, required - Number(j.available || 0))),
          })
        } else {
          setFloatError(j.error || 'Failed to reserve float; order was rolled back.')
        }
        return
      }
    }

    // Trigger gold FIFO lot reservation when order is successfully created
    if (parseFloat(form.gold_weight_required) > 0) {
      try {
        const executeRes = await fetch('/api/purchase-lots/fifo-execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manufacturing_order_id: data.id,
            material_type: 'gold_24k',
            required_qty: parseFloat(form.gold_weight_required),
            gold_karat: `${form.gold_karat}K`
          })
        })
        if (!executeRes.ok) {
          console.error('FIFO reservation failed on save', await executeRes.json())
        }
      } catch (err) {
        console.error('FIFO reservation request error on save', err)
      }
    }

    setSaving(false)
    router.push(`/manufacturing/orders/${data.id}`)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"
  const selectedPartner = partners.find(p => p.id === form.manufacturing_partner_id)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Print-only order sheet */}
      <div className="hidden print:block" ref={printRef}>
        <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '700px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1E3A5F', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1A1F2E' }}>SHEWAH</h1>
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
            <div style={{ background: '#FFF8EC', border: '1px solid #1E3A5F', padding: '10px', borderRadius: '6px', marginBottom: '16px' }}>
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
              <tr style={{ borderTop: '2px solid #1E3A5F' }}>
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
                <label className={lbl}>Link to customer order (optional)</label>
                <select className={inp} value={form.customer_order_id} onChange={e => onLinkCustomerOrder(e.target.value)}>
                  <option value="">No linked order</option>
                  {customerOrders.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.order_number} — {o.partners?.store_name}</option>
                  ))}
                </select>
                {form.customer_order_id && (
                  <p className="text-[10px] text-emerald-600 mt-1">Description, qty, karat, weight & diamond auto-filled from the linked order. Edit any field to override.</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Description / what to make *</label>
                <textarea className={`${inp} resize-none`} rows={2}
                  value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Oval solitaire ring, 0.5ct center stone, pavé band, 18K yellow gold" />
              </div>
              <div>
                <label className={lbl}>Quantity</label>
                <input type="number" inputMode="decimal" min="1" className={inp} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
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
              <label className="aspect-square border-2 border-dashed border-stone-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#1E3A5F] hover:bg-yellow-50 transition-colors">
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { Array.from(e.target.files || []).forEach(f => uploadImage(f)); e.target.value = '' }} />
                <Upload className="w-5 h-5 text-stone-300" />
                <span className="text-xs text-stone-300 mt-1">{uploading ? 'Uploading...' : 'Upload'}</span>
              </label>
            </div>
            <p className="text-xs text-stone-400">Upload customer's reference images, sketches, or inspiration photos</p>
          </div>

          {/* CAD / STL files */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-1">CAD &amp; design files</h2>
            <p className="text-xs text-stone-400 mb-3">Attach the approved CAD, STL, STEP or PDF you want the karigar to make from. These will be bundled in the WhatsApp link they receive.</p>
            <div className="space-y-2 mb-3">
              {cadFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  <FileDown className="w-4 h-4 text-stone-500 shrink-0" />
                  <span className="flex-1 text-sm text-stone-700 truncate">{f.filename}</span>
                  <button onClick={() => setCadFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-stone-400 hover:text-red-500" aria-label="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-lg py-3 cursor-pointer hover:border-[#1E3A5F] hover:bg-yellow-50 transition-colors">
              <input type="file" multiple className="hidden"
                accept=".stl,.3dm,.step,.stp,.iges,.igs,.obj,.zip,.pdf,.dwg,.dxf,application/pdf,application/zip"
                onChange={e => { Array.from(e.target.files || []).forEach(f => uploadCad(f)); e.target.value = '' }} />
              <FileUp className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-stone-500">{uploadingCad ? 'Uploading...' : 'Add CAD / STL / PDF'}</span>
            </label>
          </div>

          {/* Material */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-4">Material</h2>
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.material_from_float}
                  onChange={e => set('material_from_float', e.target.checked)}
                  className="w-4 h-4 accent-[#1E3A5F]" />
                <div>
                  <p className="text-sm font-medium text-stone-700">Use material from float (deposited gold)</p>
                  <p className="text-xs text-stone-400">Deduct gold weight from this partner's deposited material balance</p>
                </div>
              </label>
            </div>
            {form.material_from_float && (
              <div className="space-y-3 mb-4">
                {buckets.length === 0 && form.manufacturing_partner_id && (
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-500">
                    No float deposits recorded for this karigar yet.
                  </div>
                )}
                {buckets.map(b => {
                  const isActive = b.material_type === requiredMaterialType
                  const label = b.material_type === 'gold_24k'
                    ? 'Gold (24kt net)'
                    : b.material_type.replace(/_/g, ' ')
                  return (
                    <div key={b.material_type}
                      className={`rounded-lg p-3 border ${isActive ? 'bg-[#F5F6F8] border-[#1E3A5F]' : 'bg-stone-50 border-stone-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-700">{label}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-md py-2 border border-stone-200">
                          <p className="text-[10px] text-stone-500 uppercase">Available</p>
                          <p className="text-sm font-semibold text-emerald-700">{b.available.toFixed(3)}g</p>
                        </div>
                        <div className="bg-white rounded-md py-2 border border-stone-200">
                          <p className="text-[10px] text-stone-500 uppercase">Reserved</p>
                          <p className="text-sm font-semibold text-amber-700">{b.reserved.toFixed(3)}g</p>
                        </div>
                        <div className="bg-white rounded-md py-2 border border-stone-200">
                          <p className="text-[10px] text-stone-500 uppercase">Used</p>
                          <p className="text-sm font-semibold text-stone-700">{b.used.toFixed(3)}g</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {requiredGross > 0 && (
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-600">
                    This order needs <strong>{requiredGross.toFixed(3)}g of {karatNum}K gold</strong>, equivalent to <strong>{required.toFixed(3)}g of 24kt-net</strong> (× {karatFactor.toFixed(3)}). Float is held only as 24kt-net.
                  </div>
                )}
                {overIssue && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Short by <strong>{shortfall.toFixed(3)}g of 24kt-net</strong>. You'll be asked to record a deposit when you try to issue.
                    </span>
                  </div>
                )}
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
                <label className={lbl}>Gold weight needed (g)</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp} value={form.gold_weight_required} onChange={e => set('gold_weight_required', e.target.value)} placeholder="e.g. 3.5000" />
              </div>
              <div>
                <label className={lbl}>Diamond weight (ct)</label>
                <input type="number" inputMode="decimal" step="0.01" className={inp} value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5" />
              </div>
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <label className={lbl}>Material notes</label>
                <input className={inp} value={form.material_notes} onChange={e => set('material_notes', e.target.value)} placeholder="e.g. Using 3g from deposited float + 0.5g from our stock" />
              </div>
            </div>

            {/* FIFO Gold Cost Preview */}
            {fifoPreview && (
              <div className="mt-4 p-3 rounded-xl border border-stone-200 bg-stone-50/50 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 uppercase tracking-wider block">FIFO Cost Preview</span>
                  {fifoPreview.fulfilled ? (
                    <span className="text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">Fully Stocked</span>
                  ) : (
                    <span className="text-rose-700 font-semibold bg-rose-100 px-2 py-0.5 rounded-md text-[10px]">
                      Shortfall: {fifoPreview.shortfall_qty}g (pure)
                    </span>
                  )}
                </div>
                
                <div className="text-stone-500 font-medium">
                  {fifoPreview.reservations.length > 0 ? (
                    <div>
                      Will draw: {fifoPreview.reservations.map((r: any) => (
                        `${r.lot_number} (${(r.issued_qty / (KARAT_FACTORS[parseInt(form.gold_karat) || 24])).toFixed(2)}g @ ₹${Math.round(r.unit_cost * (KARAT_FACTORS[parseInt(form.gold_karat) || 24]))})`
                      )).join(' + ')}
                    </div>
                  ) : (
                    <div className="text-rose-600">No active gold lots found in stock!</div>
                  )}
                </div>

                <div className="flex justify-between border-t border-stone-100 pt-2 font-bold text-stone-700">
                  <span>Estimated FIFO Gold Cost:</span>
                  <span>{formatCurrency(fifoPreview.total_cost)}</span>
                </div>

                {!fifoPreview.fulfilled && (
                  <p className="text-[10px] text-rose-500 font-semibold leading-relaxed mt-1">
                    ⚠️ Only {((parseFloat(form.gold_weight_required) * (KARAT_FACTORS[parseInt(form.gold_karat) || 24])) - fifoPreview.shortfall_qty).toFixed(3)}g (pure) available in lots. {fifoPreview.shortfall_qty}g (pure) not costed — please add a purchase lot first.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Labour */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h2 className="font-medium text-stone-900 mb-4">Labour charges</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className={lbl}>Labour rate (₹/gram)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inp}
                  value={form.labour_per_gram}
                  onChange={e => set('labour_per_gram', e.target.value)}
                  placeholder={partnerKaratRate > 0 ? `Auto: ₹${partnerKaratRate}` : 'No partner rate set'}
                />
                {selectedPartnerForLabour && partnerKaratRate <= 0 ? (
                  <p className="text-[11px] text-amber-600 mt-1">{selectedPartnerForLabour.name} has no labour rate set for {form.gold_karat}K. Add one on the partner page or enter the rate manually.</p>
                ) : selectedPartnerForLabour && partnerKaratRate > 0 ? (
                  <p className="text-[11px] text-stone-400 mt-1">Auto-filled from {selectedPartnerForLabour.name}&apos;s {form.gold_karat}K rate. Type to override.</p>
                ) : (
                  <p className="text-[11px] text-stone-400 mt-1">Pick a karigar to auto-fill from their per-karat rate.</p>
                )}
              </div>
              <div>
                <label className={lbl}>Actual gold weight (g)</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp} value={form.gold_weight_actual} onChange={e => set('gold_weight_actual', e.target.value)} placeholder="Fill after making" />
                <p className="text-xs text-stone-400 mt-1">Min 1g rule applies</p>
              </div>
              <div>
                <label className={lbl}>Other charges (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.other_charges} onChange={e => set('other_charges', e.target.value)} />
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
                <span className="text-[#1E3A5F]">₹{totalMfgCost.toLocaleString('en-IN')}</span>
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
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? 'Issuing...' : 'Issue order'}
            </button>
          </div>
        </div>
      </div>

      {/* Over-issue blocking modal: prefilled deposit shortcut + clear copy */}
      {overIssueModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 print:hidden"
             onClick={() => setOverIssueModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-stone-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-900">Not enough float available</h3>
                <p className="text-xs text-stone-500 mt-1">
                  This karigar's available 24kt-net gold float is short.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-50 rounded-lg py-2">
                  <p className="text-[10px] text-stone-500 uppercase">Available</p>
                  <p className="font-semibold text-stone-700">{overIssueModal.available.toFixed(3)}g</p>
                </div>
                <div className="bg-stone-50 rounded-lg py-2">
                  <p className="text-[10px] text-stone-500 uppercase">Needed</p>
                  <p className="font-semibold text-stone-700">{overIssueModal.required.toFixed(3)}g</p>
                </div>
                <div className="bg-amber-50 rounded-lg py-2">
                  <p className="text-[10px] text-amber-700 uppercase">Short by</p>
                  <p className="font-semibold text-amber-700">{overIssueModal.shortfall.toFixed(3)}g</p>
                </div>
              </div>
              <p className="text-xs text-stone-500">
                Record a deposit of at least <strong>{overIssueModal.shortfall.toFixed(3)}g</strong> from your stock to this karigar, then come back to issue this order.
              </p>
            </div>
            <div className="p-5 pt-0 flex flex-col gap-2">
              <Link
                href={`/manufacturing/partners/${form.manufacturing_partner_id}/float?deposit=${encodeURIComponent(requiredMaterialType)}&amount=${overIssueModal.shortfall.toFixed(3)}`}
                className="bg-[#1E3A5F] hover:bg-[#162B47] text-white text-sm font-medium px-4 py-2.5 rounded-lg text-center">
                Record {overIssueModal.shortfall.toFixed(3)}g deposit
              </Link>
              <button onClick={() => setOverIssueModal(null)}
                className="text-stone-500 hover:text-stone-800 text-xs py-1.5">
                Cancel and edit order
              </button>
            </div>
          </div>
        </div>
      )}
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
