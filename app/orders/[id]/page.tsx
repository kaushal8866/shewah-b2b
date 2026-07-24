'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES, computeOrderCogs, partnerLabourRate, type ManufacturingPartnerLite } from '@/lib/supabase'
import {
  getAlloyDensity,
  getStoneSeatVolume,
  getNetVolume,
  scaleWeightBySize,
  FINISH_FACTOR
} from '@/lib/cadWeight'
import { KARAT_FACTORS, SELLABLE_KARATS, pureMassByKarat, computeKaratPricing, getMetalWeight } from '@/lib/karat'
import { cascadeOrderStatusToMfg } from '@/lib/mfgOrderLifecycle'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, ChevronRight, Check, Package, Layers, AlertTriangle, MessageSquare, CreditCard, Bell, Plus, Download, FileText } from 'lucide-react'
import Link from 'next/link'
import CustomerJourneyPanel from '@/components/CustomerJourneyPanel'
import ProductionUpdatesPanel from '@/components/ProductionUpdatesPanel'
import { useSession } from 'next-auth/react'

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
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  const [order, setOrder] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [generateInvoiceOpen, setGenerateInvoiceOpen] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState<any>({
    tax_treatment: 'inclusive',
    invoice_date: new Date().toISOString().split('T')[0],
    buyer_name: '',
    buyer_gstin: '',
    buyer_address: '',
    buyer_state: 'Gujarat',
    hsn_code: '7113',
  })
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')

  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    if (!order) return
    setInvoiceForm({
      tax_treatment: 'inclusive',
      invoice_date: new Date().toISOString().split('T')[0],
      buyer_name: order.partners?.store_name || order.partners?.owner_name || '',
      buyer_gstin: order.partners?.gst_number || '',
      buyer_address: order.partners?.address || '',
      buyer_state: order.partners?.state || 'Gujarat',
      hsn_code: '7113',
    })
  }, [order])
  const [mfgPartners, setMfgPartners] = useState<ManufacturingPartnerLite[]>([])
  const [consumptionTxn, setConsumptionTxn] = useState<any | null>(null)
  // Task #76: live diamond inventory keyed by `${material_type}|${shape_id}|${size_id}`
  // (e.g. `diamond_lgd|<uuid>|<uuid>`). Keying by material type prevents a
  // natural requirement from looking satisfied by LGD stock or vice versa.
  const [diamondStock, setDiamondStock] = useState<Record<string, { pieces: number; carats: number; min_pieces: number }>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [weightCalcMethod, setWeightCalcMethod] = useState<'manual' | 'cad'>('manual')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})
  const [latestGoldRate, setLatestGoldRate] = useState(0)
  const [latestSilverRate, setLatestSilverRate] = useState(80)
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

  // Task #68: when the karigar / karat / weight changes during edit, the
  // labour cost (`making_charges`) is auto-filled from
  //     partner.labour_rate_{karat}k × max(weight, min_labour_grams)
  // The admin can opt out by enabling the explicit "override" toggle below;
  // while the toggle is OFF the field is read-only and tracks the partner
  // rate. When the toggle is ON the field becomes editable and we never
  // touch it. If the partner has no rate for the karat, the field is
  // cleared (no global default falls through).
  const [overrideLabour, setOverrideLabour] = useState(false)
  useEffect(() => {
    if (!editing) setOverrideLabour(false)
  }, [editing])

  const editPartner = mfgPartners.find(p => p.id === form.assigned_manufacturer_id)
  const editKarat = parseInt(form.gold_karat) || 0
  const editPartnerRate = partnerLabourRate(editPartner, editKarat)
  const editGrossWeight = Math.max(
    parseFloat(form.gold_weight_actual) || parseFloat(form.gold_weight_estimated) || 0,
    Number(editPartner?.min_labour_grams) || 1,
  )

  // Only fire when the admin has actually CHANGED an assignment-driving
  // field (partner / karat / weight) from the saved snapshot. Merely
  // entering edit mode on a historical order — or editing unrelated
  // fields — must NOT touch the persisted labour value.
  const assignmentChanged = !!order && (
    String(form.assigned_manufacturer_id || '') !== String(order.assigned_manufacturer_id || '')
    || String(form.gold_karat || '') !== String(order.gold_karat || '')
    || String(form.gold_weight_actual || '') !== String(order.gold_weight_actual || '')
    || String(form.gold_weight_estimated || '') !== String(order.gold_weight_estimated || '')
  )
  useEffect(() => {
    if (!editing || overrideLabour || !assignmentChanged) return
    if (!editPartner || editPartnerRate <= 0 || editGrossWeight <= 0) {
      // Partner / karat changed but the new partner has no rate — clear
      // any stale auto value so we don't quietly carry the previous rate.
      if (form.making_charges) setForm((prev: any) => ({ ...prev, making_charges: '' }))
      return
    }
    const auto = String(Math.round(editPartnerRate * editGrossWeight))
    if (form.making_charges !== auto) {
      setForm((prev: any) => ({ ...prev, making_charges: auto }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, overrideLabour, assignmentChanged, editPartnerRate, editGrossWeight])

  // Initialize weight calculation method when editing order
  useEffect(() => {
    if (editing && order) {
      setWeightCalcMethod(order.gross_volume ? 'cad' : 'manual')
    }
  }, [editing, order])

  // Dynamic CAD volume calculations in edit mode
  useEffect(() => {
    if (!editing || weightCalcMethod !== 'cad') return

    const gV = parseFloat(form.gross_volume) || 0
    const hV = parseFloat(form.hollow_volume) || 0
    const gcV = parseFloat(form.gallery_cut_volume) || 0

    const sV = getStoneSeatVolume(form.diamond_specs || order?.diamond_specs || [])
    const nV = getNetVolume(gV, sV, hV, gcV)

    const karat = form.gold_karat
    const tone = form.metal_tone || 'yellow'
    const density = getAlloyDensity(karat, tone)

    const castingWeight = nV * density

    setForm((prev: any) => {
      const weightStr = castingWeight > 0 ? castingWeight.toFixed(4) : ''
      return prev.gold_weight_estimated === weightStr ? prev : { ...prev, gold_weight_estimated: weightStr }
    })
  }, [editing, weightCalcMethod, form.gross_volume, form.hollow_volume, form.gallery_cut_volume, form.gold_karat, form.metal_tone, form.diamond_specs, order])

  // Size scaling logic under manual mode in Edit Form
  useEffect(() => {
    if (!editing || weightCalcMethod !== 'manual') return
    if (order?.type !== 'catalog' || !order?.product_id) return

    const product = order.products
    if (!product) return

    const isSil = product.metal_type === 'silver'
    let baseWeight = Number(product.gold_weight_g) || 0
    if (product.metal_weights && Object.keys(product.metal_weights).length > 0) {
      if (isSil) {
        const k = product.ref_karat || 'silver_925'
        baseWeight = getMetalWeight(product.metal_weights, k, 'default') || 0
      } else {
        const k = form.gold_karat === 'silver' ? '22K' : `${form.gold_karat}K`
        const c = form.gold_color || 'yellow'
        baseWeight = getMetalWeight(product.metal_weights, k, c) || 0
      }
    }

    if (!baseWeight) return

    const category = product.category || ''

    if (!form.ring_size) {
      setForm((prev: any) => prev.gold_weight_estimated === String(baseWeight) ? prev : { ...prev, gold_weight_estimated: String(baseWeight) })
      return
    }

    const scaled = scaleWeightBySize(baseWeight, '', form.ring_size, category)
    const scaledStr = scaled > 0 ? scaled.toFixed(4) : String(baseWeight)
    setForm((prev: any) => prev.gold_weight_estimated === scaledStr ? prev : { ...prev, gold_weight_estimated: scaledStr })
  }, [editing, form.ring_size, weightCalcMethod, form.gold_karat, form.gold_color, order])

  async function load() {
    setLoading(true)
    const [{ data }, { data: mp }, { data: gr }, { data: sd }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, partners(store_name, owner_name, phone, city, state, address, gst_number), products(code, name, category, gold_weight_g, gold_karat, diamond_weight, diamond_type, diamond_specs, metal_type, metal_weights, ref_karat, ref_color)')
        .eq('id', id)
        .single(),
      supabase.from('manufacturing_partners').select('id, name, city, min_labour_grams, labour_rate_9k, labour_rate_10k, labour_rate_14k, labour_rate_18k, labour_rate_22k').order('name'),
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
      supabase.from('settings').select('key, value').in('key', ['silver_rate_b2b'])
    ])
    if (!data) { router.push('/orders'); return }
    setOrder(data)
    setForm(data)
    setMfgPartners((mp || []) as ManufacturingPartnerLite[])
    if (gr?.[0]) setLatestGoldRate(gr[0].rate_24k)
    if (sd) {
      const rate = sd.find((s: any) => s.key === 'silver_rate_b2b')?.value
      if (rate) setLatestSilverRate(Number(rate))
    }

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

    // Task #76: pull live diamond stock so we can show shortage badges
    // beside each diamond on the product. The endpoint is tolerant when
    // the catalog migration hasn't been applied yet (returns []), so we
    // simply degrade silently in that case.
    try {
      const r = await fetch('/api/diamonds/stock')
      if (r.ok) {
        const j = await r.json()
        const map: Record<string, { pieces: number; carats: number; min_pieces: number }> = {}
        for (const row of (j?.groups || [])) {
          if (!row?.material_type || !row?.diamond_shape_id || !row?.diamond_size_id) continue
          map[`${row.material_type}|${row.diamond_shape_id}|${row.diamond_size_id}`] = {
            pieces: Number(row.pieces) || 0,
            carats: Number(row.carats) || 0,
            min_pieces: Number(row.reorder_threshold_pieces) || 0,
          }
        }
        setDiamondStock(map)
      }
    } catch (e) {
      console.warn('[diamond stock] fetch failed', e)
    }

    try {
      const { data: invs } = await supabase
        .from('gst_invoices')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false })
      setInvoices(invs || [])
    } catch (e) {
      console.warn('Failed to load order invoices', e)
    }

    setLoading(false)
  }

  function set(k: string, v: any) {
    setForm((prev: any) => {
      const next = { ...prev, [k]: v }
      if (k === 'gold_color') {
        next.metal_tone = v
      }
      return next
    })
  }

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true)
    setInvoiceError('')
    try {
      const qty = Number(order.quantity) || 1
      const totalAmount = Number(order.total_amount) || 0

      // Compute components
      const goldWeight = Number(order.gold_weight_actual) || Number(order.gold_weight_estimated) || Number(order.products?.gold_weight_g) || 0
      const goldKarat = Number(order.gold_karat) || Number(order.products?.gold_karat) || 18
      const isSilver = order.metal_type === 'silver' || String(order.gold_karat).toLowerCase() === 'silver' || order.products?.metal_type === 'silver'
      const goldRate24k = Number(order.gold_rate_at_order) || 0
      const karatFactor = isSilver ? 1 : (KARAT_FACTORS[goldKarat] || 0.75)
      
      const goldCost = goldWeight * goldRate24k * karatFactor
      const diamondCost = Number(order.stone_cost) || 0
      
      const labourPerG = Number(order.retail_labour_at_order) || 0
      const grossW = Number(order.gross_weight_at_karat ?? order.gold_weight_actual ?? order.gold_weight_estimated ?? order.products?.gold_weight_g) || 0
      const labourCost = labourPerG > 0 ? (labourPerG * grossW) : (Number(order.making_charges) || 0)
      
      const cadCost = Number(order.cad_cost) || 0
      
      const totalCogs = goldCost + diamondCost + labourCost + cadCost
      
      const items: any[] = []

      if (totalCogs > 0) {
        const markup = totalAmount / totalCogs
        
        let goldAmt = Math.round(goldCost * markup * 100) / 100
        let diamondAmt = Math.round(diamondCost * markup * 100) / 100
        let labourAmt = Math.round(labourCost * markup * 100) / 100
        let cadAmt = Math.round(cadCost * markup * 100) / 100
        
        // Adjust to match totalAmount exactly
        const diff = totalAmount - (goldAmt + diamondAmt + labourAmt + cadAmt)
        if (Math.abs(diff) > 0.001) {
          if (goldAmt > 0) goldAmt = Math.round((goldAmt + diff) * 100) / 100
          else if (labourAmt > 0) labourAmt = Math.round((labourAmt + diff) * 100) / 100
          else if (diamondAmt > 0) diamondAmt = Math.round((diamondAmt + diff) * 100) / 100
          else if (cadAmt > 0) cadAmt = Math.round((cadAmt + diff) * 100) / 100
        }

        if (goldWeight > 0 && goldAmt > 0) {
          items.push({
            description: isSilver ? 'Silver (Metal)' : `Gold ${goldKarat}K (Metal)`,
            hsn_code: invoiceForm.hsn_code || '7113',
            qty: goldWeight,
            rate: goldWeight > 0 ? goldAmt / goldWeight : 0,
            amount: goldAmt,
            unit: 'grams'
          })
        }

        const diamondWeight = Number(order.products?.diamond_weight) || 0
        if (diamondWeight > 0 && diamondAmt > 0) {
          items.push({
            description: 'Diamonds',
            hsn_code: '7102',
            qty: diamondWeight * qty,
            rate: diamondWeight * qty > 0 ? diamondAmt / (diamondWeight * qty) : 0,
            amount: diamondAmt,
            unit: 'carats'
          })
        } else if (diamondAmt > 0) {
          items.push({
            description: 'Diamonds / Stones',
            hsn_code: '7102',
            qty: 1,
            rate: diamondAmt,
            amount: diamondAmt,
            unit: 'pcs'
          })
        }

        if (labourAmt > 0) {
          const qtyLabour = grossW || goldWeight || 1
          items.push({
            description: 'Labour / Making Charges',
            hsn_code: '9988',
            qty: qtyLabour,
            rate: qtyLabour > 0 ? labourAmt / qtyLabour : 0,
            amount: labourAmt,
            unit: 'grams'
          })
        }

        if (cadAmt > 0) {
          items.push({
            description: 'CAD Design Charges',
            hsn_code: '9988',
            qty: 1,
            rate: cadAmt,
            amount: cadAmt,
            unit: 'pcs'
          })
        }
      }

      if (items.length === 0) {
        const rate = totalAmount / qty
        items.push({
          description: order.products ? `${order.products.name} (${order.products.code})` : 'Custom Jewellery Design',
          hsn_code: invoiceForm.hsn_code || '7113',
          qty,
          rate,
          amount: totalAmount,
          unit: 'pcs'
        })
      }

      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_type: 'order',
          target_id: id,
          tax_treatment: invoiceForm.tax_treatment,
          items,
          buyer_details: {
            buyer_name: invoiceForm.buyer_name,
            buyer_address: invoiceForm.buyer_address || null,
            buyer_gstin: invoiceForm.buyer_gstin || null,
            buyer_state: invoiceForm.buyer_state,
            partner_id: order.partner_id,
          },
          invoice_date: invoiceForm.invoice_date,
        })
      })

      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to generate invoice')

      setGenerateInvoiceOpen(false)
      await load()
    } catch (e: any) {
      setInvoiceError(e.message)
    } finally {
      setGeneratingInvoice(false)
    }
  }

  async function handleCancelInvoice() {
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason.')
      return
    }

    setCancelling(true)
    setCancelError('')
    try {
      const r = await fetch(`/api/invoices/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to cancel invoice')
      
      setCancelTarget(null)
      setCancelReason('')
      await load()
    } catch (e: any) {
      setCancelError(e.message)
    } finally {
      setCancelling(false)
    }
  }

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
    const isSilverOrder = order.metal_type === 'silver' || String(goldKarat).toLowerCase() === 'silver'
    // Task 78: floats are denominated in 24kt-net only. The order's gold_weight
    // is gross-at-karat — convert to its 24kt-pure equivalent for the readiness
    // check and the deposit shortcut amount.
    const goldType = isSilverOrder ? 'silver' : 'gold_24k'
    const karatFactor = isSilverOrder ? 1 : (KARAT_FACTORS[Number(goldKarat)] ?? 1)
    const goldPerPieceGross = parseFloat(order.gold_weight_estimated) || parseFloat(order.products?.gold_weight_g) || 0
    const goldNeeded = Math.round(goldPerPieceGross * qty * karatFactor * 10000) / 10000

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

    // Recompute COGS + margin. To preserve historical pricing, we ONLY
    // re-derive labour from the partner's current per-karat rate when the
    // admin actually changed an assignment-driving field (partner / karat
    // / weight) during this edit session. Otherwise we use the persisted
    // snapshot (`making_charges`) so unrelated edits on old in-flight
    // orders don't silently reprice them with today's rate.
    const savePartner = mfgPartners.find(p => p.id === form.assigned_manufacturer_id)
    const isSilverOrder = String(form.gold_karat).toLowerCase() === 'silver'
    const wasSilverOrder = order.metal_type === 'silver' || String(order.gold_karat).toLowerCase() === 'silver'
    const metalTypeChanged = isSilverOrder !== wasSilverOrder
    const karatChanged = String(form.gold_karat || '') !== String(order.gold_karat || '')

    let saveGoldRate = order.gold_rate_at_order
    if (metalTypeChanged || (karatChanged && !isSilverOrder)) {
      saveGoldRate = isSilverOrder ? latestSilverRate : latestGoldRate
    }

    const saveKarat = isSilverOrder ? null : (parseInt(form.gold_karat) || 18)
    const useLivePartnerRate = assignmentChanged && !overrideLabour
    const saveLabourPerG = (useLivePartnerRate && saveKarat) ? partnerLabourRate(savePartner, saveKarat) : 0
    const saveGrossW = Math.max(
      parseFloat(form.gold_weight_actual) || parseFloat(form.gold_weight_estimated) || 0,
      Number(savePartner?.min_labour_grams) || 1,
    )
    const cogs = computeOrderCogs({
      gold_weight_actual: parseFloat(form.gold_weight_actual) || 0,
      gold_rate_at_order: saveGoldRate,
      gold_karat: saveKarat,
      metal_type: isSilverOrder ? 'silver' : 'gold',
      labour_per_gram: saveLabourPerG,
      gross_weight: saveGrossW,
      min_labour_grams: Number(savePartner?.min_labour_grams) || 1,
      making_charges: parseFloat(form.making_charges) || 0,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      total_amount: parseFloat(form.total_amount) || 0,
    })

    const updatePayload: any = {
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
      gold_rate_at_order: saveGoldRate,
      metal_type: isSilverOrder ? 'silver' : 'gold',
      gold_karat: saveKarat,
      gold_color: isSilverOrder ? 'yellow' : (form.gold_color || 'yellow'),
      gold_weight_estimated: parseFloat(form.gold_weight_estimated) || null,
      gold_weight_actual: parseFloat(form.gold_weight_actual) || null,
      making_charges: parseFloat(form.making_charges) || null,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      assigned_manufacturer_id: form.assigned_manufacturer_id || null,
      total_cogs: Math.round(cogs.total_cogs) || null,
      margin: Math.round(cogs.margin) || null,
      // CAD gold weight pipeline fields
      gross_volume: weightCalcMethod === 'cad' ? (parseFloat(form.gross_volume) || null) : null,
      stone_seat_volume: weightCalcMethod === 'cad' ? (getStoneSeatVolume(form.diamond_specs || order?.diamond_specs || []) || null) : null,
      hollow_volume: weightCalcMethod === 'cad' ? (parseFloat(form.hollow_volume) || null) : null,
      gallery_cut_volume: weightCalcMethod === 'cad' ? (parseFloat(form.gallery_cut_volume) || null) : null,
      net_volume: weightCalcMethod === 'cad' ? (getNetVolume(
        parseFloat(form.gross_volume) || 0,
        getStoneSeatVolume(form.diamond_specs || order?.diamond_specs || []),
        parseFloat(form.hollow_volume) || 0,
        parseFloat(form.gallery_cut_volume) || 0
      ) || null) : null,
      alloy_density_used: weightCalcMethod === 'cad' ? (getAlloyDensity(form.gold_karat, form.metal_tone || 'yellow') || null) : null,
      casting_weight_g: weightCalcMethod === 'cad' ? (parseFloat(form.gold_weight_estimated) || null) : null,
      final_weight_g: weightCalcMethod === 'cad' ? ((parseFloat(form.gold_weight_estimated) || 0) * FINISH_FACTOR || null) : null,
      metal_tone: weightCalcMethod === 'cad' ? (form.metal_tone || 'yellow') : null,
    }

    let { error } = await supabase.from('orders').update(updatePayload).eq('id', id)

    // Gracefully handle missing columns in database
    if (error && (error as any).code === '42703') {
      const retryPayload = { ...updatePayload }
      const cadCols = [
        'gross_volume', 'stone_seat_volume', 'hollow_volume', 'gallery_cut_volume',
        'net_volume', 'alloy_density_used', 'casting_weight_g', 'final_weight_g', 'metal_tone',
        'gold_color'
      ]
      cadCols.forEach(col => delete retryPayload[col])
      const retryRes = await supabase.from('orders').update(retryPayload).eq('id', id)
      error = retryRes.error
    }
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

  // Live computed COGS for the read-only display uses the SNAPSHOT labour
  // value persisted on the order (`making_charges`) — never the partner's
  // current rate. This keeps in-flight / historical orders from being
  // retroactively repriced if a karigar's labour rate changes after the
  // order was saved. Labour is only re-derived from the partner rate
  // during an explicit edit + save (handleSave above).
  const savedCogs = computeOrderCogs({
    gold_weight_actual: order.gold_weight_actual,
    gold_rate_at_order: order.gold_rate_at_order,
    gold_karat: order.gold_karat,
    metal_type: order.metal_type,
    making_charges: order.making_charges,
    cad_cost: order.cad_cost,
    stone_cost: order.stone_cost,
    total_amount: order.total_amount,
  })

  // Build link for "Record gold consumption for this order"
  // Task 78: float consumption is always logged against the 24kt-net bucket.
  const isSilver = order.metal_type === 'silver' || String(order.gold_karat).toLowerCase() === 'silver'
  const consumptionHref = order.assigned_manufacturer_id
    ? `/manufacturing/partners/${order.assigned_manufacturer_id}/float?order_id=${id}&type=consumption&material_type=${isSilver ? 'silver' : 'gold_24k'}`
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

      {/* D2C-only — strictly gated on order.audience to prevent B2B orders
          from ever rendering consumer-journey UI, even if they happen to
          carry a customer_id for legacy reasons. */}
      {order?.audience === 'd2c' && (
        <>
          <CustomerJourneyPanel orderId={id} customerId={order?.customer_id || null} />
          <ProductionUpdatesPanel orderId={id} />
        </>
      )}

      {materialPrompt && (() => {
        const fmtMat = (m: string) =>
          m === 'gold_24k'
            ? 'Gold (24kt net)'
            : m.replace(/_/g, ' ').replace(/^gold/, 'Gold').replace(/^diamond/, 'Diamond')
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
                <button onClick={() => advanceStage()} disabled={advancing}
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

          {/* Diamond requirements & central-stock availability (Task #76).
              Only renders when the product has linked diamond_specs rows
              with shape_id+size_id (i.e. the operator picked from the
              shared diamond catalog). Legacy free-form rows are skipped
              because we can't match them to inventory groups. */}
          {Array.isArray(order.products?.diamond_specs) && order.products.diamond_specs.some((d: any) => d?.shape_id && d?.size_id) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-4">Diamond requirements</h2>
              <div className="space-y-2">
                {order.products.diamond_specs.filter((d: any) => d?.shape_id && d?.size_id).map((d: any, i: number) => {
                  const qty = parseInt(order.quantity) || 1
                  const piecesPerUnit = parseInt(d.pieces) || 1
                  const need = piecesPerUnit * qty
                  const matType = d.type === 'natural' ? 'diamond_natural' : 'diamond_lgd'
                  const stock = diamondStock[`${matType}|${d.shape_id}|${d.size_id}`]
                  const have = stock?.pieces || 0
                  const enough = have >= need
                  const requestHref = `/stock/receive?material_type=${matType}&diamond_shape_id=${d.shape_id}&diamond_size_id=${d.size_id}&pieces=${Math.max(0, need - have)}`
                  return (
                    <div key={i} className="flex items-center justify-between border border-stone-100 rounded-lg p-3">
                      <div className="text-sm">
                        <p className="text-stone-800 capitalize">
                          {d.shape || '—'} · {d.size_label || '—'}
                          <span className="text-stone-400"> · {d.type === 'natural' ? 'Natural' : 'LGD'}</span>
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Need {need} pc{need === 1 ? '' : 's'} ({piecesPerUnit}/unit × {qty}) · In stock {have}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-lg border ${enough ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {enough ? 'In stock' : `Short ${need - have}`}
                        </span>
                        {!enough && (
                          <Link
                            href={requestHref}
                            title="Opens the receive form pre-filled — log a vendor purchase or adjustment to clear this shortage."
                            className="text-xs px-2 py-1 rounded-lg border border-[#1E3A5F] text-[#1E3A5F] hover:bg-yellow-50">
                            Log new stock
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                [isSilver ? 'Metal source' : 'Gold source', (order.gold_source || 'self') === 'self' ? (isSilver ? 'Self (our float)' : 'Self (our float)') : 'Karigar'],
                ['Assigned manufacturer', mfgPartners.find(m => m.id === order.assigned_manufacturer_id)?.name || '—'],
                [isSilver ? 'Metal' : 'Karat', isSilver ? 'Silver' : (order.gold_karat ? `${order.gold_karat}K` : '—')],
                [isSilver ? 'Silver wt — estimated' : 'Gold wt — estimated', order.gold_weight_estimated ? `${order.gold_weight_estimated}g` : '—'],
                [isSilver ? 'Silver wt — actual' : 'Gold wt — actual', order.gold_weight_actual ? `${order.gold_weight_actual}g` : '—'],
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

            {order.gross_volume && (
              <div className="mt-4 pt-4 border-t border-stone-200">
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">CAD Density Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                  {[
                    ['Metal Tone', order.metal_tone || '—'],
                    ['Gross Volume', order.gross_volume ? `${order.gross_volume} cm³` : '—'],
                    ['Stone Seat Volume', order.stone_seat_volume ? `${Number(order.stone_seat_volume).toFixed(4)} cm³` : '—'],
                    ['Hollow Volume', order.hollow_volume ? `${order.hollow_volume} cm³` : '—'],
                    ['Gallery Cut Volume', order.gallery_cut_volume ? `${order.gallery_cut_volume} cm³` : '—'],
                    ['Net Metal Volume', order.net_volume ? `${Number(order.net_volume).toFixed(4)} cm³` : '—'],
                    ['Alloy Density Used', order.alloy_density_used ? `${order.alloy_density_used} g/cm³` : '—'],
                    ['Casting Weight (Gross)', order.casting_weight_g ? `${order.casting_weight_g}g` : '—'],
                    ['Expected Final Weight', order.final_weight_g ? `${Number(order.final_weight_g).toFixed(4)}g` : '—'],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <p className="text-xs text-stone-400">{k}</p>
                      <p className="text-stone-800 mt-0.5 capitalize">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(order.gold_weight_actual || order.making_charges) && (
              <div className="mt-4 bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-stone-500">
                  {isSilver ? (
                    <>
                      <span>Silver cost ({order.gold_weight_actual || 0}g × ₹{order.gold_rate_at_order || 0}/g)</span>
                      <span>₹{Math.round((parseFloat(order.gold_weight_actual) || 0) * (order.gold_rate_at_order || 0)).toLocaleString('en-IN')}</span>
                    </>
                  ) : (
                    <>
                      <span>Gold cost ({order.gold_weight_actual || 0}g × ₹{order.gold_rate_at_order || 0}/g × purity)</span>
                      <span>₹{Math.round(savedCogs.gold_cost).toLocaleString('en-IN')}</span>
                    </>
                  )}
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

          {(currentStageIdx >= ORDER_STATUSES.findIndex(s => s.value === 'dispatched' || invoices.length > 0)) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-stone-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1E3A5F]" /> GST Tax Invoices
                </h2>
                {isMaster && !invoices.some(inv => inv.status === 'active') && !isCancelled && (
                  <button onClick={() => setGenerateInvoiceOpen(true)}
                    className="flex items-center gap-1 bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#162B47] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Generate Invoice
                  </button>
                )}
              </div>
              
              {invoices.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No tax invoices generated for this order yet.</p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div key={inv.id} className={`flex items-center justify-between border rounded-lg p-3 ${inv.status === 'cancelled' ? 'bg-stone-50 border-stone-100 opacity-60' : 'bg-white border-stone-200'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">{inv.invoice_number}</p>
                          {inv.status === 'cancelled' && (
                            <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">VOID</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Date: {formatDate(inv.invoice_date)} · Total: ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                          className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 bg-white rounded-lg transition-colors flex items-center gap-1 text-xs">
                          <Download className="w-3.5 h-3.5" /> PDF
                        </a>
                        {inv.status === 'active' && isMaster && (
                          <button onClick={() => setCancelTarget(inv)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 bg-white rounded-lg transition-colors flex items-center gap-1 text-xs">
                            <Trash2 className="w-3.5 h-3.5" /> Void
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <div className="col-span-1 sm:col-span-2 mb-2">
                <label className={lbl}>Weight Calculation Method</label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input type="radio" name="weightCalcMethodEdit" value="manual" checked={weightCalcMethod === 'manual'} onChange={() => setWeightCalcMethod('manual')} className="text-[#1E3A5F] focus:ring-[#1E3A5F]" />
                    <span>Manual / Sizing Scale</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input type="radio" name="weightCalcMethodEdit" value="cad" checked={weightCalcMethod === 'cad'} onChange={() => setWeightCalcMethod('cad')} className="text-[#1E3A5F] focus:ring-[#1E3A5F]" />
                    <span>CAD Alloy-Density Engine</span>
                  </label>
                </div>
              </div>

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
                <label className={lbl}>{String(form.gold_karat).toLowerCase() === 'silver' ? 'Metal' : 'Gold karat'}</label>
                <select className={inp} value={form.gold_karat || '18'} onChange={e => set('gold_karat', e.target.value)}>
                  {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                  <option value="silver">Silver</option>
                </select>
              </div>
              {String(form.gold_karat).toLowerCase() !== 'silver' && (
                <div>
                  <label className={lbl}>Gold color</label>
                  <select className={inp} value={form.gold_color || 'yellow'} onChange={e => set('gold_color', e.target.value)}>
                    <option value="yellow">Yellow Gold</option>
                    <option value="white">White Gold</option>
                    <option value="rose">Rose Gold</option>
                  </select>
                </div>
              )}
              <div>
                <label className={lbl}>{String(form.gold_karat).toLowerCase() === 'silver' ? 'Silver weight estimated (g)' : 'Gold weight estimated (g)'}</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0"
                  className={inp + (weightCalcMethod === 'cad' ? ' bg-stone-50 cursor-not-allowed' : '')}
                  readOnly={weightCalcMethod === 'cad'}
                  value={form.gold_weight_estimated || ''} onChange={e => set('gold_weight_estimated', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>{String(form.gold_karat).toLowerCase() === 'silver' ? 'Silver weight actual (g)' : 'Gold weight actual (g)'}</label>
                <input type="number" inputMode="decimal" step="0.0001" min="0" className={inp}
                  value={form.gold_weight_actual || ''} onChange={e => set('gold_weight_actual', e.target.value)} />
              </div>

              {weightCalcMethod === 'cad' && (
                <>
                  <div>
                    <label className={lbl}>Metal Tone</label>
                    <select className={inp} value={form.metal_tone || 'yellow'} onChange={e => set('metal_tone', e.target.value)}>
                      <option value="yellow">Yellow Gold</option>
                      <option value="rose">Rose Gold</option>
                      <option value="white">White Gold</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>CAD Gross Volume (cm³)</label>
                    <input type="number" inputMode="decimal" step="0.001" min="0" className={inp}
                      value={form.gross_volume || ''}
                      onChange={e => set('gross_volume', e.target.value)}
                      placeholder="e.g. 0.50" />
                  </div>
                  <div>
                    <label className={lbl}>Hollow Volume (cm³)</label>
                    <input type="number" inputMode="decimal" step="0.001" min="0" className={inp}
                      value={form.hollow_volume || ''}
                      onChange={e => set('hollow_volume', e.target.value)}
                      placeholder="e.g. 0.05" />
                  </div>
                  <div>
                    <label className={lbl}>Gallery Cut Volume (cm³)</label>
                    <input type="number" inputMode="decimal" step="0.001" min="0" className={inp}
                      value={form.gallery_cut_volume || ''}
                      onChange={e => set('gallery_cut_volume', e.target.value)}
                      placeholder="e.g. 0.02" />
                  </div>

                  <div className="col-span-1 sm:col-span-2 bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs space-y-2 mt-2">
                    <p className="font-semibold text-stone-700 text-sm mb-2">CAD Density Engine Breakdown</p>
                    <div className="grid grid-cols-2 gap-2 text-stone-600">
                      <div>CAD Gross Volume:</div>
                      <div className="font-medium text-right text-stone-900">{parseFloat(form.gross_volume) || 0} cm³</div>

                      <div>(-) Stone Seat Deduction:</div>
                      <div className="font-medium text-right text-stone-900">
                        {getStoneSeatVolume(form.diamond_specs || order?.diamond_specs || []).toFixed(4)} cm³
                      </div>

                      <div>(-) Hollow Volume:</div>
                      <div className="font-medium text-right text-stone-900">{parseFloat(form.hollow_volume) || 0} cm³</div>

                      <div>(-) Gallery Cut Volume:</div>
                      <div className="font-medium text-right text-stone-900">{parseFloat(form.gallery_cut_volume) || 0} cm³</div>

                      <div className="border-t border-stone-200 pt-1 font-semibold">Net Metal Volume:</div>
                      <div className="border-t border-stone-200 pt-1 font-semibold text-right text-stone-900">
                        {getNetVolume(
                          parseFloat(form.gross_volume) || 0,
                          getStoneSeatVolume(form.diamond_specs || order?.diamond_specs || []),
                          parseFloat(form.hollow_volume) || 0,
                          parseFloat(form.gallery_cut_volume) || 0
                        ).toFixed(4)} cm³
                      </div>

                      <div>Alloy Density ({form.gold_karat === 'silver' ? 'Silver' : `${form.gold_karat}K` + ' ' + (form.metal_tone || 'yellow')}):</div>
                      <div className="font-medium text-right text-stone-900">
                        {getAlloyDensity(form.gold_karat, form.metal_tone || 'yellow').toFixed(2)} g/cm³
                      </div>

                      <div className="border-t border-stone-200 pt-1 font-semibold text-[#1E3A5F]">Casting Weight (Estimated Gross):</div>
                      <div className="border-t border-stone-200 pt-1 font-semibold text-right text-[#1E3A5F]">
                        {parseFloat(form.gold_weight_estimated) ? `${parseFloat(form.gold_weight_estimated).toFixed(4)}g` : '—'}
                      </div>

                      <div className="font-semibold text-emerald-700">Expected Final Weight (Finished · 81.7%):</div>
                      <div className="font-semibold text-right text-emerald-700">
                        {parseFloat(form.gold_weight_estimated) ? `${(parseFloat(form.gold_weight_estimated) * FINISH_FACTOR).toFixed(4)}g` : '—'}
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <label className={lbl}>Making charges (₹)</label>
                  <label className="text-[11px] text-stone-600 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideLabour}
                      onChange={e => setOverrideLabour(e.target.checked)}
                      className="h-3 w-3"
                    />
                    Override partner rate
                  </label>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inp + (!overrideLabour ? ' bg-stone-50 cursor-not-allowed' : '')}
                  readOnly={!overrideLabour}
                  value={form.making_charges || ''}
                  onChange={e => set('making_charges', e.target.value)}
                />
                {(() => {
                  if (!editPartner) return <p className="text-[11px] text-stone-400 mt-1">Assign a manufacturer to auto-fill from their per-karat labour rate.</p>
                  if (overrideLabour) return <p className="text-[11px] text-stone-500 mt-1">Manual override on — ignoring {editPartner.name}&apos;s {editKarat}K rate.</p>
                  if (editPartnerRate <= 0) return <p className="text-[11px] text-amber-600 mt-1">{editPartner.name} has no labour rate set for {editKarat}K. Set one on the partner page or tick &quot;Override partner rate&quot; to enter manually.</p>
                  return <p className="text-[11px] text-stone-500 mt-1">Auto from {editPartner.name}: ₹{editPartnerRate}/g × {editGrossWeight}g = ₹{Math.round(editPartnerRate * editGrossWeight).toLocaleString('en-IN')}.</p>
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

      {/* Generate Invoice Modal */}
      {generateInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-semibold text-stone-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1E3A5F]" />
                Generate GST Tax Invoice
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Confirm tax details for this order. Generating an invoice freezes transaction numbers for accounting audit.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Invoice Date</label>
                <input type="date" className={inp} value={invoiceForm.invoice_date}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>HSN Code</label>
                <input type="text" className={inp} value={invoiceForm.hsn_code}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, hsn_code: e.target.value }))} placeholder="7113" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Tax Treatment</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="radio" checked={invoiceForm.tax_treatment === 'inclusive'}
                      onChange={() => setInvoiceForm((p: any) => ({ ...p, tax_treatment: 'inclusive' }))} />
                    <span>Tax Inclusive</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="radio" checked={invoiceForm.tax_treatment === 'exclusive'}
                      onChange={() => setInvoiceForm((p: any) => ({ ...p, tax_treatment: 'exclusive' }))} />
                    <span>Tax Exclusive</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Buyer (Recipient) Details</h4>
              <div>
                <label className={lbl}>Buyer Name</label>
                <input type="text" className={inp} value={invoiceForm.buyer_name}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>GSTIN (Optional)</label>
                  <input type="text" className={inp} value={invoiceForm.buyer_gstin}
                    onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_gstin: e.target.value }))} placeholder="e.g. 24ABCDE1234F1Z5" />
                </div>
                <div>
                  <label className={lbl}>Buyer State</label>
                  <input type="text" className={inp} value={invoiceForm.buyer_state}
                    onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Billing Address</label>
                <textarea className={`${inp} resize-none`} rows={2} value={invoiceForm.buyer_address}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_address: e.target.value }))} />
              </div>
            </div>

            {/* Calculations Preview */}
            {(() => {
              const standardRate = 3.0
              const isSameState = invoiceForm.buyer_state?.toLowerCase().trim() === 'gujarat'
              const totalAmount = Number(order?.total_amount) || 0
              
              let subtotalAmount = totalAmount
              let totalTax = 0
              let grandTotal = totalAmount

              if (invoiceForm.tax_treatment === 'inclusive') {
                grandTotal = totalAmount
                subtotalAmount = totalAmount / (1 + standardRate / 100)
                totalTax = grandTotal - subtotalAmount
              } else {
                subtotalAmount = totalAmount
                totalTax = subtotalAmount * (standardRate / 100)
                grandTotal = subtotalAmount + totalTax
              }

              subtotalAmount = Math.round(subtotalAmount * 100) / 100
              totalTax = Math.round(totalTax * 100) / 100
              grandTotal = Math.round(grandTotal * 100) / 100

              const taxLabel = isSameState
                ? `CGST (1.5%) + SGST (1.5%)`
                : `IGST (3.0%)`

              return (
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between text-stone-500">
                    <span>Taxable Subtotal:</span>
                    <span>₹{subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>{taxLabel}:</span>
                    <span>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-1 text-sm">
                    <span>Grand Total:</span>
                    <span className="text-[#1E3A5F]">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )
            })()}

            {invoiceError && <p className="text-xs text-red-600 font-medium">{invoiceError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setGenerateInvoiceOpen(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={handleGenerateInvoice} disabled={generatingInvoice}
                className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#162B47] disabled:opacity-50">
                {generatingInvoice ? 'Generating...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Cancel Tax Invoice?</h3>
                <p className="text-sm text-stone-500 mt-1">
                  You are about to cancel invoice <strong>{cancelTarget.invoice_number}</strong>. This action will keep the record in the database for accounting audits but mark it as voided.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Reason for cancellation *</label>
              <textarea className={`${inp} resize-none`} rows={3} placeholder="e.g. Return of items, clerical typo, order modified"
                value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>

            {cancelError && <p className="text-xs text-red-600 font-medium">{cancelError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(''); setCancelError('') }}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Back
              </button>
              <button onClick={handleCancelInvoice} disabled={cancelling}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
