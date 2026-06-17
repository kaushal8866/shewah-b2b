'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, Share2, Copy, RefreshCw, ShoppingBag, Calendar, User, Info, FileText } from 'lucide-react'
import Link from 'next/link'

interface QuoteDetail {
  id: string
  quote_number: string
  walk_in_name: string | null
  walk_in_phone: string | null
  walk_in_city: string | null
  reference_no: string | null
  quote_date: string
  valid_until: string
  gst_treatment: 'exclusive' | 'inclusive' | 'none'
  gst_rate_pct: number
  margin_pct: number
  show_breakup: boolean
  show_24kt_column: boolean
  cover_note: string | null
  terms_text: string | null
  subtotal: number
  gst_amount: number
  grand_total: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'converted_to_order'
  share_token: string | null
  shared_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  customer_response_note: string | null
  parent_quote_id: string | null
  converted_order_id: string | null
  partners: {
    id: string
    name: string
    store_name: string | null
    city: string | null
    phone: string | null
  } | null
  prepared_by_user: {
    display_name: string
    username: string
  } | null
}

interface RevisionNode {
  id: string
  quote_number: string
  status: string
  created_at: string
}

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const id = params.id

  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [revisions, setRevisions] = useState<RevisionNode[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadQuoteDetails()
  }, [id])

  async function loadQuoteDetails() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          alert('Quotation not found')
          router.push('/quotes')
        }
        return
      }

      const data = await res.json()
      const q: QuoteDetail = data.quote

      // If quote is in draft, redirect to edit page
      if (q.status === 'draft') {
        router.replace(`/quotes/new?id=${q.id}`)
        return
      }

      setQuote(q)

      // Fetch revisions tree
      const ancestorId = q.parent_quote_id || q.id
      const { data: revList } = await supabase
        .from('quotes')
        .select('id, quote_number, status, created_at')
        .or(`parent_quote_id.eq.${ancestorId},id.eq.${ancestorId}`)
        .order('created_at', { ascending: false })
      
      setRevisions(revList || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Action handlers
  async function handleSend() {
    if (!quote) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        loadQuoteDetails()
        if (d.waUrl) {
          window.open(d.waUrl, '_blank')
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to dispatch WhatsApp link')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRevise() {
    if (!quote) return
    if (!confirm('Are you sure you want to create a new draft revision of this quotation?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/revise`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        router.push(`/quotes/${d.quote.id}`)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to create revision')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConvertToOrder() {
    if (!quote) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/convert-to-order`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        if (d.items && d.items.length > 0) {
          const payload = d.items[0]
          sessionStorage.setItem('prefill_order_payload', JSON.stringify(payload))
          router.push('/orders/new?source=quote')
        } else {
          alert('No items found to convert.')
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to convert quote')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  function handleCopyLink() {
    if (!quote?.share_token) return
    const url = `${window.location.origin}/q/${quote.share_token}`
    navigator.clipboard.writeText(url)
    alert('Magic link copied to clipboard!')
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'viewed': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'accepted': return 'bg-green-50 text-green-700 border-green-200'
      case 'converted_to_order': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'expired': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading quotation...</div>
  }

  if (!quote) {
    return <div className="p-4 lg:p-7 text-red-500 text-sm">Failed to load quotation details.</div>
  }

  const clientName = quote.partners ? (quote.partners.store_name || quote.partners.name) : (quote.walk_in_name || 'Walk-in Customer')
  const clientCity = quote.partners ? quote.partners.city : quote.walk_in_city
  const clientPhone = quote.partners ? quote.partners.phone : quote.walk_in_phone

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto pb-16">
      
      {/* Top Navigation Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-lg bg-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">{quote.quote_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-semibold border rounded-full ${getStatusStyle(quote.status)}`}>
                {quote.status.replace(/_/g, ' ')}
              </span>
            </div>
            {quote.reference_no && (
              <p className="text-stone-500 text-xs mt-0.5">Reference: {quote.reference_no}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Stream / Download PDF */}
          <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 bg-white hover:bg-stone-50">
            <Download className="w-3.5 h-3.5" /> View PDF
          </a>

          {/* Copy magic link */}
          {quote.share_token && (
            <button onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 bg-white hover:bg-stone-50">
              <Copy className="w-3.5 h-3.5" /> Copy Share Link
            </button>
          )}

          {/* WhatsApp share */}
          <button onClick={handleSend} disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50">
            <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
          </button>

          {/* Convert to order */}
          {(quote.status === 'accepted' || quote.status === 'sent' || quote.status === 'viewed') && (
            <button onClick={handleConvertToOrder} disabled={actionLoading}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
              <ShoppingBag className="w-3.5 h-3.5" /> Convert to Order
            </button>
          )}

          {/* Create new revision */}
          <button onClick={handleRevise} disabled={actionLoading}
            className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#162B47] disabled:opacity-50">
            <RefreshCw className="w-3.5 h-3.5" /> Make Revision
          </button>
        </div>
      </div>

      {/* Grid: PDF Embed on Left, Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: PDF preview (2 columns wide) */}
        <div className="lg:col-span-2 h-[720px] bg-stone-100 rounded-xl border border-stone-200 overflow-hidden shadow-inner flex flex-col items-center justify-center">
          <iframe
            src={`/api/quotes/${quote.id}/pdf`}
            className="w-full h-full border-none rounded-xl"
            title={`PDF Preview — ${quote.quote_number}`}
          />
        </div>

        {/* Right Side: Details / Revision history (1 column wide) */}
        <div className="space-y-6">
          
          {/* Client summary card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3.5">
            <h2 className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2">Client Details</h2>
            
            <div className="flex gap-2.5 items-start">
              <User className="w-4 h-4 text-stone-400 mt-0.5" />
              <div>
                <p className="font-bold text-stone-800 text-sm">{clientName}</p>
                {quote.partners && <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded font-medium">B2B Partner</span>}
                {!quote.partners && <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-medium">Walk-in customer</span>}
              </div>
            </div>

            {clientCity && (
              <div className="flex gap-2.5 items-center text-xs text-stone-500">
                <span className="font-semibold text-stone-400">City:</span>
                <span>{clientCity}</span>
              </div>
            )}

            {clientPhone && (
              <div className="flex gap-2.5 items-center text-xs text-stone-500">
                <span className="font-semibold text-stone-400">Phone:</span>
                <span>{clientPhone}</span>
              </div>
            )}
          </div>

          {/* Quote details and telemetry card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <h2 className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2">Quote Details</h2>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-stone-400 font-medium">Quote Date</p>
                <p className="font-semibold text-stone-800 mt-0.5">
                  {new Date(quote.quote_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-stone-400 font-medium">Valid Until</p>
                <p className="font-semibold text-stone-800 mt-0.5">
                  {new Date(quote.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Subtotal:</span>
                <span className="font-semibold text-stone-800">₹ {quote.subtotal.toLocaleString('en-IN')}</span>
              </div>
              
              {quote.gst_treatment !== 'none' && (
                <div className="flex justify-between">
                  <span className="text-stone-500">GST ({quote.gst_rate_pct}%):</span>
                  <span className="font-semibold text-stone-800">₹ {quote.gst_amount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold border-t border-stone-100 pt-2">
                <span className="text-stone-900">Grand Total:</span>
                <span className="text-[#1E3A5F]">₹ {quote.grand_total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Magic Link telemetry details */}
            {quote.share_token && (
              <div className="border-t border-stone-100 pt-3 text-xs space-y-2">
                <p className="font-semibold text-stone-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Client Share Telemetry
                </p>
                {quote.shared_at && (
                  <div className="flex justify-between text-stone-500">
                    <span>Shared At:</span>
                    <span>{new Date(quote.shared_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
                {quote.viewed_at && (
                  <div className="flex justify-between text-stone-500">
                    <span>First Viewed:</span>
                    <span>{new Date(quote.viewed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} on {new Date(quote.viewed_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
                {quote.accepted_at && (
                  <div className="flex justify-between text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                    <span>Accepted:</span>
                    <span className="font-bold">{new Date(quote.accepted_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
                {quote.customer_response_note && (
                  <div className="bg-stone-50 border border-stone-200 p-2.5 rounded text-stone-700 mt-2 font-mono text-[11px]">
                    <p className="font-semibold text-stone-500 mb-1">Customer Note:</p>
                    {quote.customer_response_note}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Revisions tree timeline */}
          {revisions.length > 1 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <h2 className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2">Revision History</h2>
              
              <div className="space-y-3">
                {revisions.map(rev => {
                  const isActive = rev.id === id
                  return (
                    <div key={rev.id} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#1E3A5F] ring-4 ring-[#1E3A5F]/20' : 'bg-stone-300'}`} />
                      <div className="flex-1 min-w-0">
                        {isActive ? (
                          <span className="font-semibold text-stone-800 text-xs block truncate">{rev.quote_number} (Active)</span>
                        ) : (
                          <Link href={`/quotes/${rev.id}`} className="text-xs text-stone-500 hover:text-stone-800 hover:underline block truncate">
                            {rev.quote_number}
                          </Link>
                        )}
                        <span className="text-[10px] text-stone-400">
                          {new Date(rev.created_at).toLocaleDateString('en-IN')} · {rev.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
