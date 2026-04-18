'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Save, Check } from 'lucide-react'

export default function RetailerProductDetail() {
  const router = useRouter()
  const { productId } = useParams<{ productId: string }>()
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState('')
  const [imageIdx, setImageIdx] = useState(0)
  const [showOrder, setShowOrder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ id: string; order_number: string } | null>(null)

  const [form, setForm] = useState({
    quantity: '1',
    ring_size: '',
    special_notes: '',
  })

  useEffect(() => {
    fetch(`/api/portal/retailer/products/${productId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setProduct(d.product)
      })
      .catch(e => setError(e.message))
  }, [productId])

  async function placeOrder() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'catalog',
        product_id: productId,
        quantity: parseInt(form.quantity) || 1,
        ring_size: form.ring_size || null,
        special_notes: form.special_notes || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Could not place order'); return }
    setCreated({ id: data.order.id, order_number: data.order.order_number })
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (error && !product) {
    return (
      <div className="p-4 lg:p-7 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        <Link href="/portal/retailer/catalog" className="inline-block mt-3 text-sm text-[#C49C64]">← Back to catalog</Link>
      </div>
    )
  }

  if (!product) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>
  }

  const images: string[] = product.photo_urls || []
  const totalEst = (parseFloat(form.quantity) || 1) * (product.trade_price || 0)

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      <Link href="/portal/retailer/catalog" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to catalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-square bg-stone-100 rounded-xl overflow-hidden mb-3">
            {images[imageIdx] ? (
              <img src={images[imageIdx]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300">
                <Package className="w-12 h-12" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button key={i} onClick={() => setImageIdx(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${i === imageIdx ? 'border-[#C49C64]' : 'border-transparent'}`}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-stone-400">{product.code}</p>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">{product.name}</h1>
          {product.category && <p className="text-sm text-stone-500 capitalize mb-3">{product.category}</p>}
          <p className="text-3xl font-bold text-[#C49C64] mb-4">₹{(product.trade_price || 0).toLocaleString('en-IN')}</p>

          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            {product.gold_karat && (
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-400">Gold</p>
                <p className="font-medium text-stone-800">{product.gold_karat}K</p>
              </div>
            )}
            {product.delivery_days && (
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-400">Delivery</p>
                <p className="font-medium text-stone-800">~{product.delivery_days} days</p>
              </div>
            )}
            {product.diamond_weight && (
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-400">Diamonds</p>
                <p className="font-medium text-stone-800">{product.diamond_weight}ct</p>
              </div>
            )}
          </div>

          {product.description && (
            <p className="text-sm text-stone-600 mb-5 whitespace-pre-line">{product.description}</p>
          )}

          {created ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">Order placed</p>
              </div>
              <p className="text-sm text-green-700 mb-3">Order {created.order_number} created. Our team will get in touch shortly.</p>
              <Link href={`/portal/retailer/orders/${created.id}`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg">
                Track this order
              </Link>
            </div>
          ) : !showOrder ? (
            <button onClick={() => setShowOrder(true)}
              className="w-full bg-[#C49C64] hover:bg-[#9B7A40] text-white py-3 rounded-xl font-medium">
              Place an order
            </button>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Quantity</label>
                  <input type="number" min="1" className={inp} value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Ring size</label>
                  <input className={inp} value={form.ring_size}
                    placeholder="e.g. 16"
                    onChange={e => setForm(f => ({ ...f, ring_size: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Special notes</label>
                <textarea rows={3} className={`${inp} resize-none`} value={form.special_notes}
                  placeholder="Customer preferences, hallmark requirement, packaging..."
                  onChange={e => setForm(f => ({ ...f, special_notes: e.target.value }))} />
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-stone-100">
                <span className="text-stone-500">Estimated total</span>
                <span className="font-semibold text-stone-900">₹{totalEst.toLocaleString('en-IN')}</span>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowOrder(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
                  Cancel
                </button>
                <button onClick={placeOrder} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#C49C64] hover:bg-[#9B7A40] text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Placing...' : 'Place order'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
