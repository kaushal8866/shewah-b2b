'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  ShoppingBag,
  User,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Info
} from 'lucide-react'

// Wrap in a Suspense boundary for useSearchParams in Next.js App Router
export default function NewResellerOrderPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading wizard...</div>}>
      <ResellerOrderWizard />
    </Suspense>
  )
}

function ResellerOrderWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('product_id')
  const initialMarkup = searchParams.get('markup') || '15'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<any>(null)
  const [categorySchema, setCategorySchema] = useState<any[]>([])

  // Wizard Steps: 1 = Details, 2 = Shipping, 3 = Confirmation
  const [step, setStep] = useState(1)

  // Step 1: Details state
  const [quantity, setQuantity] = useState('1')
  const [ringSize, setRingSize] = useState('')
  const [customAttributes, setCustomAttributes] = useState<Record<string, any>>({})
  const [sellingPriceRupees, setSellingPriceRupees] = useState('')

  // Step 2: Shipping state
  const [shippingName, setShippingName] = useState('')
  const [shippingPhone, setShippingPhone] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')

  useEffect(() => {
    if (productId) {
      loadProduct()
    } else {
      setError('Product ID is missing. Please select a product from the catalog.')
      setLoading(false)
    }
  }, [productId])

  async function loadProduct() {
    try {
      setLoading(true)
      const res = await fetch(`/api/portal/reseller/catalog/${productId}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setProduct(data.product)
        setCategorySchema(data.categorySchema || [])

        // Autofill default selling price based on markup
        const cost = data.product.floor_price_paise / 100
        const mult = 1 + Number(initialMarkup) / 100
        setSellingPriceRupees(String(Math.round(cost * mult)))

        // Prepopulate custom attributes keys
        const initialAttrs: Record<string, any> = {}
        ;(data.categorySchema || []).forEach((f: any) => {
          initialAttrs[f.key] = f.type === 'boolean' ? false : ''
        })
        setCustomAttributes(initialAttrs)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading order details...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const costPriceRupees = product.floor_price_paise / 100
  const qty = Number(quantity) || 1
  const totalCostRupees = costPriceRupees * qty
  const finalSellingPrice = Number(sellingPriceRupees) || 0
  const resellerEarnings = finalSellingPrice - totalCostRupees

  async function handleSubmitOrder() {
    setSubmitting(true)

    try {
      const res = await fetch('/portal/api/orders', {
        // Wait, our backend endpoint is actually /api/portal/reseller/orders
        // Let's use the correct endpoint path!
      })
      
      const response = await fetch('/api/portal/reseller/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          quantity: qty,
          ring_size: ringSize || null,
          custom_attributes: customAttributes,
          customer_selling_price_paise: Math.round(finalSellingPrice * 100),
          shipping_name: shippingName,
          shipping_phone: shippingPhone,
          shipping_address: shippingAddress
        })
      })

      const data = await response.json()
      if (data.error) {
        alert('Order failed: ' + data.error)
      } else {
        alert('Order placed successfully! Please submit payment to start production.')
        router.push(`/portal/reseller/orders/${data.order.id}`)
      }
    } catch (err: any) {
      alert('Error submitting order: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white shadow-sm font-semibold text-stone-850'

  return (
    <div className="p-4 lg:p-7 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step > 1) setStep(step - 1)
            else router.push(`/portal/reseller/catalog/${productId}`)
          }}
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500 bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <span>New Order Wizard</span>
            <span>/</span>
            <span className="text-stone-700">Step {step} of 3</span>
          </div>
          <h1 className="text-lg font-bold text-stone-900 leading-tight">
            {step === 1 && 'Configure Specifications'}
            {step === 2 && 'Customer Shipping Details'}
            {step === 3 && 'Verify & Place Order'}
          </h1>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              step >= i ? 'bg-amber-600' : 'bg-stone-200'
            }`}
          ></div>
        ))}
      </div>

      {/* Step 1: Specifications & Price */}
      {step === 1 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
            <Package className="w-5 h-5 text-stone-400 shrink-0" />
            <div>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider leading-none">Product SKU</p>
              <h3 className="font-bold text-stone-900 text-sm mt-0.5">{product.code} · {product.name}</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Order Quantity</label>
              <input
                type="number"
                min="1"
                className={inp}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={lbl}>Ring Size (Optional)</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. 12, 14, US-7"
                value={ringSize}
                onChange={e => setRingSize(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Specs Form */}
          {categorySchema.length > 0 && (
            <div className="space-y-4 pt-3 border-t border-stone-100">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Product Specifications</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categorySchema.map(f => {
                  return (
                    <div key={f.key}>
                      <label className={lbl}>
                        {f.label} {f.required && '*'}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          className={inp}
                          value={customAttributes[f.key] || ''}
                          onChange={e => setCustomAttributes(prev => ({ ...prev, [f.key]: e.target.value }))}
                          required={f.required}
                        >
                          <option value="">Select option...</option>
                          {f.options?.map((o: string) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="checkbox"
                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                            checked={customAttributes[f.key] || false}
                            onChange={e => setCustomAttributes(prev => ({ ...prev, [f.key]: e.target.checked }))}
                          />
                          <span className="text-sm font-semibold text-stone-700">{f.label}</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            className={inp}
                            placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}...`}
                            value={customAttributes[f.key] || ''}
                            onChange={e => setCustomAttributes(prev => ({ ...prev, [f.key]: e.target.value }))}
                            required={f.required}
                          />
                          {f.unit && (
                            <span className="absolute right-3 top-2.5 text-stone-400 text-xs font-bold">{f.unit}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pricing Config */}
          <div className="space-y-4 pt-3 border-t border-stone-100">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Margin Calculations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Total Wholesale Cost (₹)</label>
                <div className="bg-stone-50 border border-stone-150 rounded-xl px-3 py-2.5 font-bold text-stone-900 text-sm">
                  ₹{totalCostRupees.toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-stone-400 mt-1">₹{costPriceRupees.toLocaleString('en-IN')} per pc locked floor price</p>
              </div>

              <div>
                <label className={lbl}>Customer Selling Price (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-stone-400 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    className={`${inp} pl-7 font-black text-amber-700`}
                    value={sellingPriceRupees}
                    onChange={e => setSellingPriceRupees(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">Selling price to charge the consumer</p>
              </div>
            </div>

            {/* Profit summary card */}
            <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-green-800 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-green-600" /> Projected Earnings:
              </span>
              <span className="text-lg font-black text-green-700">
                ₹{resellerEarnings.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (finalSellingPrice < totalCostRupees) {
                alert(`Selling price cannot be less than your cost of ₹${totalCostRupees}`)
                return
              }
              setStep(2)
            }}
            className="w-full bg-[#1E3A5F] hover:bg-[#162B47] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors shadow-sm"
          >
            Enter Shipping Details <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Customer Shipping Details */}
      {step === 2 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 text-stone-500 font-bold text-xs uppercase tracking-wider">
            <User className="w-4 h-4 text-stone-400" /> Customer Information
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Recipient Full Name *</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. Aditi Sharma"
                value={shippingName}
                onChange={e => setShippingName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={lbl}>Recipient Contact Phone *</label>
              <input
                type="tel"
                className={inp}
                placeholder="e.g. +91 98765 43210"
                value={shippingPhone}
                onChange={e => setShippingPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Shipping Full Address *</label>
            <textarea
              className={`${inp} h-24 resize-none`}
              placeholder="Enter complete delivery address (street, city, state, pincode)..."
              value={shippingAddress}
              onChange={e => setShippingAddress(e.target.value)}
              required
            />
            <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Dropship parcels contain zero branding of Shewah. Brand erased completely.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold py-3 rounded-xl text-center text-sm"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!shippingName || !shippingPhone || !shippingAddress) {
                  alert('Please fill out all shipping fields.')
                  return
                }
                setStep(3)
              }}
              className="flex-1 bg-[#1E3A5F] hover:bg-[#162B47] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors shadow-sm"
            >
              Verify &amp; Confirm <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Final Verification & Submit */}
      {step === 3 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b border-stone-200 font-bold text-stone-850">
              <span>Item summary</span>
              <span className="font-mono text-amber-700">{product.code}</span>
            </div>
            <div className="space-y-1.5 text-stone-600 text-xs">
              <p className="flex justify-between"><span>Product Name:</span> <span className="font-bold text-stone-900">{product.name}</span></p>
              <p className="flex justify-between"><span>Quantity Ordered:</span> <span className="font-bold text-stone-900">{qty} pc(s)</span></p>
              {ringSize && <p className="flex justify-between"><span>Ring Size:</span> <span className="font-bold text-stone-900">{ringSize}</span></p>}
            </div>

            {/* Custom attributes overview */}
            {Object.entries(customAttributes).some(([_, v]) => v !== '') && (
              <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                <p className="font-semibold text-stone-800 mb-1">Custom Specs:</p>
                {Object.entries(customAttributes)
                  .filter(([_, v]) => v !== '')
                  .map(([k, v]) => {
                    const field = categorySchema.find(f => f.key === k)
                    const label = field ? field.label : k
                    const unit = field?.unit ? ` ${field.unit}` : ''
                    return (
                      <p key={k} className="flex justify-between text-stone-600">
                        <span>{label}:</span>
                        <span className="font-bold text-stone-900">{String(v)}{unit}</span>
                      </p>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Shipping Summary */}
          <div className="bg-stone-50 border border-stone-150 rounded-xl p-4 space-y-2 text-xs text-stone-600">
            <p className="font-bold text-stone-850 border-b border-stone-200 pb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-stone-400" /> Shipping Destination
            </p>
            <p className="flex justify-between"><span>Recipient:</span> <span className="font-bold text-stone-900">{shippingName}</span></p>
            <p className="flex justify-between"><span>Contact:</span> <span className="font-bold text-stone-900">{shippingPhone}</span></p>
            <p className="pt-1.5 border-t border-stone-150 text-stone-700 leading-relaxed font-semibold">{shippingAddress}</p>
          </div>

          {/* Pricing calculations */}
          <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-stone-50 px-4 py-2 border-b border-stone-200 font-bold text-stone-500 uppercase tracking-wider">
              Financial Breakdown
            </div>
            <div className="p-3.5 space-y-2 text-stone-600">
              <p className="flex justify-between"><span>Wholesale Cost (Floor):</span> <span className="font-bold text-stone-900">₹{totalCostRupees.toLocaleString('en-IN')}</span></p>
              <p className="flex justify-between"><span>Customer Selling Price:</span> <span className="font-bold text-green-650">₹{finalSellingPrice.toLocaleString('en-IN')}</span></p>
              <div className="flex justify-between pt-2 border-t border-stone-150 font-bold text-sm text-green-700">
                <span>Your Profit Earnings:</span>
                <span>₹{resellerEarnings.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold py-3 rounded-xl text-center text-sm bg-white"
            >
              Back
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {submitting ? 'Placing Order...' : 'Confirm & Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
