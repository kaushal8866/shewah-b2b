'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, MessageSquare, Clock, AlertCircle } from 'lucide-react'

const CHANGE_FIELDS = ['quantity', 'ring_size', 'special_notes', 'brief_text'] as const
type ChangeField = typeof CHANGE_FIELDS[number]

const FIELD_LABELS: Record<ChangeField, string> = {
  quantity: 'Quantity',
  ring_size: 'Ring size',
  special_notes: 'Notes',
  brief_text: 'Brief',
}

function isChangeField(k: string): k is ChangeField {
  return (CHANGE_FIELDS as readonly string[]).includes(k)
}

type OrderSummary = {
  id: string
  order_number: string
  quantity?: number | string | null
  ring_size?: string | null
  special_notes?: string | null
  brief_text?: string | null
}

type PartnerSummary = { id: string; store_name: string; city: string | null } | null
type RequesterSummary = { id: string; username: string; display_name: string | null } | null

type ChangeRequest = {
  id: string
  created_at: string
  status: string
  changes: Partial<Record<ChangeField, unknown>> | null
  retailer_note: string | null
  order: OrderSummary | null
  partner: PartnerSummary
  requester: RequesterSummary
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function OrderChangeRequestsInboxPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/order-change-requests?status=pending')
      const d = await r.json()
      if (!r.ok) { setError(typeof d?.error === 'string' ? d.error : 'Could not load requests.'); return }
      const list: ChangeRequest[] = Array.isArray(d.requests) ? d.requests : []
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      setRequests(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load requests.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-stone-500" />
          Change request inbox
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Pending change requests from retailers across all orders, oldest first.
        </p>
      </div>

      {loading && (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 text-sm">
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 mx-auto flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-stone-900 font-medium">All caught up</p>
          <p className="text-stone-500 text-sm mt-1">No pending change requests right now.</p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map(r => {
            const changeEntries = Object.entries(r.changes || {}).filter(([k]) => isChangeField(k)) as [ChangeField, unknown][]
            return (
              <Link
                key={r.id}
                href={r.order ? `/orders/${r.order.id}` : '#'}
                className="block bg-white border border-stone-200 hover:border-stone-800/40 hover:shadow-sm transition rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-stone-900">
                        {r.order?.order_number || 'Order'}
                      </span>
                      <span className="text-stone-400">·</span>
                      <span className="text-sm text-stone-700 truncate">
                        {r.partner?.store_name || 'Retailer'}
                        {r.partner?.city ? `, ${r.partner.city}` : ''}
                      </span>
                      <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">
                        Pending
                      </span>
                    </div>
                    <div className="text-[12px] text-stone-500 flex items-center gap-1 mb-2">
                      <Clock className="w-3 h-3" />
                      {timeAgo(r.created_at)} · {new Date(r.created_at).toLocaleString('en-IN')}
                      {r.requester?.display_name || r.requester?.username
                        ? <> · by {r.requester.display_name || r.requester.username}</>
                        : null}
                    </div>

                    {changeEntries.length > 0 && (
                      <div className="text-sm space-y-1 mb-1">
                        {changeEntries.map(([k, next]) => {
                          const current = r.order ? r.order[k] : undefined
                          return (
                            <div key={k} className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-stone-500 text-xs w-20 shrink-0">
                                {FIELD_LABELS[k]}:
                              </span>
                              <span className="text-stone-400 line-through text-xs">
                                {current == null ? '—' : String(current)}
                              </span>
                              <ChevronRight className="w-3 h-3 text-stone-400" />
                              <span className="font-medium text-stone-900 text-sm">
                                {next == null ? '—' : String(next)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {r.retailer_note && (
                      <p className="text-[13px] text-stone-700 bg-stone-50 rounded-md p-2 border border-stone-200 mt-2">
                        <span className="text-stone-400 text-xs">Note: </span>{r.retailer_note}
                      </p>
                    )}

                    {changeEntries.length === 0 && !r.retailer_note && (
                      <p className="text-xs text-stone-500 italic">No field changes — open the order to review.</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-400 shrink-0 mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
