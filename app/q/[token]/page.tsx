'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2, RefreshCw, Send, AlertTriangle, Check, Clock,
  ShieldCheck, Upload, Loader2, Copy, Gem, CircleDollarSign,
} from 'lucide-react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'

interface DiamondRow {
  size: string
  color: string
  clarity: string
  shape: string
  pieces: number
  rate: number
  ct_per_pc: number
  weight: number
  total: number
}

interface Breakdown {
  quantity: number
  unit_trade: number
  gold_component: string
  gold_rate: number
  gold_weight: number
  gold_val: number
  diamond_label: string
  dia_count: number
  dia_weight: number
  dia_val: number
  making_charges: number
  total_raw: number
  discount: number
  sub_total: number
  gst: number
  show_gst: boolean
  gst_label: string
  final_value: number
  rows: DiamondRow[]
}

interface QuoteDetail {
  id: string
  quote_number: string
  quote_date: string
  valid_until: string
  reference_no: string | null
  gst_treatment: 'exclusive' | 'inclusive' | 'none'
  gst_rate_pct: number
  show_breakup: boolean
  cover_note: string | null
  terms_text: string | null
  subtotal: number
  gst_amount: number
  grand_total: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'converted_to_order'
  walk_in_name: string | null
  walk_in_phone: string | null
  walk_in_city: string | null
  partners: { name: string; store_name: string | null; city: string | null } | null
}

interface QuoteItem {
  name: string
  category?: string
  ring_size?: string
  quantity: number
  karat: string | number
  gross_gold_weight_g: number
  net_24kt_weight_g?: number
  line_trade: number
  line_total: number
  reference_images?: string[]
  breakdown?: Breakdown
}

type AdvanceStatus = 'not_requested' | 'awaiting_payment' | 'proof_submitted' | 'verified' | 'waived'

interface Advance {
  status: AdvanceStatus
  due: number
  gold_value: number
  diamond_value: number
  gold_pct: number
  diamond_pct: number
  balance_due: number
  reference: string | null
  proof_url: string | null
  paid_amount: number | null
  submitted_at: string | null
  verified_at: string | null
  note: string | null
}

interface Bank {
  account_name: string
  bank_name: string
  account_no: string
  ifsc: string
  upi: string
}

