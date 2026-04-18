'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, ChevronRight, Check, Package } from 'lucide-react'
import Link from 'next/link'

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, partners(store_name, owner_name, phone, city), products(code, name)')
      .eq('id', id)
      .single()
    if (!data) { router.push('/orders'); return }
    setOrder(data)
    setForm(data)
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  const currentStageIdx = ORDER_STATUSES.findIndex(s => s.value === order?.status)
  const nextStage = currentStageIdx < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[currentStageIdx + 1] : null

  async function advanceStage() {
    if (!nextStage) return
    setAdvancing(true)
    const update: any = { status: nextStage.value }
    if (nextStage.value === 'dispatched') {
      update.dispatch_date = new Date().toISOString().split('T')[0]
    }
    if (nextStage.value === 'delivered') {
      update.actual_delivery = new Date().toISOString().split('T')[0]
    }
    const { error } = await supabase.from('orders').update(update).eq('id', id)
    setAdvancing(false)
    if (error) { alert('Error: ' + error.message); return }
    load()
  }

  async function handleSave() {
    setSaving(true)
    const balanceDue = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)
    const { error } = await supabase.from('orders').update({
      status: form.status,
      quantity: parseInt(form.quantity) || 1,
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      trade_price: parseFloat(form.trade_price) || null,
      total_amount: parseFloat(form.total_amount) || null,
      advance_paid: parseFloat(form.advance_paid) || 0,
      balance_due: balanceDue,
      expected_delivery: form.expected_delivery || null,
      internal_notes: form.internal_notes || null,
      tracking_number: form.tracking_number || null,
      courier: form.courier || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  async function handleDelete() {
    // Clear FK references first to avoid constraint violations
    await Promise.all([
      supabase.from('manufacturing_orders').update({ customer_order_id: null }).eq('customer_order_id', id),
      supabase.from('cad_requests').update({ order_id: null }).eq('order_id', id),
    ])
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/orders')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/orders" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{order.order_number}</h1>
          <p className="text-stone-400 text-sm">{order.partners?.store_name} · {order.partners?.city}</p>
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
                <Trash2 className="w-4 h-4" />
              </button>
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

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this order?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{order.order_number}</strong>? This cannot be undone.
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

      {!editing ? (
        <div className="space-y-4">
          {/* ── Pipeline stepper ── */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-stone-900">Pipeline stage</h2>
              {nextStage && !isCancelled && (
                <button onClick={advanceStage} disabled={advancing}
                  className="flex items-center gap-1.5 bg-[#C49C64] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
                  {advancing ? 'Moving...' : `Move to ${nextStage.label}`}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {isDelivered && (
                <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                  Order complete
                </span>
              )}
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-0">
              {ORDER_STATUSES.map((stage, idx) => {
                const isDone = currentStageIdx > idx
                const isActive = currentStageIdx === idx
                const isLast = idx === ORDER_STATUSES.length - 1
                return (
                  <div key={stage.value} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 transition-colors ${
                        isDone ? 'bg-[#C49C64] border-[#C49C64] text-white'
                        : isActive ? 'bg-white border-[#C49C64] text-[#C49C64]'
                        : 'bg-white border-stone-200 text-stone-300'
                      }`}>
                        {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                      <p className={`text-center mt-1 leading-tight text-[10px] hidden sm:block truncate max-w-full px-0.5 ${
                        isActive ? 'text-[#C49C64] font-semibold'
                        : isDone ? 'text-stone-400'
                        : 'text-stone-300'
                      }`}>{stage.label}</p>
                    </div>
                    {!isLast && (
                      <div className={`h-0.5 flex-shrink-0 w-full max-w-6 mt-0 mb-4 sm:mb-5 transition-colors ${
                        isDone ? 'bg-[#C49C64]' : 'bg-stone-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order details */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Partner', order.partners?.store_name],
                ['Owner', order.partners?.owner_name],
                ['Phone', order.partners?.phone],
                ['Product', order.products ? `${order.products.code} — ${order.products.name}` : 'Custom design'],
                ['Type', order.type],
                ['Model', order.model?.replace(/_/g, ' ')],
                ['Quantity', order.quantity],
                ['Ring size', order.ring_size || '—'],
                ['Order date', formatDate(order.order_date)],
                ['Expected delivery', order.expected_delivery ? formatDate(order.expected_delivery) : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v || '—')}</p>
                </div>
              ))}
              {order.special_notes && (
                <div className="col-span-2">
                  <p className="text-xs text-stone-400">Special notes</p>
                  <p className="text-stone-800 mt-0.5">{order.special_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Pricing & payment</h2>
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              {[
                ['Trade price', `₹${order.trade_price?.toLocaleString('en-IN') || '—'}`],
                ['Total amount', `₹${order.total_amount?.toLocaleString('en-IN') || '—'}`],
                ['Advance paid', `₹${(order.advance_paid || 0).toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 font-medium mt-0.5">{String(v)}</p>
                </div>
              ))}
            </div>
            {(order.balance_due || 0) > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                <span className="text-amber-700 text-sm">Balance due at delivery</span>
                <span className="font-semibold text-amber-800">₹{order.balance_due?.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                <span className="text-green-700 text-sm">Fully paid</span>
                <Check className="w-4 h-4 text-green-600" />
              </div>
            )}
            {order.gold_rate_at_order > 0 && (
              <p className="text-xs text-stone-400 mt-2">Gold rate locked: ₹{order.gold_rate_at_order?.toLocaleString('en-IN')}/g (24K)</p>
            )}
          </div>

          {/* Dispatch info (shown once dispatched or beyond) */}
          {(currentStageIdx >= ORDER_STATUSES.findIndex(s => s.value === 'dispatched')) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-600" /> Dispatch details
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  ['Dispatch date', order.dispatch_date ? formatDate(order.dispatch_date) : '—'],
                  ['Actual delivery', order.actual_delivery ? formatDate(order.actual_delivery) : '—'],
                  ['Courier', order.courier || '—'],
                  ['Tracking number', order.tracking_number || '—'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-xs text-stone-400">{k}</p>
                    <p className="text-stone-800 mt-0.5">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal notes */}
          {order.internal_notes && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-2">Internal notes</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{order.internal_notes}</p>
            </div>
          )}
        </div>

      ) : (
        /* Edit mode */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Update order</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Pipeline stage</label>
                <select className={inp} value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  {ORDER_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Quantity</label>
                <input type="number" inputMode="decimal" min="1" className={inp} value={form.quantity || ''} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Ring size</label>
                <input className={inp} value={form.ring_size || ''} onChange={e => set('ring_size', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Trade price (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.trade_price || ''} onChange={e => set('trade_price', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Total amount (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.total_amount || ''} onChange={e => set('total_amount', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Advance paid (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.advance_paid || ''} onChange={e => set('advance_paid', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Expected delivery</label>
                <input type="date" className={inp} value={form.expected_delivery || ''} onChange={e => set('expected_delivery', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Courier</label>
                <input className={inp} value={form.courier || ''} onChange={e => set('courier', e.target.value)} placeholder="e.g. Blue Dart, DTDC" />
              </div>
              <div>
                <label className={lbl}>Tracking number</label>
                <input className={inp} value={form.tracking_number || ''} onChange={e => set('tracking_number', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Special notes</label>
                <input className={inp} value={form.special_notes || ''} onChange={e => set('special_notes', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Internal notes</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
