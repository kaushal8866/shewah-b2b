'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, ORDER_STATUSES, computeOrderCogs } from '@/lib/supabase'
import { cascadeOrderStatusToMfg } from '@/lib/mfgOrderLifecycle'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, ChevronRight, Check, Package, Layers, AlertTriangle, MessageSquare } from 'lucide-react'
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

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data }, { data: mp }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, partners(store_name, owner_name, phone, city), products(code, name, gold_weight_g, gold_karat, diamond_weight, diamond_type)')
        .eq('id', id)
        .single(),
      supabase.from('manufacturing_partners').select('id, name, city').order('name'),
    ])
    if (!data) { router.push('/orders'); return }
    setOrder(data)
    setForm(data)
    setMfgPartners(mp || [])

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

  async function advanceStage(opts?: { skipMaterialCheck?: boolean }) {
    if (!nextStage) return
    const err = checkCompletionGuard(nextStage.value)
    if (err) { setGuardError(err); return }

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
            <h2 className="font-medium text-stone-900 mb-4">Pricing &amp; payment</h2>
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
              COGS = (gold weight × rate × karat purity) + making + CAD + stone. Margin recalculated against total amount.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
