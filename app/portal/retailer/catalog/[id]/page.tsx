'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'

type Product = {
  id: string
  code: string
  name: string
  description?: string
  diamond_weight?: number
  diamond_shape?: string
  diamond_quality?: string
  diamond_color?: string
  diamond_type?: string
  gold_karat?: number
  gold_weight_g?: number
  trade_price?: number
  photo_urls?: string[]
  delivery_days?: number
  models_available?: string[]
}

const RING_SIZES = ['5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22']

export default function RetailerProductDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState('1')
  const [size, setSize] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/portal/retailer/catalog/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setProduct(d.product)
      })
      .catch(e => setError(e.message))
  }, [id])

  async function placeOrder() {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/portal/retailer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'catalog',
        product_id: id,
        quantity: parseInt(qty) || 1,
        ring_size: size || null,
        special_notes: notes || null,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'Order failed'); return }
    router.push(`/portal/retailer/orders/${data.order.id}`)
  }

  if (error && !product) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Catalog
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      </div>
    )
  }

  if (!product) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const photos = product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls : []
  const total = (Number(product.trade_price) || 0) * (parseInt(qty) || 1)
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto">
      <Link href="/portal/retailer" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Catalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photos */}
        <div>
          <div className="aspect-square bg-gradient-to-br from-stone-50 to-yellow-50 rounded-xl border border-stone-200 overflow-hidden flex items-center justify-center">
            {photos.length > 0 ? (
              <img src={photos[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-stone-300"><div className="text-6xl mb-2">◆</div><p className="text-sm">{product.code}</p></div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-3">
              {photos.map((u, i) => (
                <button key={u} onClick={() => setActiveImg(i)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? 'border-[#1E3A5F]' : 'border-stone-200'}`}>
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + order form */}
        <div>
          <p className="text-xs text-stone-400 font-medium mb-1">{product.code}</p>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-stone-600 mb-4 whitespace-pre-wrap">{product.description}</p>
          )}

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 text-sm">
            {[
              ['Gold karat', product.gold_karat ? `${product.gold_karat}K` : '—'],
              ['Gold weight', product.gold_weight_g ? `${product.gold_weight_g}g` : '—'],
              ['Diamond', product.diamond_weight ? `${product.diamond_weight}ct ${product.diamond_shape || ''}` : '—'],
              ['Quality', product.diamond_quality ? `${product.diamond_quality}/${product.diamond_color || ''}` : '—'],
              ['Type', product.diamond_type === 'natural' ? 'Natural diamond' : 'Lab-grown (LGD)'],
              ['Delivery', `${product.delivery_days || 14} days`],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs text-stone-400">{k}</p>
                <p className="text-stone-800 mt-0.5">{String(v)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs text-stone-400">Trade price (per piece)</p>
                <p className="text-2xl font-semibold text-stone-900">
                  {product.trade_price ? `₹${Number(product.trade_price).toLocaleString('en-IN')}` : '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={lbl}>Quantity</label>
                <input type="number" inputMode="numeric" min="1" className={inp}
                  value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Ring size</label>
                <select className={inp} value={size} onChange={e => setSize(e.target.value)}>
                  <option value="">Select size...</option>
                  {RING_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className={lbl}>Notes (optional)</label>
              <textarea rows={3} className={`${inp} resize-none`} placeholder="Engraving, packaging, special instructions..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between mb-4 px-3 py-2 bg-stone-50 rounded-lg">
              <span className="text-sm text-stone-500">Order total</span>
              <span className="text-lg font-semibold text-stone-900">₹{total.toLocaleString('en-IN')}</span>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <button onClick={placeOrder} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white px-5 py-3 rounded-lg text-sm font-medium disabled:opacity-50">
              <ShoppingBag className="w-4 h-4" />
              {submitting ? 'Placing order...' : 'Place order'}
            </button>
            <p className="text-[11px] text-stone-400 text-center mt-2">
              Final pricing and gold rate are confirmed by Shewah after the order is received.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
