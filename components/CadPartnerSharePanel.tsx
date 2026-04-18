'use client'

import { useEffect, useState } from 'react'
import { Link2, Send, Copy, Check, RefreshCw, X, Clock, ExternalLink, MessageSquareWarning, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type ShareLink = {
  token: string
  partner_name: string | null
  partner_phone: string | null
  created_at: string
  expires_at: string
  revoked_at: string | null
  last_opened_at: string | null
  status?: 'active' | 'revoked' | 'expired'
}

type Response = {
  id: string
  decision: 'approved' | 'revision'
  comment: string | null
  partner_name: string | null
  responded_at: string
}

export default function CadPartnerSharePanel({
  cadRequestId,
  hasReferenceImages,
  defaultPartnerName,
  defaultPartnerPhone,
}: {
  cadRequestId: string
  hasReferenceImages: boolean
  defaultPartnerName?: string
  defaultPartnerPhone?: string
}) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [partnerName, setPartnerName] = useState(defaultPartnerName || '')
  const [partnerPhone, setPartnerPhone] = useState(defaultPartnerPhone || '')
  const [ttlDays, setTtlDays] = useState(7)

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cadRequestId])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/cad-requests/${cadRequestId}/partner-share`)
      const j = await r.json()
      setLinks(j.links || [])
      setResponses(j.responses || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  function shareUrl(token: string): string {
    if (typeof window === 'undefined') return `/cad-share/${token}`
    return `${window.location.origin}/cad-share/${token}`
  }

  const active = links.find(l => l.status === 'active')
  const latestLink = links[0]
  const inactiveLatest = !active && latestLink ? latestLink : null

  async function generate(sendWhatsapp: boolean) {
    setBusy(true)
    setToast(null)
    try {
      const r = await fetch(`/api/cad-requests/${cadRequestId}/partner-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_name: partnerName.trim(),
          partner_phone: partnerPhone.trim(),
          ttl_days: ttlDays,
          sendWhatsapp,
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setToast(j?.error || 'Could not generate link')
        return
      }
      if (sendWhatsapp) {
        if (j.send?.ok) setToast('Link generated and WhatsApp message sent.')
        else if (j.send?.reason === 'no_phone_provided') setToast('Link generated. Add a phone number to send via WhatsApp.')
        else setToast(`Link generated. WhatsApp send failed (${j.send?.reason || `status ${j.send?.status || '?'}`}). Copy the link to share manually.`)
      } else {
        setToast('Fresh link generated.')
      }
      setShowForm(false)
      await load()
    } catch (e: any) {
      setToast(e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(token: string) {
    if (!confirm('Revoke this link? The CAD partner will lose access immediately.')) return
    setBusy(true)
    await fetch(`/api/cad-requests/${cadRequestId}/partner-share?token=${token}`, { method: 'DELETE' })
    await load()
    setBusy(false)
    setToast('Link revoked.')
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const latestResponse = responses[0]

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h2 className="font-medium text-stone-900 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#1E3A5F]" />
            CAD partner handoff
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Generate a private, expiring link the external CAD partner can open without a login.
            They can download the brief as PDF, references as ZIP, and approve or request revisions
            directly.
          </p>
        </div>
      </div>

      {!hasReferenceImages && (
        <p className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 mb-3">
          Add at least one reference image to this request before sharing it with a CAD partner.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : active ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2 text-emerald-800 text-sm font-medium">
            <Check className="w-4 h-4" /> Active link
            {active.partner_name && <span className="text-xs text-emerald-700 font-normal">· {active.partner_name}</span>}
          </div>
          <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2 mb-2 text-xs text-stone-700 font-mono break-all">
            {shareUrl(active.token)}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => copyLink(active.token)}
              className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={shareUrl(active.token)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg">
              <ExternalLink className="w-3.5 h-3.5" /> Open as partner
            </a>
            {active.partner_phone && (
              <a
                href={`https://wa.me/${active.partner_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Shewah CAD brief\n${shareUrl(active.token)}\n(Link expires ${formatDate(active.expires_at)})`
                )}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg">
                <Send className="w-3.5 h-3.5" /> Send on WhatsApp
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 text-xs text-emerald-800 gap-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-600">Expires</p>
              <p className="font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(active.expires_at)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-600">Last opened</p>
              <p className="font-medium">{active.last_opened_at ? formatDate(active.last_opened_at) : 'Not yet'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-600">Phone</p>
              <p className="font-medium">{active.partner_phone || '—'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowForm(true)} disabled={busy}
              className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" /> Generate fresh link
            </button>
            <button onClick={() => revoke(active.token)} disabled={busy}
              className="flex items-center gap-1.5 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Revoke
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3 space-y-3">
          {inactiveLatest && (
            <div className={`rounded-xl border p-3 ${
              inactiveLatest.status === 'expired'
                ? 'bg-stone-50 border-stone-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  inactiveLatest.status === 'expired'
                    ? 'bg-stone-200 text-stone-700'
                    : 'bg-red-200 text-red-800'
                }`}>
                  {inactiveLatest.status === 'expired' ? 'Expired' : 'Revoked'}
                </span>
                <span className="text-xs text-stone-600">
                  {inactiveLatest.partner_name || 'Previous partner link'}
                </span>
              </div>
              <div className="grid grid-cols-3 text-[11px] text-stone-600 gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">Created</p>
                  <p className="font-medium">{formatDate(inactiveLatest.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">
                    {inactiveLatest.status === 'expired' ? 'Expired' : 'Revoked'}
                  </p>
                  <p className="font-medium">
                    {formatDate(
                      inactiveLatest.status === 'expired'
                        ? inactiveLatest.expires_at
                        : (inactiveLatest.revoked_at || inactiveLatest.expires_at)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">Last opened</p>
                  <p className="font-medium">
                    {inactiveLatest.last_opened_at ? formatDate(inactiveLatest.last_opened_at) : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              disabled={!hasReferenceImages}
              className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" /> {inactiveLatest ? 'Generate a new partner link' : 'Share with CAD partner'}
            </button>
          ) : null}
        </div>
      )}

      {showForm && hasReferenceImages && (
        <div className="border border-stone-200 rounded-xl p-3 bg-stone-50 mb-3">
          <p className="text-xs font-medium text-stone-600 mb-2">Generate a new partner link</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              placeholder="Partner name (optional)"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#1E3A5F] outline-none"
            />
            <input
              type="tel"
              placeholder="Partner WhatsApp number"
              value={partnerPhone}
              onChange={(e) => setPartnerPhone(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#1E3A5F] outline-none"
            />
            <select
              value={ttlDays}
              onChange={(e) => setTtlDays(parseInt(e.target.value) || 7)}
              className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#1E3A5F] outline-none"
            >
              <option value="1">Expires in 1 day</option>
              <option value="3">Expires in 3 days</option>
              <option value="7">Expires in 7 days (default)</option>
              <option value="14">Expires in 14 days</option>
              <option value="30">Expires in 30 days</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => generate(true)} disabled={busy}
              className="flex items-center gap-1.5 text-xs bg-[#1E3A5F] hover:bg-[#162B47] text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> Generate &amp; send on WhatsApp
            </button>
            <button onClick={() => generate(false)} disabled={busy}
              className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              Generate link only
            </button>
            <button onClick={() => setShowForm(false)} disabled={busy}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            Generating a new link automatically revokes the previous active link for this request.
          </p>
        </div>
      )}

      {toast && <p className="text-xs text-stone-600 mb-3">{toast}</p>}

      {/* Latest partner decision summary */}
      {latestResponse && (
        <div className={`rounded-xl border p-3 ${
          latestResponse.decision === 'approved'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-2">
            {latestResponse.decision === 'approved'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              : <MessageSquareWarning className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                latestResponse.decision === 'approved' ? 'text-emerald-800' : 'text-amber-800'
              }`}>
                CAD partner {latestResponse.decision === 'approved' ? 'approved the design' : 'requested a revision'}
                {latestResponse.partner_name ? ` — ${latestResponse.partner_name}` : ''}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">{formatDate(latestResponse.responded_at)}</p>
              {latestResponse.comment && (
                <p className="text-sm text-stone-700 whitespace-pre-wrap mt-2">{latestResponse.comment}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Older history (collapsed list) */}
      {responses.length > 1 && (
        <details className="mt-3">
          <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-700">
            Earlier partner responses ({responses.length - 1})
          </summary>
          <ul className="mt-2 space-y-2">
            {responses.slice(1).map(r => (
              <li key={r.id} className="text-xs text-stone-600 border border-stone-100 rounded-lg p-2">
                <p className="font-medium">
                  {r.decision === 'approved' ? 'Approved' : 'Revision requested'}
                  {r.partner_name ? ` — ${r.partner_name}` : ''}
                  <span className="text-stone-400 font-normal"> · {formatDate(r.responded_at)}</span>
                </p>
                {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
