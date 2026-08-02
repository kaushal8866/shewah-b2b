'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import {
  ArrowLeft,
  ShoppingBag,
  Check,
  X,
  CreditCard,
  MapPin,
  Clock,
  TrendingUp,
  AlertTriangle,
  Upload,
  Camera,
  CheckCircle,
  Eye,
  Info
} from 'lucide-react'

const ORDER_STATUS_LABELS: Record<string, string> = {
  customer_placed: 'Storefront Order',
  payment_pending: 'Payment Pending',
  brief_received: 'Order Received',
  cad_in_progress: 'CAD in Progress',
  cad_sent: 'CAD Sent',
  design_approved: 'Design Approved',
  production: 'In Production',
  qc: 'Quality Check',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const TIMELINE_STEPS = [
  { key: 'customer_placed', label: 'Storefront' },
  { key: 'payment_pending', label: 'Verify' },
  { key: 'brief_received', label: 'Received' },
  { key: 'production', label: 'Production' },
  { key: 'qc', label: 'QC' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' }
]

export default function ResellerOrderDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [groupOrders, setGroupOrders] = useState<any[]>([])

  // Payment proof form state
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [reference, setReference] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // QR Code instructions overlay
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const res = await fetch(`/api/portal/reseller/orders/${id}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setOrder(data.order)
        setPayments(data.payments || [])
        setGroupOrders(data.groupOrders || [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleScreenshotUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(files[0])
      setScreenshotUrl(url)
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!screenshotUrl) {
      alert('Please upload a screenshot proof first.')
      return
    }
    setSubmitting(true)

    try {
      const res = await fetch(`/api/portal/reseller/orders/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          transaction_reference: reference,
          proof_screenshot_url: screenshotUrl
        })
      })

      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        alert('Payment proof uploaded successfully! Our admin will review and verify your transaction shortly.')
        setReference('')
        setScreenshotUrl('')
        loadData()
      }
    } catch (err: any) {
      alert('Error uploading payment proof: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmStorefrontOrder() {
    if (!confirm('Are you sure you want to confirm this storefront order?')) return
    try {
      const res = await fetch(`/api/portal/reseller/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' })
      })
      const data = await res.json()
      if (data.error) alert(data.error)
      else {
        alert('Order confirmed successfully! It is now pending payment floor cost.')
        loadData()
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleRejectStorefrontOrder(reason: string) {
    try {
      const res = await fetch(`/api/portal/reseller/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: reason })
      })
      const data = await res.json()
      if (data.error) alert(data.error)
      else {
        alert('Order rejected!')
        loadData()
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleMarkCustomerPaid() {
    if (!confirm('Are you sure you want to mark customer payment as received?')) return
    try {
      const res = await fetch(`/api/portal/reseller/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-paid' })
      })
      const data = await res.json()
      if (data.error) alert(data.error)
      else {
        alert('Customer payment marked as received!')
        loadData()
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading order details...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>
  if (!order) return <div className="p-4 lg:p-7 text-stone-450 text-sm">Order not found.</div>

  const costRupees = groupOrders.length > 0
    ? groupOrders.reduce((acc, o) => acc + (o.reseller_cost_paise || 0), 0) / 100
    : order.reseller_cost_paise / 100

  const sellingPriceRupees = groupOrders.length > 0
    ? groupOrders.reduce((acc, o) => acc + (o.customer_selling_price_paise || 0), 0) / 100
    : order.customer_selling_price_paise / 100

  const earningsRupees = groupOrders.length > 0
    ? groupOrders.reduce((acc, o) => acc + (o.reseller_earnings_paise || 0), 0) / 100
    : order.reseller_earnings_paise / 100

  // Resolve current active step index in timeline
  let activeTimelineIdx = 0
  if (order.status === 'customer_placed') {
    activeTimelineIdx = 0
  } else if (order.status === 'payment_pending') {
    activeTimelineIdx = 1
  } else if (order.status === 'brief_received' || order.status === 'cad_in_progress' || order.status === 'cad_sent' || order.status === 'design_approved') {
    activeTimelineIdx = 2
  } else if (order.status === 'production') {
    activeTimelineIdx = 3
  } else if (order.status === 'qc') {
    activeTimelineIdx = 4
  } else if (order.status === 'dispatched') {
    activeTimelineIdx = 5
  } else if (order.status === 'delivered') {
    activeTimelineIdx = 6
  }

  const isOverdue = order.status === 'payment_pending' && new Date(order.payment_deadline) < new Date()

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white shadow-sm font-semibold text-stone-850'

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/portal/reseller/orders"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500 bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/portal/reseller/orders" className="hover:text-stone-700">Orders</Link>
            <span>/</span>
            <span className="text-stone-700">{order.order_number}</span>
          </div>
          <h1 className="text-lg font-bold text-stone-900 leading-tight">Order Timeline &amp; Payment</h1>
        </div>
      </div>

      {/* Progress Timeline */}
      {order.status !== 'cancelled' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-stone-550 uppercase tracking-wider pb-2 border-b border-stone-100">
            Order Status Journey
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            {TIMELINE_STEPS.map((step, idx) => {
              const active = activeTimelineIdx >= idx
              return (
                <div key={step.key} className="flex sm:flex-col items-center gap-3 sm:gap-2 flex-1 w-full sm:text-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      active ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {activeTimelineIdx > idx ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      active ? 'text-stone-900 font-bold' : 'text-stone-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Configuration & Details */}
        <div className="md:col-span-7 space-y-6">
          {/* Order Details summary */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-stone-400" /> Order Specifications
            </h3>
            {groupOrders.length > 0 ? (
              <div className="space-y-4">
                <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Set Components Breakdown</p>
                <div className="space-y-3">
                  {groupOrders.map(comp => (
                    <div key={comp.id} className="flex items-center gap-3 p-3 border rounded-xl bg-stone-50" style={{ borderColor: '#E6E6E6' }}>
                      {comp.products?.photo_urls?.[0] ? (
                        <img src={comp.products.photo_urls[0]} className="w-12 h-12 object-cover rounded border" alt="" />
                      ) : (
                        <div className="w-12 h-12 bg-stone-100 flex items-center justify-center rounded border border-stone-200 text-stone-400 font-bold text-xs uppercase">SET</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-850 truncate">{comp.component_label || comp.products?.category}</p>
                        <p className="text-[10px] text-stone-450 mt-0.5">
                          SKU: {comp.products?.code} · Karat: {comp.configuration_summary?.karat || comp.custom_attributes?.karat || '18K'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-700">₹{((comp.customer_selling_price_paise || 0) / 100).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-stone-450">Profit: ₹{((comp.reseller_earnings_paise || 0) / 100).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                  <span>Ordered Item:</span>
                  <span className="font-bold text-stone-900">{order.products?.code} · {order.products?.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                  <span>Quantity:</span>
                  <span className="font-bold text-stone-900">{order.quantity} pc(s)</span>
                </div>
                {order.ring_size && (
                  <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                    <span>Ring Size:</span>
                    <span className="font-bold text-stone-900">{order.ring_size}</span>
                  </div>
                )}
                {(order.configuration_summary?.karat || order.custom_attributes?.karat) && (
                  <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                    <span>Metal Karat:</span>
                    <span className="font-bold text-stone-900">{order.configuration_summary?.karat || order.custom_attributes?.karat}</span>
                  </div>
                )}
              </div>
            )}

            {/* Custom attributes */}
            {Object.keys(order.custom_attributes || {}).filter(k => k !== 'customer_notes' && k !== 'reference_images' && k !== 'karat').length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Custom Specs Details</p>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  {Object.entries(order.custom_attributes)
                    .filter(([k]) => k !== 'customer_notes' && k !== 'reference_images' && k !== 'karat')
                    .map(([k, v]) => (
                      <div key={k} className="border-b border-stone-50 pb-1">
                        <dt className="text-stone-400 capitalize">{k.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold text-stone-850 mt-0.5">{String(v)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            {/* Customer Notes */}
            {(order.customer_notes || order.custom_attributes?.customer_notes) && (
              <div className="space-y-1.5 pt-3 border-t border-stone-100 text-xs">
                <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Customer Brief/Notes</p>
                <p className="text-stone-850 font-semibold leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-150">
                  {order.customer_notes || order.custom_attributes?.customer_notes}
                </p>
              </div>
            )}

            {/* Custom Brief Images */}
            {order.custom_attributes?.reference_images && order.custom_attributes.reference_images.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-stone-100">
                <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Reference Brief Images</p>
                <div className="flex gap-2 flex-wrap">
                  {order.custom_attributes.reference_images.map((url: string, idx: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 hover:border-amber-600 transition-all shrink-0">
                      <img src={url} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Shipping Address */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-stone-400" /> Shipping Destination (Dropship)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Recipient Name</p>
                <p className="font-semibold text-stone-850 mt-1">{order.shipping_name}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Contact Phone</p>
                <p className="font-semibold text-stone-850 mt-1">{order.shipping_phone}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Delivery Address</p>
                <p className="font-semibold text-stone-850 mt-1 leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-150">{order.shipping_address}</p>
              </div>
            </div>
          </div>

          {/* Courier tracking details if dispatched */}
          {order.status === 'dispatched' && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl shadow-sm space-y-2">
              <p className="font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-600" /> Package Dispatched!
              </p>
              <div className="text-xs leading-relaxed">
                <p>Your dropship parcel has been shipped to your customer.</p>
                {order.tracking_number && (
                  <p className="mt-1 font-semibold">
                    Courier: {order.courier || 'Express'} | Tracking ID: <span className="font-mono text-stone-900 bg-white border border-stone-200 px-1 py-0.5 rounded">{order.tracking_number}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Payments & Financials */}
        <div className="md:col-span-5 space-y-6">
          {/* Financial summary card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-stone-400" /> Margin Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                <span>Wholesale Cost (Floor):</span>
                <span className="font-bold text-stone-900">₹{costRupees.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-50 text-stone-600">
                <span>Your Customer Price:</span>
                <span className="font-bold text-green-650">₹{sellingPriceRupees.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold text-green-700">
                <span>Your Margin Profit:</span>
                <span>₹{earningsRupees.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Storefront Actions block */}
          {order.status === 'customer_placed' && (
            <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-indigo-900 text-sm pb-2 border-b border-indigo-50 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-650" /> Storefront Order Action Required
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-semibold">
                This order was placed by a storefront shopper. Review the custom details on the left, then accept or reject.
              </p>
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConfirmStorefrontOrder}
                  className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1 transition-colors"
                >
                  <Check className="w-4 h-4" /> Confirm &amp; Accept Order
                </button>
                
                <div className="border-t border-stone-100 pt-3">
                  <p className="text-[10px] text-stone-400 font-bold uppercase mb-2">Reject Order</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="rejection_reason_input"
                      placeholder="Reason for cancellation..."
                      className="flex-1 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500/20 focus:border-red-650 bg-white"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('rejection_reason_input') as HTMLInputElement
                        const reason = input?.value || 'Cancelled by boutique'
                        handleRejectStorefrontOrder(reason)
                      }}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer Payment Status Card */}
          {order.status !== 'cancelled' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-stone-400" /> Customer Payment Status
              </h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Retail Payment Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  order.customer_payment_status === 'paid'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-yellow-50 text-yellow-750 border-yellow-250'
                }`}>
                  {order.customer_payment_status === 'paid' ? 'Paid / Received' : 'Pending / Unpaid'}
                </span>
              </div>
              {order.customer_payment_status !== 'paid' && (
                <button
                  type="button"
                  onClick={handleMarkCustomerPaid}
                  className="w-full mt-2 bg-stone-900 hover:bg-stone-850 text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-colors"
                >
                  Mark Customer Paid Offline
                </button>
              )}
            </div>
          )}

          {/* Payment submission form */}
          {order.status === 'payment_pending' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h3 className="font-bold text-stone-900 text-sm">Submit Payment Proof</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isOverdue ? 'Overdue' : 'Pending'}
                </span>
              </div>

              {isOverdue ? (
                <div className="bg-red-50 border border-red-150 p-3 rounded-xl text-[11px] text-red-800 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-red-650 inline mr-1" />
                  This order's payment deadline of {new Date(order.payment_deadline).toLocaleString('en-IN')} has passed. Upload proof immediately to request exception or avoid automatic cancellation.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-stone-500 text-xs">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Deadline: {new Date(order.payment_deadline).toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* Payment Details QR trigger */}
              <div className="p-3 bg-stone-50 border border-stone-150 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500">Remit floor cost to Shewah:</span>
                  <span className="font-bold text-stone-850">₹{costRupees.toLocaleString('en-IN')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="w-full bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" /> {showQR ? 'Hide UPI QR Code' : 'Display UPI QR Code'}
                </button>

                {showQR && (
                  <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col items-center space-y-2 text-center">
                    {/* Placeholder dynamic QR */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=shewah@ybl&pn=ShewahB2B&am=${costRupees}&cu=INR`
                      )}`}
                      alt="UPI QR Code"
                      className="w-36 h-36 border border-stone-100 p-1"
                    />
                    <p className="text-[10px] text-stone-400 font-semibold leading-none">UPI: shewah@ybl</p>
                    <p className="text-[9px] text-stone-400">Scan code on PhonePe/GPay to remit</p>
                  </div>
                )}
              </div>

              {/* Upload Form */}
              <form onSubmit={handleConfirmSubmit} className="space-y-4 pt-1">
                <div>
                  <label className={lbl}>Payment Channel</label>
                  <select
                    className={inp}
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="upi">UPI Transfer</option>
                    <option value="bank_transfer">IMPS / Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className={lbl}>Transaction Ref / UTR ID</label>
                  <input
                    type="text"
                    className={inp}
                    placeholder="Enter 12-digit UTR ID..."
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>

                <div>
                  <label className={lbl}>Proof Screenshot *</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer shadow-sm">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleScreenshotUpload(e.target.files)}
                        disabled={uploading}
                      />
                      <Camera className="w-4 h-4 text-stone-500" /> Select Image
                    </label>
                    <span className="text-[10px] text-stone-400 font-semibold truncate max-w-[120px]">
                      {uploading ? 'Uploading...' : screenshotUrl ? 'Image selected!' : 'No screenshot selected'}
                    </span>
                  </div>
                  {screenshotUrl && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 mt-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotUrl} alt="payment proof" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setScreenshotUrl('')}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1 transition-colors disabled:opacity-50 mt-2"
                >
                  <Check className="w-4 h-4" /> {submitting ? 'Submitting proof...' : 'Submit Payment Proof'}
                </button>
              </form>
            </div>
          )}

          {/* Uploaded Payments history list */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-stone-400" /> Transaction Requests
            </h3>
            {payments.length === 0 ? (
              <p className="text-stone-400 text-xs py-2">No payment transactions uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => {
                  const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-50 text-yellow-750 border-yellow-200',
                    confirmed: 'bg-green-50 text-green-700 border-green-200',
                    rejected: 'bg-red-50 text-red-700 border-red-200',
                  }
                  return (
                    <div key={p.id} className="p-3 bg-stone-50 border border-stone-150 rounded-xl flex items-center justify-between text-xs gap-3">
                      <div>
                        <p className="font-bold text-stone-850">₹{(p.amount_paise / 100).toLocaleString('en-IN')} via {p.payment_method.toUpperCase()}</p>
                        <p className="text-[10px] text-stone-450 mt-0.5 font-mono">Ref: {p.transaction_reference || '—'}</p>
                        <p className="text-[9px] text-stone-400 mt-0.5">Uploaded: {new Date(p.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
