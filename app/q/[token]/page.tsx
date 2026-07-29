'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, RefreshCw, Send, AlertTriangle, FileText, Check } from 'lucide-react'

interface QuoteDetail {
  id: string
  quote_number: string
  quote_date: string
  valid_until: string
  reference_no: string | null
  gst_treatment: 'exclusive' | 'inclusive' | 'none'
  gst_rate_pct: number
  cover_note: string | null
  terms_text: string | null
  subtotal: number
  gst_amount: number
  grand_total: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'converted_to_order'
  walk_in_name: string | null
  walk_in_phone: string | null
  walk_in_city: string | null
  partners: {
    name: string
    store_name: string | null
    city: string | null
  } | null
}

interface QuoteItem {
  name: string
  category?: string
  ring_size?: string
  quantity: number
  karat: string | number
  gross_gold_weight_g: number
  net_24kt_weight_g?: number
  gold_rate_24k?: number
  making_charges?: number
  hallmarking?: number
  other_charges?: number
  other_charges_label?: string
  diamonds?: any[]
  line_trade: number
  line_total: number
  reference_images?: string[]
}

export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const token = params.token

  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number>(200)

  // Interactive states
  const [responseMode, setResponseMode] = useState<'view' | 'request_changes' | 'accepted_success'>('view')
  const [revisionNote, setRevisionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadQuote()
  }, [token])

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
      
      // If quote is already accepted or converted, skip response form and show accepted screen
      if (data.quote.status === 'accepted' || data.quote.status === 'converted_to_order') {
        setResponseMode('accepted_success')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('A network error occurred. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Quote Approval
  async function handleAccept() {
    if (!confirm('Are you sure you want to approve and accept this quotation?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/share/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      if (res.ok) {
        setResponseMode('accepted_success')
        if (quote) {
          setQuote({ ...quote, status: 'accepted' })
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Response submission failed')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Revision Submission
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
        body: JSON.stringify({
          action: 'request_changes',
          note: revisionNote
        })
      })

      if (res.ok) {
        alert('Your revision request has been sent to our design desk. We will get back to you shortly!')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-accent/35 border-t-accent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-serif italic text-stone-500 tracking-wide">Retrieving your quotation details...</p>
      </div>
    )
  }

  // Error views (Link Expired / Invalid)
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
  const clientCity = quote.partners ? quote.partners.city : quote.walk_in_city

  return (
    <div className="min-h-screen bg-white text-stone-800 font-sans pb-24">
      
      {/* Brand Header */}
      <header className="border-b border-accent/20 bg-white py-4 px-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
        <div>
          <span className="font-serif font-bold text-lg tracking-wider text-accent">SHEWAH</span>
          <span className="text-[9px] block uppercase tracking-widest text-stone-400 font-medium">B2B Fine Jewellery</span>
        </div>
        <a href={`/api/quotes/share/${token}/pdf?download=1`}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-accent/30 text-xs font-semibold text-accent rounded-lg bg-white/30 hover:bg-white">
          <Download className="w-3.5 h-3.5" /> PDF
        </a>
      </header>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Greetings Panel */}
        <div className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-2">
          <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-semibold">
            OFFICIAL QUOTATION
          </span>
          <h1 className="text-xl font-serif font-bold text-stone-800">
            Dear {clientName.split(' ')[0]},
          </h1>
          <p className="text-stone-500 text-sm font-light leading-relaxed">
            Please find the detailed quotation sheet {quote.quote_number} prepared for you. 
            Review the specifications, gold weights, and item breakdowns. This quotation is valid until{' '}
            <strong className="font-semibold">{new Date(quote.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.
          </p>
          {quote.cover_note && (
            <div className="border-l-2 border-accent pl-3 py-1 text-xs text-stone-600 font-serif italic mt-3 bg-stone-50/30">
              "{quote.cover_note}"
            </div>
          )}
        </div>

        {/* Full-width PDF Viewer */}
        <div className="w-full bg-stone-100 rounded-2xl border border-stone-200 overflow-hidden shadow-inner" style={{ height: '82vh', minHeight: '560px' }}>
          {/* Desktop & Tablet: embedded iframe */}
          <iframe
            src={`/api/quotes/share/${token}/pdf`}
            className="w-full h-full border-none hidden sm:block"
            title="Quotation PDF Sheet"
          />
          {/* Mobile: prominent download button instead of tiny iframe */}
          <div className="sm:hidden w-full h-full flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div className="text-center">
              <p className="font-serif font-bold text-stone-800 text-base">Your Quotation is Ready</p>
              <p className="text-stone-500 text-xs mt-1">Tap below to open the full PDF with all details</p>
            </div>
            <a href={`/api/quotes/share/${token}/pdf`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-md hover:bg-accent transition-colors">
              <Download className="w-4 h-4" /> Open Full PDF
            </a>
          </div>
        </div>

        {/* Compact Totals Strip */}
        <div className="bg-white rounded-2xl border border-accent/15 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-stone-400 block">Subtotal</span>
                <span className="font-semibold text-stone-800">₹ {quote.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {quote.gst_treatment !== 'none' && (
                <div>
                  <span className="text-xs text-stone-400 block">
                    GST {quote.gst_treatment === 'inclusive' ? '(Included)' : 'Extra'} ({quote.gst_rate_pct}%)
                  </span>
                  <span className="font-semibold text-stone-800">₹ {quote.gst_amount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-400 block">Grand Total</span>
              <span className="font-serif font-bold text-xl text-accent">₹ {quote.grand_total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Client Responses Panel */}
        {responseMode === 'view' && (
          <div className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-stone-800 border-b border-stone-100 pb-2 text-sm">Do you approve this quotation?</h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleAccept} disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-md disabled:opacity-50">
                <Check className="w-4 h-4" /> Accept &amp; Approve Quote
              </button>
              
              <button onClick={() => setResponseMode('request_changes')} disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-100 text-stone-700 py-3 rounded-xl font-semibold hover:bg-stone-200 transition-colors disabled:opacity-50">
                <RefreshCw className="w-4 h-4 text-stone-500" /> Request Revision / Changes
              </button>
            </div>
          </div>
        )}

        {responseMode === 'request_changes' && (
          <div className="bg-white rounded-2xl border border-accent/15 p-5 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-stone-800 border-b border-stone-100 pb-2 text-sm">Request Revision</h3>
            <p className="text-xs text-stone-500 font-light">
              Describe the adjustments or weight/size changes you require. Our designers will revise and notify you.
            </p>
            
            <textarea
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:border-accent outline-none min-h-[100px] resize-none"
              placeholder="e.g. Please change karat to 22K for the second item, or adjust size to 16..."
              value={revisionNote}
              onChange={e => setRevisionNote(e.target.value)}
            />

            <div className="flex gap-2 justify-end">
              <button onClick={() => setResponseMode('view')} disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-stone-500 border border-stone-200 rounded-lg bg-white">
                Back
              </button>
              <button onClick={handleRequestChanges} disabled={actionLoading}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-accent">
                <Send className="w-3.5 h-3.5" /> Submit Request
              </button>
            </div>
          </div>
        )}

        {responseMode === 'accepted_success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center max-w-md mx-auto shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-200 mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-emerald-900 text-base">Quotation Accepted!</h3>
            <p className="text-xs text-emerald-700 mt-2 font-light">
              You have successfully approved this quotation. Our sales desk is processing it into a wholesale production order. 
              We will keep you updated on the progress!
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
