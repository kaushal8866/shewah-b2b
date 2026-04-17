'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES } from '@/lib/supabase'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import {
  ArrowLeft, Save, Edit2, X, Truck, IndianRupee,
  CheckCircle2, Clock, Package, Phone, MessageCircle,
  ChevronRight, AlertCircle, Copy, Check, Trash2,
  AlertTriangle, ShieldCheck, FileText
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { PIDocument } from '@/lib/pi-generator'

type OrderDetail = {
  id: string
  order_number: string
  partner_id?: string
  product_id?: string
  type: string
  model: string
  quantity: number
  ring_size?: string
  special_notes?: string
  brief_text?: string
  gold_rate_at_order?: number
  trade_price: number
  total_amount: number
  advance_paid: number
  balance_due: number
  status: string
  order_date: string
  expected_delivery?: string
  actual_delivery?: string
  tracking_number?: string
  courier?: string
  dispatch_date?: string
  internal_notes?: string
  advance_reference_number?: string
  gov_status?: string
  gov_notes?: string
  expires_at?: string
  partners?: { id: string; store_name: string; owner_name: string; phone: string; city: string; address?: string; state: string; pincode?: string; gstin?: string }
  products?: { id: string; code: string; name: string; gold_karat?: number; gold_weight_mg?: number }
}