const inr = (n: number) => `₹ ${Math.round(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const token = params.token

  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [advance, setAdvance] = useState<Advance | null>(null)
  const [bank, setBank] = useState<Bank | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number>(200)

  const [responseMode, setResponseMode] = useState<'view' | 'request_changes' | 'accepted'>('view')
  const [revisionNote, setRevisionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Advance submission form
  const [payRef, setPayRef] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadQuote() }, [token])

  async function loadQuote() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/share/${token}`)
      setStatusCode(res.status)
      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error || 'Failed to load quote details')
        return
      }
      const data = await res.json()
      setQuote(data.quote)
      setItems(data.items || [])
      setAdvance(data.advance || null)
      setBank(data.bank || null)
      if (data.quote.status === 'accepted' || data.quote.status === 'converted_to_order') {
        setResponseMode('accepted')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('A network error occurred. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!confirm('Approve this quotation at the prices shown?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/share/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      if (res.ok) {
        setResponseMode('accepted')
        // Reload so the advance panel gets its frozen figures and bank details.
        await loadQuote()
      } else {
        const err = await res.json()
        alert(err.error || 'Could not record your approval')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRequestChanges() {
    if (!revisionNote.trim()) {
      alert('Please describe what changes you would like us to make.')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/share/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_changes', note: revisionNote }),
      })
      if (res.ok) {
        alert('Your revision request has been sent to our design desk.')
        setResponseMode('view')
        setRevisionNote('')
      } else {
        const err = await res.json()
        alert(err.error || 'Submission failed')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleProofUpload(file: File) {
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'quote-advance', token)
      setProofUrl(url)
    } catch (err: any) {
      alert(err?.message || 'Upload failed. You can still submit the reference number instead.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmitAdvance() {
    if (!payRef.trim() && !proofUrl) {
      alert('Enter the payment reference (UTR) or attach a screenshot.')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/share/${token}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: payRef.trim(),
          proof_url: proofUrl,
          paid_amount: payAmount ? Number(payAmount) : undefined,
        }),
      })
      if (res.ok) {
        await loadQuote()
      } else {
        const err = await res.json()
        alert(err.error || 'Could not record your payment')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-accent/35 border-t-accent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-serif italic text-stone-500 tracking-wide">Retrieving your quotation…</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-serif font-bold text-stone-800 tracking-tight">Quotation Unavailable</h1>
        <p className="text-stone-500 text-sm mt-2 font-light leading-relaxed">
          {statusCode === 410 ? 'This quotation link has expired or has been revised by our desk.' : errorMsg}
        </p>
        <p className="text-[11px] text-stone-400 mt-4 italic">
          If you believe this is an error, please get in touch with Shewah Support via WhatsApp.
        </p>
      </div>
    )
  }

  if (!quote) return null

  const clientName = quote.partners ? (quote.partners.store_name || quote.partners.name) : (quote.walk_in_name || 'Valued Customer')
  const isAccepted = quote.status === 'accepted' || quote.status === 'converted_to_order'
  const expired = new Date(quote.valid_until).setHours(23, 59, 59, 999) < Date.now()
  const showActions = !isAccepted && !expired

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans pb-32">

      {/* Brand Header */}
      <header className="border-b border-accent/20 bg-white py-4 px-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
        <span className="font-serif font-bold text-lg tracking-wider text-accent">SHEWAH</span>
        <span className="text-[11px] font-semibold text-stone-500 tabular-nums">{quote.quote_number}</span>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Greeting */}
        <section className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-3">
          <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 font-semibold rounded">
            OFFICIAL QUOTATION
          </span>
          <h1 className="text-xl font-serif font-bold text-stone-800">Dear {clientName.split(' ')[0]},</h1>
          <p className="text-stone-500 text-sm font-light leading-relaxed">
            Here is your quotation prepared on {fmtDate(quote.quote_date)}. Every weight, stone and
            charge is itemised below.
          </p>

          {/* Rate validity — gold moves daily, so this is the headline caveat. */}
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs border ${
            expired ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-600'
          }`}>
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {expired ? (
                <>These prices <strong>expired on {fmtDate(quote.valid_until)}</strong>. Gold rates move daily —
                please ask us for a fresh quotation.</>
              ) : (
                <>Prices hold <strong>until {fmtDate(quote.valid_until)}</strong>. Gold and diamond rates move
                daily, so please confirm within this window.</>
              )}
            </span>
          </div>

          {quote.cover_note && (
            <div className="border-l-2 border-accent pl-3 py-1 text-xs text-stone-600 font-serif italic whitespace-pre-line bg-stone-50/40">
              {quote.cover_note}
            </div>
          )}
        </section>

        {/* Items */}
        {items.map((item, i) => {
          const bd = item.breakdown
          return (
            <section key={i} className="bg-white rounded-2xl border border-accent/15 shadow-sm overflow-hidden">
              <div className="p-4 flex items-start gap-3 border-b border-stone-100">
                {item.reference_images?.[0] && (
                  <img src={item.reference_images[0]} alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover border border-stone-200 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif font-bold text-stone-800 leading-tight">{item.name}</h2>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {typeof item.karat === 'number' ? `${item.karat}K` : item.karat}
                    {item.ring_size ? ` · Size ${item.ring_size}` : ''} · Qty {item.quantity}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-serif font-bold text-accent text-lg leading-tight">{inr(item.line_total)}</div>
                  {item.quantity > 1 && bd && (
                    <div className="text-[10px] text-stone-400">{inr(bd.unit_trade)} / pc</div>
                  )}
                </div>
              </div>

              {bd && (
                <div className="p-4 space-y-3 bg-stone-50/40">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                    Cost breakdown{item.quantity > 1 ? ` · for ${item.quantity} pcs` : ''}
                  </p>

                  {/* Component rows — a definition list reads better on a phone
                      than a table squeezed to 360px. */}
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-stone-600">
                        {bd.gold_component}
                        <span className="block text-[11px] text-stone-400">
                          {bd.gold_weight.toFixed(2)}g @ {inr(bd.gold_rate)}/g
                        </span>
                      </dt>
                      <dd className="font-semibold tabular-nums">{inr(bd.gold_val)}</dd>
                    </div>

                    {bd.dia_count > 0 && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-stone-600">
                          Diamonds — {bd.diamond_label}
                          <span className="block text-[11px] text-stone-400">
                            {bd.dia_count} stone{bd.dia_count > 1 ? 's' : ''} · {bd.dia_weight.toFixed(2)} ct
                          </span>
                        </dt>
                        <dd className="font-semibold tabular-nums">{inr(bd.dia_val)}</dd>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-stone-600">Making &amp; finishing</dt>
                      <dd className="font-semibold tabular-nums">{inr(bd.making_charges)}</dd>
                    </div>

                    {bd.show_gst && bd.gst > 0 && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-stone-600">{bd.gst_label}</dt>
                        <dd className="font-semibold tabular-nums">{inr(bd.gst)}</dd>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-stone-200">
                      <dt className="font-semibold text-stone-800">Item total</dt>
                      <dd className="font-serif font-bold text-accent tabular-nums">{inr(bd.final_value)}</dd>
                    </div>
                  </dl>

                  {/* Stone-by-stone detail */}
                  {bd.rows.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] font-semibold text-accent flex items-center gap-1.5 py-1">
                        <Gem className="w-3.5 h-3.5" />
                        Diamond details ({bd.rows.length} {bd.rows.length > 1 ? 'lines' : 'line'})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {bd.rows.map((r, ri) => (
                          <div key={ri} className="rounded-xl border border-stone-200 bg-white p-3 text-[11px]">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-semibold text-stone-700">
                                {r.shape}{r.size !== '—' ? ` · ${r.size}` : ''}
                              </span>
                              <span className="font-semibold text-accent tabular-nums">{inr(r.total)}</span>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-stone-500">
                              <div className="flex justify-between"><dt>Stones</dt><dd className="tabular-nums text-stone-700">{r.pieces}</dd></div>
                              <div className="flex justify-between"><dt>Total ct</dt><dd className="tabular-nums text-stone-700">{r.weight.toFixed(2)}</dd></div>
                              <div className="flex justify-between"><dt>Ct / stone</dt><dd className="tabular-nums text-stone-700">{r.ct_per_pc.toFixed(3)}</dd></div>
                              <div className="flex justify-between"><dt>Rate / ct</dt><dd className="tabular-nums text-stone-700">{inr(r.rate)}</dd></div>
                              {r.clarity !== '—' && (
                                <div className="flex justify-between"><dt>Clarity</dt><dd className="text-stone-700">{r.clarity}</dd></div>
                              )}
                              {r.color !== '—' && (
                                <div className="flex justify-between"><dt>Colour</dt><dd className="text-stone-700">{r.color}</dd></div>
                              )}
                            </dl>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>
          )
        })}

        {/* Totals */}
        <section className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt>
              <dd className="font-semibold tabular-nums">{inr(quote.subtotal)}</dd></div>
            {quote.gst_treatment !== 'none' && (
              <div className="flex justify-between">
                <dt className="text-stone-500">
                  GST {quote.gst_treatment === 'inclusive' ? '(included)' : `(${quote.gst_rate_pct}% extra)`}
                </dt>
                <dd className="font-semibold tabular-nums">{inr(quote.gst_amount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-3 border-t border-stone-200">
              <dt className="font-semibold text-stone-800">Grand Total</dt>
              <dd className="font-serif font-bold text-2xl text-accent tabular-nums">{inr(quote.grand_total)}</dd>
            </div>
          </dl>
        </section>

        {/* Advance */}
        {isAccepted && advance && advance.status !== 'not_requested' && (
          <section className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-stone-800 text-sm flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4 text-accent" /> Advance Payment
            </h3>

            {advance.status === 'verified' && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-emerald-900 text-sm">Advance received</p>
                <p className="text-xs text-emerald-700 mt-1">
                  We have confirmed {inr(advance.paid_amount || advance.due)} and your piece is in production.
                  Balance of {inr(advance.balance_due)} is due on delivery.
                </p>
              </div>
            )}

            {advance.status === 'waived' && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-emerald-900 text-sm">Production started</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Our desk has released this order without an advance. {inr(quote.grand_total)} is due on delivery.
                </p>
              </div>
            )}

            {advance.status === 'proof_submitted' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Clock className="w-5 h-5 shrink-0" />
                  <p className="font-semibold text-sm">Payment under verification</p>
                </div>
                <p className="text-xs text-amber-700 mt-1.5">
                  We are checking {inr(advance.paid_amount || advance.due)}
                  {advance.reference ? ` against reference ${advance.reference}` : ''}. You will hear from us shortly.
                </p>
              </div>
            )}

            {advance.status === 'awaiting_payment' && (
              <>
                <div className="rounded-xl bg-accent/5 border border-accent/20 p-4">
                  <p className="text-xs text-stone-500">Payable now to begin production</p>
                  <p className="font-serif font-bold text-2xl text-accent tabular-nums">{inr(advance.due)}</p>
                  <dl className="mt-3 space-y-1 text-[11px] text-stone-600">
                    <div className="flex justify-between">
                      <dt>Gold value ({advance.gold_pct}%)</dt>
                      <dd className="tabular-nums">{inr(advance.gold_value * advance.gold_pct / 100)}</dd>
                    </div>
                    {advance.diamond_value > 0 && (
                      <div className="flex justify-between">
                        <dt>Diamond value ({advance.diamond_pct}%)</dt>
                        <dd className="tabular-nums">{inr(advance.diamond_value * advance.diamond_pct / 100)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-accent/15 text-stone-500">
                      <dt>Balance on delivery</dt>
                      <dd className="tabular-nums">{inr(advance.balance_due)}</dd>
                    </div>
                  </dl>
                  <p className="text-[10px] text-stone-400 mt-2">
                    Gold is charged in full up front because the rate moves daily. Making charges and GST are
                    payable with the balance.
                  </p>
                </div>

                {bank && (bank.account_no || bank.upi) && (
                  <div className="rounded-xl border border-stone-200 p-3 text-xs space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Transfer to</p>
                    {bank.account_name && <Row label="Name" value={bank.account_name} onCopy={copy} copied={copied} />}
                    {bank.bank_name && <Row label="Bank" value={bank.bank_name} onCopy={copy} copied={copied} />}
                    {bank.account_no && <Row label="A/C" value={bank.account_no} onCopy={copy} copied={copied} />}
                    {bank.ifsc && <Row label="IFSC" value={bank.ifsc} onCopy={copy} copied={copied} />}
                    {bank.upi && <Row label="UPI" value={bank.upi} onCopy={copy} copied={copied} />}
                  </div>
                )}

                <div className="space-y-2.5">
                  <p className="text-[11px] text-stone-500">
                    Once you have transferred, share the reference so we can verify it.
                  </p>
                  <input
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:border-accent outline-none"
                    placeholder="Payment reference / UTR number"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                  />
                  <input
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:border-accent outline-none"
                    placeholder={`Amount sent (default ${inr(advance.due)})`}
                    inputMode="numeric"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  />

                  <label className={`flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-xs font-semibold cursor-pointer transition-colors ${
                    proofUrl ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-300 text-stone-500 hover:border-accent'
                  }`}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : proofUrl ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading…' : proofUrl ? 'Screenshot attached' : 'Attach payment screenshot (optional)'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(f) }} />
                  </label>

                  <button onClick={handleSubmitAdvance} disabled={actionLoading || uploading}
                    className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    I have paid the advance
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* Accepted confirmation (shown when no advance is being collected) */}
        {isAccepted && (!advance || advance.status === 'not_requested') && (
          <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
            <h3 className="font-serif font-bold text-emerald-900 text-base">Quotation accepted</h3>
            <p className="text-xs text-emerald-700 mt-2 font-light">
              Our desk is processing this into a production order. We will keep you updated.
            </p>
          </section>
        )}

        {/* Revision form */}
        {responseMode === 'request_changes' && (
          <section className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-3">
            <h3 className="font-serif font-bold text-stone-800 text-sm">Request a revision</h3>
            <p className="text-xs text-stone-500 font-light">
              Describe the adjustments you need — karat, size, stone quality or weight.
            </p>
            <textarea
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:border-accent outline-none min-h-[110px] resize-none"
              placeholder="e.g. Please change to 18K, and reduce the centre stone to 0.75ct"
              value={revisionNote}
              onChange={e => setRevisionNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResponseMode('view')} disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-stone-500 border border-stone-200 rounded-lg bg-white">
                Back
              </button>
              <button onClick={handleRequestChanges} disabled={actionLoading}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-lg text-xs font-semibold">
                <Send className="w-3.5 h-3.5" /> Submit request
              </button>
            </div>
          </section>
        )}

        {/* Terms */}
        <section className="px-1 pb-2">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-1.5">Terms &amp; Conditions</p>
          <p className="text-[11px] text-stone-500 font-light leading-relaxed whitespace-pre-line">
            {quote.terms_text || 'Standard terms apply.'}
          </p>
        </section>
      </div>

      {/* Sticky action bar — reachable with a thumb, unlike a button far down a long page. */}
      {showActions && responseMode === 'view' && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-3xl mx-auto flex items-center gap-2.5">
            <button onClick={() => setResponseMode('request_changes')} disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold text-stone-600 bg-stone-100 disabled:opacity-50 shrink-0">
              <RefreshCw className="w-4 h-4" /> Changes
            </button>
            <button onClick={handleAccept} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Approve {inr(quote.grand_total)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, onCopy, copied }: {
  label: string; value: string; onCopy: (l: string, v: string) => void; copied: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-400">{label}</span>
      <button onClick={() => onCopy(label, value)} className="flex items-center gap-1.5 font-semibold text-stone-700 tabular-nums">
        {value}
        {copied === label ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-300" />}
      </button>
    </div>
  )
}
