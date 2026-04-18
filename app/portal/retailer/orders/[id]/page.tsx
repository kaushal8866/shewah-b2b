'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, Clock, FileText, Calendar, CheckCircle2, Circle, Sparkles, X } from 'lucide-react'

const PIPELINE = [
  { value: 'brief_received', label: 'Brief received' },
  { value: 'cad_in_progress', label: 'CAD in progress' },
  { value: 'cad_sent', label: 'CAD shared with you' },
  { value: 'design_approved', label: 'Design approved' },
  { value: 'in_production', label: 'In production' },
  { value: 'qc', label: 'Quality check' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
]

const STATUS_STYLES: Record<string, string> = {
  brief_received: 'bg-blue-100 text-blue-700',
  cad_in_progress: 'bg-purple-100 text-purple-700',
  cad_sent: 'bg-purple-100 text-purple-700',
  cad_approved: 'bg-purple-100 text-purple-700',
  design_approved: 'bg-purple-100 text-purple-700',
  in_production: 'bg-amber-100 text-amber-700',
  qc: 'bg-amber-100 text-amber-700',
  dispatched: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

export default function RetailerOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<any>(null)
  const [cad, setCad] = useState<any>(null)
  const [revisions, setRevisions] = useState<any[]>([])
  const [error, setError] = useState('')

  // CAD action state
  const [reviseOpen, setReviseOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  function load() {
    fetch(`/api/portal/retailer/orders/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setOrder(d.order)
          setCad(d.cad_request || null)
          setRevisions(Array.isArray(d.cad_revisions) ? d.cad_revisions : [])
        }
      })
      .catch(e => setError(e.message))
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  async function submitCadAction(action: 'approve' | 'revise') {
    setSubmitting(true)
    setActionError('')
    try {
      const res = await fetch(`/api/portal/retailer/orders/${id}/cad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: action === 'revise' ? feedback.trim() : undefined }),
      })
      const d = await res.json()
      if (!res.ok) { setActionError(d.error || 'Something went wrong.'); return }
      setReviseOpen(false)
      setFeedback('')
      load()
    } catch (e: any) {
      setActionError(e.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (error && !order) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <Link href="/portal/retailer/orders" className="text-stone-400 hover:text-stone-600 inline-flex items-center gap-1.5 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> My orders
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      </div>
    )
  }

  if (!order) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>
  }

  const currentIdx = PIPELINE.findIndex(p => p.value === order.status)
  const isCancelled = order.status === 'cancelled'
  const referenceImages: string[] = order.brief_images || []
  const productImages: string[] = order.product?.photo_urls || []
  const heroImage = productImages[0] || referenceImages[0]

  const cadRenders: string[] = cad?.render_images || []
  const cadStatus: string | undefined = cad?.status
  const canActOnCad = cadStatus === 'sent'

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      <Link href="/portal/retailer/orders" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-stone-900">{order.order_number}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status] || 'bg-stone-100 text-stone-600'}`}>
                {order.status?.replace(/_/g, ' ')}
              </span>
              {order.type === 'custom' && (
                <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">CUSTOM</span>
              )}
            </div>
            <p className="text-sm text-stone-500">
              Ordered {fmtDate(order.order_date)} · Expected {fmtDate(order.expected_delivery)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-stone-900">₹{(order.total_amount || 0).toLocaleString('en-IN')}</p>
            {order.balance_due > 0 ? (
              <p className="text-xs text-amber-600">₹{order.balance_due.toLocaleString('en-IN')} balance due</p>
            ) : (
              <p className="text-xs text-green-600">Paid in full</p>
            )}
          </div>
        </div>
      </div>

      {cad && cadRenders.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-medium text-stone-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C49C64]" /> CAD design for your review
            </h2>
            {cadStatus === 'approved' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                Approved {cad.approved_date ? `· ${fmtDate(cad.approved_date)}` : ''}
              </span>
            )}
            {cadStatus === 'revision_requested' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                Revision requested
              </span>
            )}
            {cadStatus === 'sent' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                Awaiting your decision
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {cadRenders.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                className="block aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                <img src={src} alt={`CAD render ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>

          {revisions.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-stone-400 mb-2">Revision history</p>
              <ol className="space-y-3 border-l border-stone-200 pl-4">
                {revisions.map((r) => {
                  const dot =
                    r.kind === 'approval'
                      ? 'bg-green-500'
                      : r.kind === 'revision_request'
                      ? 'bg-amber-500'
                      : 'bg-[#C49C64]'
                  const label =
                    r.kind === 'approval'
                      ? 'You approved the design'
                      : r.kind === 'revision_request'
                      ? 'You requested a revision'
                      : 'New CAD render shared'
                  const imgs: string[] = Array.isArray(r.render_images) ? r.render_images : []
                  return (
                    <li key={r.id} className="relative">
                      <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} />
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium text-stone-800">{label}</p>
                        <p className="text-[11px] text-stone-400">{fmtDate(r.created_at)}</p>
                      </div>
                      {r.note && (
                        <p className="text-sm text-stone-600 whitespace-pre-line mt-1">{r.note}</p>
                      )}
                      {imgs.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2">
                          {imgs.map((src, i) => (
                            <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                              className="block aspect-square bg-stone-100 rounded-md overflow-hidden border border-stone-200">
                              <img src={src} alt={`Render ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {actionError && (
            <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {actionError}
            </div>
          )}

          {canActOnCad ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => submitCadAction('approve')}
                disabled={submitting}
                className="bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Approve design'}
              </button>
              <button
                onClick={() => { setReviseOpen(true); setActionError('') }}
                disabled={submitting}
                className="border border-stone-200 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                Request revision
              </button>
            </div>
          ) : cadStatus === 'revision_requested' ? (
            <p className="text-xs text-stone-500">We've shared your feedback with the design team. You'll see an updated render here once it's ready.</p>
          ) : cadStatus === 'approved' ? (
            <p className="text-xs text-stone-500">Thanks — production will start using this approved design.</p>
          ) : null}
        </div>
      )}

      {!isCancelled && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <h2 className="font-medium text-stone-900 mb-4">Progress</h2>
          <div className="space-y-4">
            {PIPELINE.map((s, i) => {
              const done = i < currentIdx
              const active = i === currentIdx
              return (
                <div key={s.value} className="flex items-center gap-3">
                  {done || active ? (
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${active ? 'text-[#1E3A5F]' : 'text-green-500'}`} />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-200 shrink-0" />
                  )}
                  <p className={`text-sm ${done || active ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>
                    {s.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-stone-400" /> What you ordered
          </h2>
          {heroImage && (
            <div className="aspect-video bg-stone-100 rounded-lg overflow-hidden mb-3">
              <img src={heroImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {order.product && (
            <div className="mb-3">
              <p className="text-xs text-stone-400">{order.product.code}</p>
              <p className="font-medium text-stone-800">{order.product.name}</p>
              <p className="text-xs text-stone-500 mt-1">
                {order.product.gold_karat ? `${order.product.gold_karat}K · ` : ''}
                {order.product.diamond_weight ? `${order.product.diamond_weight}ct ${order.product.diamond_shape || ''}` : ''}
                {order.product.diamond_quality ? ` · ${order.product.diamond_quality}/${order.product.diamond_color || ''}` : ''}
              </p>
            </div>
          )}
          {order.brief_text && (
            <div className="mb-3">
              <p className="text-xs text-stone-400 mb-1">Design brief</p>
              <p className="text-sm text-stone-700 whitespace-pre-line">{order.brief_text}</p>
            </div>
          )}
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-stone-400">Quantity</dt>
              <dd className="text-stone-700">{order.quantity}</dd>
            </div>
            {order.ring_size && (
              <div className="flex justify-between">
                <dt className="text-stone-400">Ring size</dt>
                <dd className="text-stone-700">{order.ring_size}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-400">Trade price</dt>
              <dd className="text-stone-700">₹{(order.trade_price || 0).toLocaleString('en-IN')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-400">Advance paid</dt>
              <dd className="text-stone-700">₹{(order.advance_paid || 0).toLocaleString('en-IN')}</dd>
            </div>
          </dl>
          {order.special_notes && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-1">Your notes</p>
              <p className="text-sm text-stone-700 whitespace-pre-line">{order.special_notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-stone-400" /> Dispatch &amp; delivery
            </h2>
            {order.dispatch_date || order.tracking_number || order.courier ? (
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-stone-400">Dispatch date</dt>
                  <dd className="text-stone-700">{fmtDate(order.dispatch_date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-400">Courier</dt>
                  <dd className="text-stone-700">{order.courier || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-400">Tracking number</dt>
                  <dd className="text-stone-700 font-mono text-xs">{order.tracking_number || '—'}</dd>
                </div>
                {order.actual_delivery && (
                  <div className="flex justify-between">
                    <dt className="text-stone-400">Delivered on</dt>
                    <dd className="text-green-600 font-medium">{fmtDate(order.actual_delivery)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6 text-stone-400">
                <Clock className="w-8 h-8 mb-2 text-stone-300" />
                <p className="text-sm">Tracking details will appear once your order is dispatched.</p>
              </div>
            )}
          </div>

          {referenceImages.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-400" /> Reference images
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {referenceImages.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                    className="block aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {reviseOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-stone-900">Request a revision</h3>
                <p className="text-xs text-stone-500 mt-0.5">Tell the design team what you'd like changed.</p>
              </div>
              <button onClick={() => { setReviseOpen(false); setFeedback('') }}
                className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="e.g. Make the centre stone slightly larger and switch to a hidden halo."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none resize-none mb-1"
            />
            <p className="text-[11px] text-stone-400 mb-4">{feedback.length}/2000</p>
            {actionError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {actionError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setReviseOpen(false); setFeedback('') }}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={() => submitCadAction('revise')}
                disabled={submitting || !feedback.trim()}
                className="flex-1 bg-[#C49C64] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
                {submitting ? 'Sending...' : 'Send to design team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