type PaymentEntry = {
  id: string
  order_id: string
  amount: number
  method: string
  date: string
  notes?: string
  created_at: string
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { toast } = useToast()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Payment recording
  const [showPayment, setShowPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Dispatch info
  const [showDispatch, setShowDispatch] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [courier, setCourier] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, partners(*), products(*)')
      .eq('id', id)
      .single()
    if (!data) { router.push('/orders'); return }
    setOrder(data as OrderDetail)
    setForm(data)
    setLoading(false)
  }

  async function updateStatus(newStatus: string) {
    if (newStatus === 'delivered' && (order?.balance_due || 0) > 0) {
      if (!confirm(`Warning: This order has a balance due of ${formatCurrency(order?.balance_due || 0)}. Mark as delivered anyway?`)) {
        return
      }
    }

    const updates: Record<string, any> = { status: newStatus }
    if (newStatus === 'delivered') {
      updates.actual_delivery = new Date().toISOString().split('T')[0]
    }
    await supabase.from('orders').update(updates).eq('id', id)
    toast(`Status updated to ${newStatus.replace(/_/g, ' ')}`, 'success')
    load()
  }

  async function handleDelete() {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Order deleted', 'success')
    router.push('/orders')
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('orders').update({
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      expected_delivery: form.expected_delivery || null,
      internal_notes: form.internal_notes || null,
      trade_price: parseFloat(form.trade_price),
      total_amount: parseFloat(form.total_amount),
    }).eq('id', id)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setEditing(false)
    toast('Order updated', 'success')
    load()
  }

  async function recordPayment() {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return }

    setSavingPayment(true)
    const newAdvance = (order?.advance_paid || 0) + amount
    const newBalance = (order?.total_amount || 0) - newAdvance

    const { error } = await supabase.from('orders').update({
      advance_paid: newAdvance,
      balance_due: Math.max(0, newBalance),
    }).eq('id', id)

    setSavingPayment(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setShowPayment(false)
    setPaymentAmount('')
    setPaymentNotes('')
    toast(`₹${amount.toLocaleString('en-IN')} payment recorded`, 'success')
    load()
  }

  async function saveDispatch() {
    const { error } = await supabase.from('orders').update({
      tracking_number: trackingNumber || null,
      courier: courier || null,
      dispatch_date: new Date().toISOString().split('T')[0],
      status: 'dispatched',
    }).eq('id', id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setShowDispatch(false)
    toast('Dispatch info saved', 'success')
    load()
  }

  function copyOrderNumber() {
    navigator.clipboard.writeText(order?.order_number || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-7 text-stone-400 text-sm">Loading order...</div>
  if (!order) return null

  const currentIndex = ORDER_STATUSES.findIndex(s => s.value === order.status)
  const nextStatus = currentIndex < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[currentIndex + 1] : null
  const isDelivered = order.status === 'delivered'
  const isOverdue = order.expected_delivery && new Date(order.expected_delivery) < new Date() && !isDelivered
  const daysLeft = order.expected_delivery
    ? Math.ceil((new Date(order.expected_delivery).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="p-4 lg:p-7 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/orders" className="text-stone-400 hover:text-stone-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-900">{order.order_number}</h1>
            <button onClick={copyOrderNumber} className="text-stone-300 hover:text-stone-600">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <span className={`status-pill ${getStatusColor(order.status)}`}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-stone-400 text-sm mt-0.5">
            {order.type} · {order.model?.replace(/_/g, ' ')} · Created {formatDate(order.order_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
              </button>
              {order && order.partners && (
                <PDFDownloadLink
                  document={<PIDocument order={order as any} partner={order.partners as any} product={order.products as any} piNumber={order.order_number} />}
                  fileName={`PI-${order.order_number}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <button
                      className="flex items-center gap-1.5 bg-stone-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-black transition-colors"
                      disabled={pdfLoading}
                    >
                      <FileText className="w-4 h-4" />
                      {pdfLoading ? 'Preparing PI...' : 'Generate PI'}
                    </button>
                  )}
                </PDFDownloadLink>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(order) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Governance Banner */}
      {order.gov_status && order.gov_status !== 'auto_approved' && (
        <div className={`mb-5 p-4 rounded-xl border flex items-start gap-3 ${
          order.gov_status === 'pending_approval' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          order.gov_status === 'approved' ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {order.gov_status === 'approved' ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div>
            <p className="text-sm font-semibold capitalize">
              Governance: {order.gov_status.replace(/_/g, ' ')}
            </p>
            {order.gov_notes && <p className="text-xs mt-0.5 opacity-80">{order.gov_notes}</p>}
          </div>
        </div>
      )}

      {/* Rate Lock Banner */}
      {order.advance_paid === 0 && order.expires_at && (
        <div className={`mb-5 p-4 rounded-xl border flex items-start gap-3 ${
          new Date(order.expires_at) > new Date() ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <Clock className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {new Date(order.expires_at) > new Date() ? 'Gold Rate Locked' : 'Rate Lock Expired'}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {new Date(order.expires_at) > new Date() 
                ? `Pricing is valid until ${formatDate(order.expires_at)} ${new Date(order.expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Confirm advance to finalize.`
                : 'The 24-hour window for this rate has closed. Production will require a rate refresh.'}
            </p>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this order?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete order <strong>{order.order_number}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Status pipeline */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-5">
        <div className="flex gap-1">
          {ORDER_STATUSES.map((s, i) => {
            const isPast = i <= currentIndex
            const isCurrent = s.value === order.status
            return (
              <div key={s.value} className="flex-1 text-center">
                <div className={`rounded py-1.5 text-xs font-medium transition-all ${
                  isCurrent ? 'bg-[#C49C64] text-white' :
                  isPast ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'
                }`}>
                  {isCurrent ? '●' : isPast ? '✓' : '○'}
                </div>
                <p className={`text-xs mt-1 truncate ${isCurrent ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>
                  {s.label}
                </p>
              </div>
            )
          })}
        </div>

        {/* Action buttons */}
        {!isDelivered && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
            {nextStatus && nextStatus.value !== 'dispatched' && (
              <button onClick={() => updateStatus(nextStatus.value)}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40]">
                <ChevronRight className="w-4 h-4" />
                Move to: {nextStatus.label}
              </button>
            )}
            {(order.status === 'qc' || order.status === 'dispatched') && order.status !== 'dispatched' && (
              <button onClick={() => setShowDispatch(true)}
                className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
                <Truck className="w-4 h-4" /> Dispatch
              </button>
            )}
            {order.status === 'dispatched' && (
              <button onClick={() => updateStatus('delivered')}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4" /> Mark Delivered
              </button>
            )}
            <button onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm hover:bg-stone-50">
              <IndianRupee className="w-4 h-4" /> Record payment
            </button>
          </div>
        )}
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
          <h3 className="font-medium text-stone-900 mb-3">Record payment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Amount (₹) *</label>
              <input type="number" className={inp} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                placeholder={`Max: ₹${(order.balance_due || 0).toLocaleString('en-IN')}`} />
            </div>
            <div>
              <label className={lbl}>Method</label>
              <select className={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input className={inp} value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. final payment" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={recordPayment} disabled={savingPayment}
              className="bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
              {savingPayment ? 'Saving...' : 'Save payment'}
            </button>
            <button onClick={() => setShowPayment(false)} className="text-stone-500 text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      {/* Dispatch modal */}
      {showDispatch && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
          <h3 className="font-medium text-stone-900 mb-3">Dispatch details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Courier</label>
              <select className={inp} value={courier} onChange={e => setCourier(e.target.value)}>
                <option value="">Select...</option>
                <option value="DTDC">DTDC</option>
                <option value="Delhivery">Delhivery</option>
                <option value="BlueDart">BlueDart</option>
                <option value="IndiaPost">India Post</option>
                <option value="HandDelivery">Hand delivery</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Tracking number</label>
              <input className={inp} value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="e.g. AWB123456" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveDispatch} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
              Save & mark dispatched
            </button>
            <button onClick={() => setShowDispatch(false)} className="text-stone-500 text-sm px-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — Order info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Partner info */}
          {order.partners && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">Partner</h2>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-900">{order.partners.store_name}</p>
                  <p className="text-xs text-stone-400">{order.partners.owner_name} · {order.partners.city}</p>
                </div>
                <div className="flex gap-1.5">
                  <a href={`tel:${order.partners.phone}`}
                    className="p-2 rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:bg-stone-50">
                    <Phone className="w-4 h-4" />
                  </a>
                  <a href={`https://wa.me/${order.partners.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="p-2 rounded-lg border border-green-200 text-green-600 hover:bg-green-50">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <Link href={`/partners/${order.partner_id}`}
                    className="p-2 rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:bg-stone-50">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Order details */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Order details</h2>
            {!editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  ['Product', order.products ? `${order.products.code} — ${order.products.name}` : 'Custom design'],
                  ['Type', `${order.type} · ${order.model?.replace(/_/g, ' ')}`],
                  ['Quantity', order.quantity],
                  ['Ring size', order.ring_size || '—'],
                  ['Special notes', order.special_notes || '—'],
                  ['Gold rate at order', order.gold_rate_at_order ? `₹${order.gold_rate_at_order.toLocaleString('en-IN')}/g` : '—'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-xs text-stone-400">{k}</p>
                    <p className="text-stone-800 mt-0.5">{String(v)}</p>
                  </div>
                ))}
                {order.advance_reference_number && (
                  <div>
                    <p className="text-xs text-stone-400">Advance ref #</p>
                    <p className="text-[#9B7A40] font-mono font-medium mt-0.5">{order.advance_reference_number}</p>
                  </div>
                )}
                {order.brief_text && (
                  <div className="col-span-2">
                    <p className="text-xs text-stone-400">Design brief</p>
                    <p className="text-stone-800 mt-0.5">{order.brief_text}</p>
                  </div>
                )}
                {order.internal_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-stone-400">Internal notes</p>
                    <p className="text-stone-600 mt-0.5 text-xs italic">{order.internal_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Ring size</label>
                  <input className={inp} value={form.ring_size || ''} onChange={e => setForm(prev => ({ ...prev, ring_size: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Expected delivery</label>
                  <input type="date" className={inp} value={form.expected_delivery || ''} onChange={e => setForm(prev => ({ ...prev, expected_delivery: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Trade price (₹)</label>
                  <input type="number" className={inp} value={form.trade_price || ''} onChange={e => setForm(prev => ({ ...prev, trade_price: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Total amount (₹)</label>
                  <input type="number" className={inp} value={form.total_amount || ''} onChange={e => setForm(prev => ({ ...prev, total_amount: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Special notes</label>
                  <input className={inp} value={form.special_notes || ''} onChange={e => setForm(prev => ({ ...prev, special_notes: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Internal notes</label>
                  <textarea className={`${inp} resize-none`} rows={2} value={form.internal_notes || ''} onChange={e => setForm(prev => ({ ...prev, internal_notes: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          {/* Dispatch details */}
          {(order.tracking_number || order.dispatch_date) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-600" /> Dispatch info
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-stone-400">Courier</p>
                  <p className="text-stone-800 mt-0.5">{order.courier || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">Tracking #</p>
                  <p className="text-stone-800 mt-0.5 font-mono">{order.tracking_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">Dispatch date</p>
                  <p className="text-stone-800 mt-0.5">{order.dispatch_date ? formatDate(order.dispatch_date) : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Financial summary */}
        <div className="space-y-5">
          {/* Financial card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Payment</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Trade price</span>
                <span className="text-stone-800 font-medium">{formatCurrency(order.trade_price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Total amount</span>
                <span className="text-stone-800 font-medium">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Paid</span>
                <span className="text-green-600 font-medium">{formatCurrency(order.advance_paid)}</span>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <div className={`flex justify-between text-sm font-medium ${(order.balance_due || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  <span>Balance due</span>
                  <span>{formatCurrency(order.balance_due || 0)}</span>
                </div>
              </div>
              {(order.balance_due || 0) > 0 && !isDelivered && (
                <button onClick={() => setShowPayment(true)}
                  className="w-full mt-2 bg-stone-100 text-stone-700 py-2 rounded-lg text-sm hover:bg-stone-200 transition-colors">
                  + Record payment
                </button>
              )}
            </div>
          </div>

          {/* Delivery info */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Delivery</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Order date</span>
                <span className="text-stone-800">{formatDate(order.order_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Expected</span>
                <span className={`${isOverdue ? 'text-red-600 font-medium' : 'text-stone-800'}`}>
                  {order.expected_delivery ? formatDate(order.expected_delivery) : '—'}
                </span>
              </div>
              {order.actual_delivery && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Delivered</span>
                  <span className="text-green-600">{formatDate(order.actual_delivery)}</span>
                </div>
              )}
              {daysLeft !== null && !isDelivered && (
                <div className={`mt-2 p-2 rounded-lg text-xs text-center font-medium ${
                  isOverdue ? 'bg-red-50 text-red-600' :
                  daysLeft <= 3 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                }`}>
                  {isOverdue
                    ? `⚠ Overdue by ${Math.abs(daysLeft)} days`
                    : `${daysLeft} days remaining`}
                </div>
              )}
              {isDelivered && (
                <div className="mt-2 p-2 rounded-lg text-xs text-center font-medium bg-green-50 text-green-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
