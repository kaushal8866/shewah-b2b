'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Copy, Download, Share2, RefreshCw, ShoppingBag, Eye, Trash2, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface QuoteRow {
  id: string
  quote_number: string
  walk_in_name: string | null
  walk_in_city: string | null
  walk_in_phone: string | null
  reference_no: string | null
  quote_date: string
  valid_until: string
  grand_total: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'converted_to_order'
  share_token: string | null
  created_at: string
  partners: {
    name: string
    store_name: string | null
    city: string | null
  } | null
}

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    loadQuotes()
  }, [page, statusFilter, search])

  async function loadQuotes() {
    setLoading(true)
    try {
      const qParams = new URLSearchParams()
      qParams.set('page', String(page))
      qParams.set('limit', String(limit))
      if (statusFilter !== 'all') {
        qParams.set('status', statusFilter)
      }
      if (search) {
        qParams.set('q', search)
      }

      const res = await fetch(`/api/quotes?${qParams.toString()}`)
      if (res.ok) {
        const d = await res.json()
        setQuotes(d.quotes || [])
        setTotal(d.total || 0)
      }
    } catch (err) {
      console.error('Failed to load quotes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Action: Send Quote & get WhatsApp URL
  async function handleSend(quoteId: string) {
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        loadQuotes()
        if (d.waUrl) {
          window.open(d.waUrl, '_blank')
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to send quote')
      }
    } catch (err) {
      console.error(err)
      alert('Error sending quote')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Action: Create new revision (v2, v3, etc.)
  async function handleRevise(quoteId: string) {
    if (!confirm('Are you sure you want to create a new draft revision of this quote?')) return
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/revise`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        router.push(`/quotes/${d.quote.id}`)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to create revision')
      }
    } catch (err) {
      console.error(err)
      alert('Error creating revision')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Action: Convert to B2B Order
  async function handleConvertToOrder(quoteId: string) {
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert-to-order`, { method: 'POST' })
      if (res.ok) {
        const d = await res.json()
        // Prefill payload via sessionStorage and redirect to new order form
        if (d.items && d.items.length > 0) {
          // Prefill first item (standard order format in Shewah)
          const payload = d.items[0]
          sessionStorage.setItem('prefill_order_payload', JSON.stringify(payload))
          router.push('/orders/new?source=quote')
        } else {
          alert('No items found in this quote to convert.')
        }
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to prepare order conversion')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Action: Delete quotation permanently
  async function handleDelete(quoteId: string) {
    if (!confirm('Are you sure you want to permanently delete this quotation? This action cannot be undone.')) return
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' })
      if (res.ok) {
        loadQuotes()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to delete')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Copy magic link to clipboard
  function handleCopyLink(token: string | null) {
    if (!token) return
    const url = `${window.location.origin}/q/${token}`
    navigator.clipboard.writeText(url)
    alert('Magic link copied to clipboard!')
  }

  function getStatusStyle(status: QuoteRow['status']) {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'viewed': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'accepted': return 'bg-green-50 text-green-700 border-green-200'
      case 'converted_to_order': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
      case 'expired': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const STATUSES = [
    { value: 'all', label: 'All Quotes' },
    { value: 'draft', label: 'Drafts' },
    { value: 'sent', label: 'Sent' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'converted_to_order', label: 'Converted' },
  ]

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Quotations</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage and share B2B &amp; D2C custom quotes</p>
        </div>
        <Link href="/quotes/new"
          className="flex items-center gap-2 bg-stone-800 text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors">
          <Plus className="w-4 h-4" />
          <span>New Quote</span>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex flex-wrap gap-1 bg-stone-100 p-1 rounded-xl">
          {STATUSES.map(s => (
            <button key={s.value}
              onClick={() => { setStatusFilter(s.value); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === s.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search quote #, customer, reference..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white outline-none focus:border-stone-800" />
        </div>
      </div>

      {/* Desktop Quotations List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50 text-stone-400 text-xs font-semibold uppercase">
              <th className="px-5 py-3">Quote #</th>
              <th className="px-4 py-3">Customer / Bill To</th>
              <th className="px-4 py-3">Dates &amp; Validity</th>
              <th className="px-4 py-3">Total Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-stone-400">Loading quotations...</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-stone-400">No quotations found.</td></tr>
            ) : (
              quotes.map(q => {
                const billToName = q.partners ? (q.partners.store_name || q.partners.name) : (q.walk_in_name || 'Walk-in')
                const billToCity = q.partners ? q.partners.city : q.walk_in_city
                const formattedDate = new Date(q.quote_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                const formattedExpiry = new Date(q.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                const isDraft = q.status === 'draft'
                const isAccepted = q.status === 'accepted'
                const isSentOrViewed = q.status === 'sent' || q.status === 'viewed'
                const isConvertable = isAccepted || isSentOrViewed

                return (
                  <tr key={q.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-stone-900">
                      <Link href={`/quotes/${q.id}`} className="hover:underline text-stone-800">
                        {q.quote_number}
                      </Link>
                      {q.reference_no && (
                        <span className="block text-xs font-normal text-stone-400 mt-0.5">Ref: {q.reference_no}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-stone-800">{billToName}</p>
                      {billToCity && <p className="text-xs text-stone-400 mt-0.5">{billToCity}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-stone-700">{formattedDate}</p>
                      <p className="text-xs text-stone-400 mt-0.5">Valid until: {formattedExpiry}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold text-stone-900">
                      ₹ {q.grand_total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 text-xs font-medium border ${getStatusStyle(q.status)}`}>
                        {q.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Open detail / edit page */}
                        <Link href={`/quotes/${q.id}`} title="View Quote"
                          className="p-1.5 text-stone-500 hover:text-stone-800 border border-stone-100 rounded-md hover:bg-stone-100 transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>

                        {/* Stream PDF */}
                        <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener noreferrer" title="View PDF"
                          className="p-1.5 text-stone-500 hover:text-stone-800 border border-stone-100 rounded-md hover:bg-stone-100 transition-colors">
                          <Download className="w-4 h-4" />
                        </a>

                        {/* Send via WhatsApp (Draft) or Resend URL (Sent/Viewed) */}
                        {isDraft && (
                          <button onClick={() => handleSend(q.id)} disabled={actionLoadingId === q.id} title="Send Quotation"
                            className="p-1.5 text-blue-500 hover:text-blue-700 border border-blue-100 rounded-md hover:bg-blue-50 transition-colors">
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}

                        {isSentOrViewed && q.share_token && (
                          <>
                            <button onClick={() => handleCopyLink(q.share_token)} title="Copy Magic Link"
                              className="p-1.5 text-stone-500 hover:text-stone-800 border border-stone-100 rounded-md hover:bg-stone-100 transition-colors">
                              <Copy className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleSend(q.id)} title="WhatsApp Link"
                              className="p-1.5 text-emerald-500 hover:text-emerald-700 border border-emerald-100 rounded-md hover:bg-emerald-50 transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* Convert to Order */}
                        {isConvertable && (
                          <button onClick={() => handleConvertToOrder(q.id)} disabled={actionLoadingId === q.id} title="Convert to Order"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 border border-emerald-100 rounded-md hover:bg-emerald-50 transition-colors">
                            <ShoppingBag className="w-4 h-4" />
                          </button>
                        )}

                        {/* Revise */}
                        {!isDraft && (
                          <button onClick={() => handleRevise(q.id)} disabled={actionLoadingId === q.id} title="Revise Quote"
                            className="p-1.5 text-orange-500 hover:text-orange-700 border border-orange-100 rounded-md hover:bg-orange-50 transition-colors">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Quote */}
                        <button onClick={() => handleDelete(q.id)} disabled={actionLoadingId === q.id} title="Delete Quote"
                          className="p-1.5 text-red-500 hover:text-red-700 border border-red-100 rounded-md hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4 bg-stone-50">
            <span className="text-xs text-stone-500">
              Showing page {page} of {totalPages} ({total} quotes)
            </span>
            <div className="flex gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="text-xs px-3 py-1.5 border border-stone-200 rounded-md bg-white hover:bg-stone-50 disabled:opacity-50 font-medium">
                Prev
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="text-xs px-3 py-1.5 border border-stone-200 rounded-md bg-white hover:bg-stone-50 disabled:opacity-50 font-medium">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          <p className="text-center py-8 text-stone-400 text-sm">Loading quotations...</p>
        ) : quotes.length === 0 ? (
          <p className="text-center py-8 text-stone-400 text-sm">No quotations found.</p>
        ) : (
          quotes.map(q => {
            const billToName = q.partners ? (q.partners.store_name || q.partners.name) : (q.walk_in_name || 'Walk-in')
            return (
              <div key={q.id} className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/quotes/${q.id}`} className="font-semibold text-stone-900 hover:underline">
                      {q.quote_number}
                    </Link>
                    <p className="text-xs text-stone-500 mt-0.5">For: {billToName}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium border ${getStatusStyle(q.status)}`}>
                    {q.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-stone-500 border-t border-stone-100 pt-3">
                  <span>Grand Total: <strong className="text-stone-900">₹ {q.grand_total.toLocaleString('en-IN')}</strong></span>
                  <span>Date: {new Date(q.quote_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>

                <div className="flex justify-end gap-1.5 border-t border-stone-100 pt-3">
                  <Link href={`/quotes/${q.id}`} className="flex-1 text-center py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50 font-medium">
                    Open
                  </Link>
                  <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {q.status === 'draft' && (
                    <button onClick={() => handleSend(q.id)} className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs hover:bg-blue-100">
                      Send
                    </button>
                  )}
                  {(q.status === 'accepted' || q.status === 'sent' || q.status === 'viewed') && (
                    <button onClick={() => handleConvertToOrder(q.id)} className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs hover:bg-emerald-100">
                      Convert
                    </button>
                  )}
                  <button onClick={() => handleDelete(q.id)} disabled={actionLoadingId === q.id}
                    className="px-3 py-2 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50" title="Delete Quote">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-4">
            <span className="text-xs text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="text-xs px-3 py-2 border border-stone-200 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-50">
                Prev
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="text-xs px-3 py-2 border border-stone-200 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
