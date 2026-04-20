'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES, computeOrderCogs } from '@/lib/supabase'
import { cascadeOrderStatusToMfg } from '@/lib/mfgOrderLifecycle'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, ChevronRight, Check, Package, Layers, AlertTriangle, MessageSquare, CreditCard, Bell, Plus } from 'lucide-react'
import Link from 'next/link'

function OrderChangeRequestsPanel({ orderId, onApplied }: { orderId: string, onApplied: () => void }) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/order-change-requests?order_id=${orderId}`)
      const d = await r.json()
      if (r.ok) setRequests(d.requests || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId])

  async function review(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    try {
      const r = await fetch(`/api/order-change-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_note: reviewNote.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error || 'Could not save.'); return }
      setReviewNote(''); setActiveId(null)
      load()
      if (action === 'approve') onApplied()
    } finally { setBusyId(null) }
  }

  if (loading) return null
  if (requests.length === 0) return null

  const labels: Record<string, string> = {
    quantity: 'Quantity', ring_size: 'Ring size', special_notes: 'Notes', brief_text: 'Brief',
  }
  const pending = requests.filter(r => r.status === 'pending')
  const recent = requests.filter(r => r.status !== 'pending').slice(0, 3)

  return (
    <div className="mb-6 bg-white border border-stone-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-stone-500" />
        <h3 className="font-medium text-stone-900">Change requests from retailer</h3>
        {pending.length > 0 && (
          <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
            {pending.length} pending
          </span>
        )}
      </div>
      <div className="space-y-3">
        {pending.map(r => (
          <div key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
            <div className="text-[12px] text-stone-500 mb-2">
              {r.partner?.store_name || 'Retailer'} · {r.requester?.display_name || r.requester?.username || ''} · {new Date(r.created_at).toLocaleString('en-IN')}
            </div>
            <div className="text-sm space-y-1 mb-2">
              {Object.entries(r.changes || {}).map(([k, v]) => {
                const current = r.order ? (r.order as any)[k] : undefined
                return (
                  <div key={k} className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-stone-500 text-xs w-20">{labels[k] || k}:</span>
                    <span className="text-stone-400 line-through text-xs">{String(current ?? '—')}</span>
                    <ChevronRight className="w-3 h-3 text-stone-400" />
                    <span className="font-medium text-stone-900">{String(v ?? '—')}</span>
                  </div>
                )
              })}
              {Object.keys(r.changes || {}).length === 0 && (
                <p className="text-xs text-stone-500 italic">No field changes — review the note below.</p>
              )}
            </div>
            {r.retailer_note && (
              <p className="text-[13px] text-stone-700 bg-white rounded-md p-2 border border-stone-200 mb-2">
                <span className="text-stone-400 text-xs">Note: </span>{r.retailer_note}
              </p>
            )}
            {activeId === r.id ? (
              <div className="space-y-2">
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2}
                  placeholder="Optional reply to the retailer"
                  className="w-full text-sm border border-stone-200 rounded-md px-2 py-1.5 outline-none focus:border-[#1E3A5F] resize-none" />
                <div className="flex gap-2">
                  <button disabled={busyId === r.id} onClick={() => review(r.id, 'reject')}
                    className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reject
                  </button>
                  <button disabled={busyId === r.id} onClick={() => review(r.id, 'approve')}
                    className="text-sm px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white hover:bg-[#16304F] disabled:opacity-50">
                    {busyId === r.id ? 'Saving...' : 'Approve & apply'}
                  </button>
                  <button onClick={() => { setActiveId(null); setReviewNote('') }}
                    className="text-sm px-3 py-1.5 rounded-md text-stone-500 hover:bg-stone-100">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setActiveId(r.id)}
                className="text-sm bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md hover:bg-[#16304F]">
                Review
              </button>
            )}
          </div>
        ))}
        {recent.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-stone-500 hover:text-stone-700 text-xs">Recent decisions</summary>
            <div className="mt-2 space-y-2">
              {recent.map(r => (
                <div key={r.id} className="text-[12px] text-stone-600 border-l-2 pl-2"
                  style={{ borderColor: r.status === 'approved' ? '#10b981' : '#ef4444' }}>
                  <span className={`font-medium ${r.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                    {r.status}
                  </span>{' '}· {r.reviewer?.display_name || r.reviewer?.username || 'Admin'} · {new Date(r.reviewed_at || r.created_at).toLocaleDateString('en-IN')}
                  {r.review_note && <span className="text-stone-500"> — {r.review_note}</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

// Modal that opens when the admin tries to dispatch with an outstanding
// balance, or via the "+ Log payment" button on the pricing card.
// Two paths:
//   1. Log a payment now (amount + date + reference + method)
//   2. Schedule a reminder (collect in N days) — only available in dispatch
//      mode so dispatched orders can ship on time
function PaymentModal({
  mode, balanceDue, orderNumber,
  onClose, onLogPayment, onScheduleReminder, onContinueDispatch,
}: {
  mode: 'dispatch' | 'standalone'
  balanceDue: number
  orderNumber?: string
  onClose: () => void
  onLogPayment: (input: { amount: number; payment_date: string; reference?: string | null; method?: string | null; notes?: string | null }) => Promise<{ ok: boolean; error?: string }>
  onScheduleReminder: (days: number) => Promise<{ ok: boolean; error?: string }>
  onContinueDispatch: () => void
}) {
  const [tab, setTab] = useState<'log' | 'remind'>('log')
  const [amount, setAmount] = useState(String(balanceDue))
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('upi')
  const [notes, setNotes] = useState('')
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  async function handleLog() {
    setBusy(true); setError('')
    const r = await onLogPayment({
      amount: parseFloat(amount),
      payment_date: date,
      reference: reference.trim() || null,
      method,
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (!r.ok) { setError(r.error || 'Could not save'); return }
    if (mode === 'dispatch') {
      // If the logged amount fully clears the balance, dispatch immediately.
      // Otherwise the admin can still ship by switching to Schedule reminder.
      if (parseFloat(amount) >= balanceDue) onContinueDispatch()
      else onClose()
    } else {
      onClose()
    }
  }
  async function handleSchedule() {
    setBusy(true); setError('')
    const r = await onScheduleReminder(parseInt(days) || 7)
    setBusy(false)
    if (!r.ok) { setError(r.error || 'Could not save reminder'); return }
    onContinueDispatch()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-start gap-3 mb-3">
          <CreditCard className="w-5 h-5 text-[#1E3A5F] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-900">
              {mode === 'dispatch' ? 'Confirm payment before dispatch' : 'Log payment'}
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              {mode === 'dispatch'
                ? `Order ${orderNumber || ''} has ₹${balanceDue.toLocaleString('en-IN')} pending. Record what you've collected, or schedule a reminder.`
                : `Outstanding balance: ₹${balanceDue.toLocaleString('en-IN')}.`}
            </p>
          </div>
        </div>

        {mode === 'dispatch' && (
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1 mb-4">
            <button onClick={() => setTab('log')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md ${tab === 'log' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Payment received
            </button>
            <button onClick={() => setTab('remind')}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md ${tab === 'remind' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Collect later
            </button>
          </div>
        )}

        {(mode === 'standalone' || tab === 'log') && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Amount (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Date</label>
                <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Method</label>
                <select className={inp} value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Reference / UTR</label>
                <input className={inp} value={reference} onChange={e => setReference(e.target.value)} placeholder="UTR / cheque no" />
              </div>
            </div>
            <div>
              <label className={lbl}>Notes (optional)</label>
              <input className={inp} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {mode === 'dispatch' && tab === 'remind' && (
          <div className="space-y-3">
            <div>
              <label className={lbl}>Collect in (days)</label>
              <input type="number" inputMode="numeric" min="1" className={inp} value={days} onChange={e => setDays(e.target.value)} />
              <p className="text-[11px] text-stone-400 mt-1">
                We'll flag the order on {(() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(days) || 7)); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) })()} and re-prompt you to confirm a new date with the retailer if it's still unpaid.
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50 disabled:opacity-50">
            Cancel
          </button>
          {(mode === 'standalone' || tab === 'log') ? (
            <button onClick={handleLog} disabled={busy}
              className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
              {busy ? 'Saving...' : (mode === 'dispatch' && parseFloat(amount) >= balanceDue ? 'Log & dispatch' : 'Log payment')}
            </button>
          ) : (
            <button onClick={handleSchedule} disabled={busy}
              className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
              {busy ? 'Saving...' : 'Schedule & dispatch'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Re-prompt the admin to set a fresh due date once a payment reminder has
// passed (or whenever they want to bump it). Forces them to enter a new
// date — which they confirm with the retailer first.
function PaymentRescheduleModal({
  currentDate, onClose, onSave,
}: {
  currentDate?: string | null
  onClose: () => void
  onSave: (days: number) => Promise<void>
}) {
  // Intentionally start blank — operator must enter a *fresh* number after
  // confirming with the retailer; defaulting to '7' would let them save
  // without thinking.
  const [days, setDays] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const parsed = parseInt(days)
  const valid = !!days && Number.isFinite(parsed) && parsed >= 1
  const canSave = valid && confirmed && !busy
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-3">
          <Bell className="w-5 h-5 text-[#1E3A5F] mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-stone-900">Reschedule payment reminder</h3>
            <p className="text-sm text-stone-500 mt-1">
              {currentDate
                ? `Currently set for ${new Date(currentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. Confirm a new collection date with the retailer first.`
                : 'Set a new collection target after confirming with the retailer.'}
            </p>
          </div>
        </div>
        <div>
          <label className={lbl}>Collect in (days from today)</label>
          <input type="number" inputMode="numeric" min="1" className={inp}
            value={days} onChange={e => setDays(e.target.value)}
            placeholder="e.g. 7" autoFocus />
          {valid && (
            <p className="text-[11px] text-stone-400 mt-1">
              New due date: {(() => { const d = new Date(); d.setDate(d.getDate() + parsed); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) })()}
            </p>
          )}
          <label className="flex items-start gap-2 mt-3 text-xs text-stone-600">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5" />
            <span>I've confirmed this new date with the retailer.</span>
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={async () => { setBusy(true); await onSave(parsed); setBusy(false) }} disabled={!canSave}
            className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Saving...' : 'Save reminder'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STAGES_REQUIRING_ACTUALS = new Set(['qc', 'dispatched', 'delivered'])

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [mfgPartners, setMfgPartners] = useState<any[]>([])
  const [consumptionTxn, setConsumptionTxn] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})
  const [guardError, setGuardError] = useState<string | null>(null)
  // Surfaced when the admin tries to move an order into `production` and the
  // assigned manufacturer is short on the gold/diamond float needed for it.
  // Drives the "issue material to manufacturer" prompt modal.
  const [materialPrompt, setMaterialPrompt] = useState<null | {
    partnerId: string
    goldType: string
    goldNeeded: number
    goldHave: number
    goldShort: number
    diamondType: string
    diamondNeeded: number
    diamondHave: number
    diamondShort: number
  }>(null)
  // Payment ledger for this order + UI state for the dispatch / "+ Log
  // payment" modal and the overdue-reminder reschedule modal.
  const [payments, setPayments] = useState<any[]>([])
  const [paymentModal, setPaymentModal] = useState<null | { mode: 'dispatch' | 'standalone' }>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  useEffect(() => { load() }, [id])

  // Task #68: auto-fill `making_charges` from the assigned karigar's per-karat
  // labour rate × max(weight, min_labour_grams). To preserve admin overrides
  // we track the last value we auto-wrote in a ref — if the field still equals
  // that value (or is empty), it's safe to overwrite. The moment the admin
  // types something different, the field is "dirty" and we leave it alone.
  const autoMakingChargesRef = useRef<number | null>(null)
  useEffect(() => {
    if (!editing) { autoMakingChargesRef.current = null; return }
  }, [editing])
  useEffect(() => {
    if (!editing) return
    const partner = mfgPartners.find(p => p.id === form.assigned_manufacturer_id)
    const k = parseInt(form.gold_karat) || 0
    const rate = partner ? Number((partner as any)[`labour_rate_${k}k`]) || 0 : 0
    const wActual = parseFloat(form.gold_weight_actual) || 0
    const wEst = parseFloat(form.gold_weight_estimated) || 0
    const minG = partner ? Number((partner as any).min_labour_grams) || 1 : 1
    const w = Math.max(wActual || wEst, minG)
    const currentMC = Number(form.making_charges) || 0
    const lastAuto = autoMakingChargesRef.current
    const isDirty = currentMC !== 0 && currentMC !== lastAuto
    if (isDirty) return // admin has entered a manual override

    if (!partner || !rate || w <= 0) {
      // No data to auto-cost from. If the current value was something WE
      // last auto-filled, clear it so a stale rate from a previous partner /
      // karat doesn't quietly persist into COGS. Manual entries are left
      // alone (caught by the `isDirty` check above).
      if (lastAuto !== null && currentMC === lastAuto) {
        autoMakingChargesRef.current = null
        setForm((prev: any) => ({ ...prev, making_charges: '' }))
      }
      return
    }
    const auto = Math.round(rate * w)
    if (currentMC !== auto) {
      autoMakingChargesRef.current = auto
      setForm((prev: any) => ({ ...prev, making_charges: String(auto) }))
    } else {
      autoMakingChargesRef.current = auto
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form.assigned_manufacturer_id, form.gold_karat, form.gold_weight_actual, form.gold_weight_estimated, mfgPartners])

  async function load() {
    setLoading(true)
    const [{ data }, { data: mp }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, partners(store_name, owner_name, phone, city), products(code, name, gold_weight_g, gold_karat, diamond_weight, diamond_type)')
        .eq('id', id)
        .single(),
      supabase.from('manufacturing_partners').select('id, name, city, min_labour_grams, labour_rate_9k, labour_rate_10k, labour_rate_14k, labour_rate_18k, labour_rate_22k').order('name'),
    ])
    if (!data) { router.push('/orders'); return }
    setOrder(data)
    setForm(data)
    setMfgPartners(mp || [])

    // Payments ledger for this order (Task #69). The migration table may not
    // be present in older environments — fall through silently if so.
    try {
      const { data: pays } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', id)
        .order('payment_date', { ascending: false })
      setPayments(pays || [])
    } catch (e) {
      console.warn('[order_payments] table missing or query failed', e)
      setPayments([])
    }

    // Look for a consumption transaction for this order (used by the
    // completion guard when gold_source = self).
    const { data: tx } = await supabase
      .from('material_transactions')
      .select('id, transaction_type, quantity, manufacturing_partner_id')
      .eq('order_id', id)
      .eq('transaction_type', 'consumption')
      .limit(1)
      .maybeSingle()
    setConsumptionTxn(tx || null)

    setLoading(false)
  }

  function set(k: string, v: any) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  const currentStageIdx = ORDER_STATUSES.findIndex(s => s.value === order?.status)
  const nextStage = currentStageIdx < ORDER_STATUSES.length - 1 ? ORDER_STATUSES[currentStageIdx + 1] : null

  // Integrity rule check — returns null when OK, otherwise an error message.
  // For "dispatched" we also enforce a tracking number + courier so the
  // automatic WhatsApp dispatch ping to the retailer (fired in
  // lib/whatsappNotify.ts) always carries the shipment reference.
  function checkCompletionGuard(targetStatus: string): string | null {
    if (targetStatus === 'dispatched' || targetStatus === 'delivered') {
      // Prefer the in-flight form values when the editor is open so the
      // admin can fill tracking + advance in one save.
      const tracking = (editing ? form.tracking_number : order?.tracking_number) || ''
      const courier = (editing ? form.courier : order?.courier) || ''
      if (!tracking.toString().trim()) {
        return 'Add a tracking number before dispatching — the retailer is auto-notified on WhatsApp with this reference.'
      }
      if (!courier.toString().trim()) {
        return 'Add the courier name before dispatching — it appears in the retailer WhatsApp message.'
      }
    }
    if (!STAGES_REQUIRING_ACTUALS.has(targetStatus)) return null
    if (!order?.gold_weight_actual) return 'Gold weight (actual) must be filled before this stage.'
    if (!order?.making_charges) return 'Making charges must be filled before this stage.'
    if ((order?.gold_source || 'self') === 'self' && !consumptionTxn) {
      return 'A gold consumption entry must exist for this order before it can be moved to this stage.'
    }
    return null
  }

  // Reads the assigned manufacturer's live float and compares against what this
  // order needs. Returns null when no manufacturer is assigned, or when nothing
  // is short. Used as a soft gate before moving to `production` so the admin
  // is reminded to issue gold/diamonds if the karigar doesn't already have
  // enough on hand.
  async function checkMaterialReadiness() {
    const partnerId = order?.assigned_manufacturer_id
    if (!partnerId) return null

    const qty = parseInt(order.quantity) || 1
    const goldKarat = order.gold_karat || order.products?.gold_karat || 18
    const goldType = `gold_${goldKarat}k`
    const goldPerPiece = parseFloat(order.gold_weight_estimated) || parseFloat(order.products?.gold_weight_g) || 0
    const goldNeeded = goldPerPiece * qty

    const dType = order.products?.diamond_type === 'natural' ? 'diamond_natural' : 'diamond_lgd'
    const diamondPerPiece = parseFloat(order.products?.diamond_weight) || 0
    const diamondNeeded = diamondPerPiece * qty

    let goldHave = 0
    let diamondHave = 0
    try {
      const r = await fetch(`/api/manufacturing/partners/${partnerId}/buckets`)
      const d = await r.json()
      const buckets = Array.isArray(d?.buckets) ? d.buckets : []
      goldHave = Number(buckets.find((b: any) => b.material_type === goldType)?.available) || 0
      diamondHave = Number(buckets.find((b: any) => b.material_type === dType)?.available) || 0
    } catch (e) {
      console.error('[checkMaterialReadiness] buckets fetch failed', e)
    }

    return {
      partnerId,
      goldType,
      goldNeeded,
      goldHave,
      goldShort: Math.max(0, goldNeeded - goldHave),
      diamondType: dType,
      diamondNeeded,
      diamondHave,
      diamondShort: Math.max(0, diamondNeeded - diamondHave),
    }
  }

  async function logPayment(input: {
    amount: number
    payment_date: string
    reference?: string | null
    method?: string | null
    notes?: string | null
  }): Promise<{ ok: boolean; error?: string }> {
    if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a positive amount.' }
    const ins = await supabase.from('order_payments').insert([{
      order_id: id,
      amount: input.amount,
      payment_date: input.payment_date,
      reference: input.reference || null,
      method: input.method || null,
      notes: input.notes || null,
    }]).select('*').single()
    if ((ins as any).error) return { ok: false, error: (ins as any).error.message }

    // Recompute advance_paid by SUMming the ledger instead of trusting the
    // in-memory snapshot — protects against lost updates if two payments are
    // logged concurrently. The latest writer always sees every prior insert.
    const sumQ = await supabase.from('order_payments').select('amount').eq('order_id', id)
    if ((sumQ as any).error) {
      return { ok: false, error: 'Payment saved but totals could not be refreshed: ' + (sumQ as any).error.message }
    }
    const newAdvance = ((sumQ.data as any[]) || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const newBalance = Math.max(0, (parseFloat(order.total_amount) || 0) - newAdvance)
    const update: any = { advance_paid: newAdvance, balance_due: newBalance }
    // Once fully paid, drop the reminder.
    if (newBalance === 0) update.payment_reminder_date = null
    const upd = await supabase.from('orders').update(update).eq('id', id)
    if ((upd as any).error) {
      return { ok: false, error: 'Payment saved but order totals failed to update: ' + (upd as any).error.message }
    }
    return { ok: true }
  }

  async function schedulePaymentReminder(days: number): Promise<{ ok: boolean; error?: string }> {
    const d = new Date()
    d.setDate(d.getDate() + Math.max(1, Math.round(days)))
    const iso = d.toISOString().split('T')[0]
    const r = await supabase.from('orders').update({ payment_reminder_date: iso }).eq('id', id)
    if ((r as any).error) return { ok: false, error: (r as any).error.message }
    return { ok: true }
  }

  async function advanceStage(opts?: { skipMaterialCheck?: boolean; skipPaymentPrompt?: boolean }) {
    if (!nextStage) return
    const err = checkCompletionGuard(nextStage.value)
    if (err) { setGuardError(err); return }

    // Pre-dispatch gate: if there's still a balance owed, force the admin to
    // either log a payment (date + reference number) or schedule a reminder
    // before letting the order ship. Skipped on "confirm" from the modal.
    if (nextStage.value === 'dispatched' && !opts?.skipPaymentPrompt) {
      const balance = (parseFloat(order.balance_due) || (parseFloat(order.total_amount) || 0) - (parseFloat(order.advance_paid) || 0))
      if (balance > 0) {
        setGuardError(null)
        setPaymentModal({ mode: 'dispatch' })
        return
      }
    }

    // Pre-production gate: if a manufacturer is assigned and they're short on
    // the gold/diamonds this order needs, prompt the admin to issue material
    // (or top up the float) before flipping the order into production.
    if (nextStage.value === 'production' && !opts?.skipMaterialCheck) {
      if (!order.assigned_manufacturer_id) {
        setGuardError('Assign a manufacturer first — material has to be issued to someone before production starts.')
        return
      }
      setAdvancing(true)
      const check = await checkMaterialReadiness()
      setAdvancing(false)
      if (check && (check.goldShort > 0 || check.diamondShort > 0)) {
        setGuardError(null)
        setMaterialPrompt(check)
        return
      }
    }

    setGuardError(null)
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
    setMaterialPrompt(null)
    load()
  }

  async function handleSave() {
    // If status is being changed to a guarded stage, run integrity check.
    if (form.status !== order.status) {
      const err = checkCompletionGuard(form.status)
      if (err) { setGuardError(err); return }
      // Same payment gate that advanceStage() enforces — the edit form must
      // not become a back-door for shipping unpaid orders.
      if (form.status === 'dispatched') {
        const balance = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)
        if (balance > 0) {
          setGuardError('This order still has a balance due. Use the "Dispatch" button on the pipeline — it lets you log the payment or schedule a reminder before shipping.')
          return
        }
      }
    }
    setGuardError(null)
    setSaving(true)
    const balanceDue = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)

    // Recompute COGS + margin
    const cogs = computeOrderCogs({
      gold_weight_actual: parseFloat(form.gold_weight_actual) || 0,
      gold_rate_at_order: order.gold_rate_at_order,
      gold_karat: parseInt(form.gold_karat) || 18,
      making_charges: parseFloat(form.making_charges) || 0,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      total_amount: parseFloat(form.total_amount) || 0,
    })

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
      // COGS / gold ledger
      gold_source: form.gold_source || 'self',
      gold_karat: parseInt(form.gold_karat) || null,
      gold_weight_estimated: parseFloat(form.gold_weight_estimated) || null,
      gold_weight_actual: parseFloat(form.gold_weight_actual) || null,
      making_charges: parseFloat(form.making_charges) || null,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      assigned_manufacturer_id: form.assigned_manufacturer_id || null,
      total_cogs: Math.round(cogs.total_cogs) || null,
      margin: Math.round(cogs.margin) || null,
    }).eq('id', id)
    if (error) { setSaving(false); alert('Error: ' + error.message); return }

    if (form.status !== order.status && (form.status === 'cancelled' || form.status === 'returned')) {
      try {
        await cascadeOrderStatusToMfg({ orderId: id, newStatus: form.status })
      } catch (e) {
        console.error('cascade to mfg failed', e)
      }
    }

    setSaving(false)
    setEditing(false)
    load()
  }

  async function handleDelete() {
    await Promise.all([
      supabase.from('manufacturing_orders').update({ customer_order_id: null }).eq('customer_order_id', id),
      supabase.from('cad_requests').update({ order_id: null }).eq('order_id', id),
    ])
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/orders')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled'

  // Live computed COGS (from saved actuals)
  const savedCogs = computeOrderCogs({
    gold_weight_actual: order.gold_weight_actual,
    gold_rate_at_order: order.gold_rate_at_order,
    gold_karat: order.gold_karat,
    making_charges: order.making_charges,
    cad_cost: order.cad_cost,
    stone_cost: order.stone_cost,
    total_amount: order.total_amount,
  })

  // Build link for "Record gold consumption for this order"
  const consumptionHref = order.assigned_manufacturer_id
    ? `/manufacturing/partners/${order.assigned_manufacturer_id}/float?order_id=${id}&type=consumption&material_type=gold_${order.gold_karat || 18}k`
    : null

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
              <button onClick={() => { setEditing(false); setForm(order); setGuardError(null) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <OrderChangeRequestsPanel orderId={id} onApplied={load} />

      {materialPrompt && (() => {
        const fmtMat = (m: string) => m.replace(/_/g, ' ').replace(/^gold/, 'Gold').replace(/^diamond/, 'Diamond')
        const goldUnit = 'g'
        const diaUnit = 'ct'
        const partner = mfgPartners.find(p => p.id === materialPrompt.partnerId)
        const goldDeposit = `/manufacturing/partners/${materialPrompt.partnerId}/float?deposit=${materialPrompt.goldType}&amount=${materialPrompt.goldShort.toFixed(3)}`
        const diaDeposit = `/manufacturing/partners/${materialPrompt.partnerId}/float?deposit=${materialPrompt.diamondType}&amount=${materialPrompt.diamondShort.toFixed(3)}`
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-stone-900">Issue material before production?</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    {partner?.name || 'The assigned manufacturer'} doesn't have enough on hand for this order. Top up their float, then move the order to production.
                  </p>
                </div>
              </div>
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 mb-5 text-sm">
                {materialPrompt.goldShort > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-800">{fmtMat(materialPrompt.goldType)}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Need {materialPrompt.goldNeeded.toFixed(3)}{goldUnit} · have {materialPrompt.goldHave.toFixed(3)}{goldUnit}
                      </p>
                    </div>
                    <Link href={goldDeposit} className="text-xs font-medium text-[#1E3A5F] bg-[#1E3A5F]/5 hover:bg-[#1E3A5F]/10 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      Issue {materialPrompt.goldShort.toFixed(3)}{goldUnit}
                    </Link>
                  </div>
                )}
                {materialPrompt.diamondShort > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-800">{fmtMat(materialPrompt.diamondType)}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Need {materialPrompt.diamondNeeded.toFixed(3)}{diaUnit} · have {materialPrompt.diamondHave.toFixed(3)}{diaUnit}
                      </p>
                    </div>
                    <Link href={diaDeposit} className="text-xs font-medium text-[#1E3A5F] bg-[#1E3A5F]/5 hover:bg-[#1E3A5F]/10 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      Issue {materialPrompt.diamondShort.toFixed(3)}{diaUnit}
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMaterialPrompt(null)}
                  className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                  Cancel
                </button>
                <button onClick={() => { setMaterialPrompt(null); advanceStage({ skipMaterialCheck: true }) }}
                  disabled={advancing}
                  className="flex-1 bg-stone-100 text-stone-700 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-200 disabled:opacity-50">
                  {advancing ? 'Moving...' : 'Move anyway'}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 text-center mt-3">
                "Move anyway" assumes you'll issue material outside the system (e.g. courier with separate proof).
              </p>
            </div>
          </div>
        )
      })()}

      {paymentModal && (
        <PaymentModal
          mode={paymentModal.mode}
          balanceDue={Math.max(0, (parseFloat(order.total_amount) || 0) - (parseFloat(order.advance_paid) || 0))}
          orderNumber={order.order_number}
          onClose={() => setPaymentModal(null)}
          onLogPayment={async (input) => {
            const r = await logPayment(input)
            if (!r.ok) return r
            await load()
            return { ok: true }
          }}
          onScheduleReminder={async (days) => {
            const r = await schedulePaymentReminder(days)
            if (!r.ok) return r
            await load()
            return { ok: true }
          }}
          onContinueDispatch={async () => {
            setPaymentModal(null)
            // Re-fetch latest order then re-trigger advance with payment
            // prompt skipped — guards (tracking, COGS) still run.
            await load()
            advanceStage({ skipPaymentPrompt: true })
          }}
        />
      )}

      {rescheduleOpen && (
        <PaymentRescheduleModal
          currentDate={order.payment_reminder_date}
          onClose={() => setRescheduleOpen(false)}
          onSave={async (days) => {
            const r = await schedulePaymentReminder(days)
            if (!r.ok) { alert('Could not save reminder: ' + (r.error || 'unknown error')); return }
            setRescheduleOpen(false)
            await load()
          }}
        />
      )}

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

      {guardError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Cannot advance order</p>
            <p>{guardError}</p>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          {/* Pipeline stepper */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-stone-900">Pipeline stage</h2>
              {nextStage && !isCancelled && (
                <button onClick={advanceStage} disabled={advancing}
                  className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
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

            <div className="flex items-center gap-0">
              {ORDER_STATUSES.map((stage, idx) => {
                const isDone = currentStageIdx > idx
                const isActive = currentStageIdx === idx
                const isLast = idx === ORDER_STATUSES.length - 1
                return (
                  <div key={stage.value} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border-2 transition-colors ${
                        isDone ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                        : isActive ? 'bg-white border-[#1E3A5F] text-[#1E3A5F]'
                        : 'bg-white border-stone-200 text-stone-300'
                      }`}>
                        {isDone ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                      <p className={`text-center mt-1 leading-tight text-[10px] hidden sm:block truncate max-w-full px-0.5 ${
                        isActive ? 'text-[#1E3A5F] font-semibold'
                        : isDone ? 'text-stone-400'
                        : 'text-stone-300'
                      }`}>{stage.label}</p>
                    </div>
                    {!isLast && (
                      <div className={`h-0.5 flex-shrink-0 w-full max-w-6 mt-0 mb-4 sm:mb-5 transition-colors ${
                        isDone ? 'bg-[#1E3A5F]' : 'bg-stone-200'
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

          {/* Costing & gold ledger */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-stone-900">Costing &amp; gold</h2>
              {(order.gold_source || 'self') === 'self' && consumptionHref && !consumptionTxn && (
                <Link href={consumptionHref}
                  className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600">
                  <Layers className="w-3.5 h-3.5" /> Record gold consumption
                </Link>
              )}
              {consumptionTxn && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                  <Check className="w-3 h-3" /> Consumption recorded ({consumptionTxn.quantity}g)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              {[
                ['Gold source', (order.gold_source || 'self') === 'self' ? 'Self (our float)' : 'Manufacturer'],
                ['Assigned manufacturer', mfgPartners.find(m => m.id === order.assigned_manufacturer_id)?.name || '—'],
                ['Karat', order.gold_karat ? `${order.gold_karat}K` : '—'],
                ['Gold wt — estimated', order.gold_weight_estimated ? `${order.gold_weight_estimated}g` : '—'],
                ['Gold wt — actual', order.gold_weight_actual ? `${order.gold_weight_actual}g` : '—'],
                ['Making charges', order.making_charges ? `₹${Number(order.making_charges).toLocaleString('en-IN')}` : '—'],
                ['CAD cost', order.cad_cost ? `₹${Number(order.cad_cost).toLocaleString('en-IN')}` : '—'],
                ['Stone cost', order.stone_cost ? `₹${Number(order.stone_cost).toLocaleString('en-IN')}` : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v)}</p>
                </div>
              ))}
            </div>

            {(order.gold_weight_actual || order.making_charges) && (
              <div className="mt-4 bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-stone-500">
                  <span>Gold cost ({order.gold_weight_actual || 0}g × ₹{order.gold_rate_at_order || 0}/g × purity)</span>
                  <span>₹{Math.round(savedCogs.gold_cost).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1">
                  <span>Total COGS</span>
                  <span className="text-[#1E3A5F]">₹{Math.round(savedCogs.total_cogs).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Margin vs selling price</span>
                  <span className={savedCogs.margin >= 0 ? 'text-green-600' : 'text-red-500'}>
                    ₹{Math.round(savedCogs.margin).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-stone-900">Pricing &amp; payment</h2>
              <button onClick={() => setPaymentModal({ mode: 'standalone' })}
                className="flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] bg-[#1E3A5F]/5 hover:bg-[#1E3A5F]/10 px-3 py-1.5 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Log payment
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              {[
                ['Trade price', `₹${order.trade_price?.toLocaleString('en-IN') || '—'}`],
                ['Total amount', `₹${order.total_amount?.toLocaleString('en-IN') || '—'}`],
                ['Received', `₹${(order.advance_paid || 0).toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 font-medium mt-0.5">{String(v)}</p>
                </div>
              ))}
            </div>
            {(order.balance_due || 0) > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                <span className="text-amber-700 text-sm">Balance due</span>
                <span className="font-semibold text-amber-800">₹{order.balance_due?.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                <span className="text-green-700 text-sm">Fully paid</span>
                <Check className="w-4 h-4 text-green-600" />
              </div>
            )}

            {/* Payment-collection reminder (set when an order ships with an
                outstanding balance — Task #69). Once overdue, force the admin
                to confirm a new collection date with the retailer. */}
            {order.payment_reminder_date && (order.balance_due || 0) > 0 && (() => {
              const today = new Date().toISOString().split('T')[0]
              const overdue = order.payment_reminder_date < today
              return (
                <div className={`mt-3 p-3 rounded-lg border flex items-center justify-between gap-3 ${overdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className={`w-4 h-4 shrink-0 ${overdue ? 'text-red-600' : 'text-blue-600'}`} />
                    <div className="text-xs">
                      <p className={`font-medium ${overdue ? 'text-red-700' : 'text-blue-700'}`}>
                        {overdue ? 'Payment overdue' : 'Payment reminder'}
                      </p>
                      <p className={overdue ? 'text-red-600' : 'text-blue-600'}>
                        {overdue
                          ? `Was due ${formatDate(order.payment_reminder_date)} — confirm a new date with the retailer.`
                          : `Collect by ${formatDate(order.payment_reminder_date)}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setRescheduleOpen(true)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap ${overdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                    Reschedule
                  </button>
                </div>
              )
            })()}

            {/* Payment ledger (Task #69) */}
            {payments.length > 0 && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <p className="text-xs font-medium text-stone-500 mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Payment log
                </p>
                <div className="space-y-1.5">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-stone-700">
                          {formatDate(p.payment_date)}
                          {p.method ? ` · ${p.method}` : ''}
                        </p>
                        {(p.reference || p.notes) && (
                          <p className="text-stone-400 truncate">
                            {p.reference || ''}{p.reference && p.notes ? ' · ' : ''}{p.notes || ''}
                          </p>
                        )}
                      </div>
                      <span className="font-medium text-stone-800 shrink-0 ml-2">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.gold_rate_at_order > 0 && (
              <p className="text-xs text-stone-400 mt-3">Gold rate locked: ₹{order.gold_rate_at_order?.toLocaleString('en-IN')}/g (24K)</p>
            )}
          </div>

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

          {order.internal_notes && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-2">Internal notes</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{order.internal_notes}</p>
            </div>
          )}
        </div>

      ) : (
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
                  <option value="returned">Returned</option>
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

          {/* Costing edit */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Costing &amp; gold</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Gold source</label>
                <select className={inp} value={form.gold_source || 'self'} onChange={e => set('gold_source', e.target.value)}>
                  <option value="self">Self (our float)</option>
                  <option value="manufacturer">Manufacturer</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Assigned manufacturer</label>
                <select className={inp} value={form.assigned_manufacturer_id || ''} onChange={e => set('assigned_manufacturer_id', e.target.value)}>
                  <option value="">—</option>
                  {mfgPartners.map(m => <option key={m.id} value={m.id}>{m.name} — {m.city}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Gold karat</label>
                <select className={inp} value={form.gold_karat || '18'} onChange={e => set('gold_karat', e.target.value)}>
                  {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Gold weight estimated (g)</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                  value={form.gold_weight_estimated || ''} onChange={e => set('gold_weight_estimated', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Gold weight actual (g)</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                  value={form.gold_weight_actual || ''} onChange={e => set('gold_weight_actual', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Making charges (₹)</label>
                <input type="number" inputMode="decimal" className={inp}
                  value={form.making_charges || ''} onChange={e => set('making_charges', e.target.value)} />
                {(() => {
                  const partner = mfgPartners.find(p => p.id === form.assigned_manufacturer_id)
                  const k = parseInt(form.gold_karat) || 0
                  const rate = partner ? Number((partner as any)[`labour_rate_${k}k`]) || 0 : 0
                  const w = Math.max(parseFloat(form.gold_weight_actual) || parseFloat(form.gold_weight_estimated) || 0, Number((partner as any)?.min_labour_grams) || 1)
                  if (!partner) return <p className="text-[11px] text-stone-400 mt-1">Assign a manufacturer to auto-fill from their per-karat labour rate.</p>
                  if (!rate) return <p className="text-[11px] text-amber-600 mt-1">{partner.name} has no labour rate set for {k}K. Add one on the partner page or enter making charges manually.</p>
                  return <p className="text-[11px] text-stone-500 mt-1">Auto from {partner.name}: ₹{rate}/g × {w}g = ₹{Math.round(rate * w).toLocaleString('en-IN')}. Override above if needed.</p>
                })()}
              </div>
              <div>
                <label className={lbl}>CAD cost (₹)</label>
                <input type="number" inputMode="decimal" className={inp}
                  value={form.cad_cost || ''} onChange={e => set('cad_cost', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Stone cost (₹)</label>
                <input type="number" inputMode="decimal" className={inp}
                  value={form.stone_cost || ''} onChange={e => set('stone_cost', e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-3">
              COGS = (gold weight × rate × karat purity) + labour (auto-filled from karigar's per-karat rate) + CAD + stone. Margin recalculated against total amount.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
