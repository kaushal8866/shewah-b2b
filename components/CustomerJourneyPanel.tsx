'use client'

import { useEffect, useState } from 'react'
import { Link as LinkIcon, Copy, RefreshCw, Trash2, Eye, Calendar, Check } from 'lucide-react'

type LinkRow = {
  token: string
  expires_at: string
  revoked_at?: string | null
  opened_count: number
  first_opened_at?: string | null
  last_opened_at?: string | null
  created_at?: string | null
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(d) }
}
function fmtRel(d?: string | null): string {
  if (!d) return 'never'
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hr ago`
  return `${Math.floor(ms / 86_400_000)} day${Math.floor(ms / 86_400_000) === 1 ? '' : 's'} ago`
}

export default function CustomerJourneyPanel({ orderId, customerId }: { orderId: string; customerId: string | null }) {
  const [link, setLink] = useState<LinkRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showExtend, setShowExtend] = useState(false)
  const [extendDays, setExtendDays] = useState('30')

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/journey-link`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not load'); return }
      setLink(d.link || null)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [orderId])

  async function create() {
    if (!customerId) { setError('Attach a customer to this order first.'); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/journey-link`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not create link'); return }
      setLink(d.link)
    } finally { setBusy(false) }
  }

  async function revoke() {
    if (!confirm('Revoke this customer link? They will see "no longer active" on next visit.')) return
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/journey-link`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not revoke'); return }
      await load()
    } finally { setBusy(false) }
  }

  async function extend() {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/journey-link/extend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(extendDays) || 30 }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not extend'); return }
      setShowExtend(false); setExtendDays('30')
      await load()
    } finally { setBusy(false) }
  }

  const url = link ? `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${link.token}` : ''
  const isRevoked = !!link?.revoked_at
  const isExpired = link && new Date(link.expires_at).getTime() < Date.now()

  async function copyUrl() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <LinkIcon className="w-4 h-4 text-stone-500" />
        <h3 className="font-medium text-stone-900">Customer journey link</h3>
        {link && !isRevoked && !isExpired && (
          <span className="text-[10px] uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 ">Active</span>
        )}
        {isRevoked && (
          <span className="text-[10px] uppercase tracking-wider bg-stone-100 text-stone-600 px-2 py-0.5 ">Revoked</span>
        )}
        {!isRevoked && isExpired && (
          <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 ">Expired</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-stone-400">Loading...</p>
      ) : !link ? (
        <div>
          <p className="text-sm text-stone-500 mb-3">
            Generate a single magic link the customer bookmarks to follow the order from quote to delivery.
          </p>
          <button
            disabled={busy || !customerId}
            onClick={create}
            className="bg-stone-800 hover:bg-stone-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40">
            {busy ? 'Creating...' : 'Create journey link'}
          </button>
          {!customerId && (
            <p className="text-xs text-amber-700 mt-2">Attach a customer record to this order before creating a journey link.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 mb-3">
            <code className="text-xs text-stone-700 truncate flex-1">{url}</code>
            <button onClick={copyUrl} className="shrink-0 text-stone-500 hover:text-stone-900 p-1">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs mb-4">
            <div>
              <dt className="text-stone-400 mb-0.5">Last viewed</dt>
              <dd className="text-stone-700 flex items-center gap-1">
                <Eye className="w-3 h-3 text-stone-400" />
                {fmtRel(link.last_opened_at)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-400 mb-0.5">Total opens</dt>
              <dd className="text-stone-700">{link.opened_count}</dd>
            </div>
            <div>
              <dt className="text-stone-400 mb-0.5">Expires</dt>
              <dd className="text-stone-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-stone-400" />
                {fmtDate(link.expires_at)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-400 mb-0.5">Created</dt>
              <dd className="text-stone-700">{fmtDate(link.created_at)}</dd>
            </div>
          </dl>

          {showExtend ? (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number" min="1" max="730" value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                className="w-20 border border-stone-200 rounded-md px-2 py-1.5 text-sm" />
              <span className="text-xs text-stone-500">more days</span>
              <button onClick={extend} disabled={busy}
                className="bg-stone-800 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-stone-900 disabled:opacity-40">
                {busy ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowExtend(false)}
                className="text-xs text-stone-500 px-2 py-1.5">Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowExtend(true)} disabled={busy}
                className="text-xs border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Extend
              </button>
              {!isRevoked && (
                <button onClick={revoke} disabled={busy}
                  className="text-xs border border-red-200 hover:bg-red-50 text-red-600 font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Revoke
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
    </div>
  )
}
