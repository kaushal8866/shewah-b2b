'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Bell, Play, AlertTriangle, ExternalLink, Copy, Send,
  Settings2, Save, CheckCircle2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

type Flagged = {
  partner_id: string
  partner_name: string
  city: string | null
  consumed_total: number
  benchmark_total: number
  variance_total: number
  negative_count: number
  unlinked_count: number
  unlinked_consumed: number
  reasons: string[]
}

type DigestResponse = {
  run_date: string
  window_days: number
  thresholds: {
    window_days: number
    variance_g: number
    negative_count: number
    unlinked_count: number
  }
  partners_scanned: number
  partners_flagged: number
  flagged: Flagged[]
  message: string
  dispatch?: {
    configured: boolean
    channel: string | null
    sent: boolean
    error: string | null
    recipients: string
  }
}

const THRESHOLD_KEYS = [
  'reconciliation_alert_window_days',
  'reconciliation_alert_variance_g',
  'reconciliation_alert_negative_count',
  'reconciliation_alert_unlinked_count',
] as const

const DISPATCH_KEYS = [
  'reconciliation_alert_email_to',
  'reconciliation_alert_email_from',
] as const

const REASON_LABELS: Record<string, { label: string, cls: string }> = {
  variance:         { label: 'variance',     cls: 'bg-red-100 text-red-700' },
  negative_balance: { label: 'negative bal', cls: 'bg-red-100 text-red-700' },
  unlinked:         { label: 'unlinked',     cls: 'bg-amber-100 text-amber-800' },
}

function fmt(n: number, d = 3) { return Number(n).toFixed(d) }

// Match the cron route — bucket "today" by Asia/Kolkata so the dashboard
// rehydrates from history correctly across the UTC midnight boundary.
function istToday() {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000
  return new Date(istMs).toISOString().split('T')[0]
}

export default function ReconciliationAlertsPage() {
  const [digest, setDigest] = useState<DigestResponse | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')

  const [whatsappTo, setWhatsappTo] = useState('')
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [dispatch, setDispatch] = useState<Record<string, string>>({
    reconciliation_alert_email_to: '',
    reconciliation_alert_email_from: '',
  })
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => { initialLoad() }, [])

  async function initialLoad() {
    setLoading(true)
    const [{ data: settingsRows }, { data: alerts }, { data: partners }] = await Promise.all([
      supabase.from('settings').select('key,value').in('key', [...THRESHOLD_KEYS, ...DISPATCH_KEYS, 'whatsapp_number']),
      supabase.from('reconciliation_alerts').select('*').order('run_date', { ascending: false }).limit(50),
      supabase.from('manufacturing_partners').select('id,name,city'),
    ])
    const sMap: Record<string, string> = {}
    for (const r of settingsRows || []) sMap[r.key] = r.value || ''
    setWhatsappTo(sMap['whatsapp_number'] || '')
    const tMap: Record<string, string> = {}
    for (const k of THRESHOLD_KEYS) tMap[k] = sMap[k] || ''
    setThresholds(tMap)
    setDispatch({
      reconciliation_alert_email_to: sMap['reconciliation_alert_email_to'] || '',
      reconciliation_alert_email_from: sMap['reconciliation_alert_email_from'] || '',
    })

    const nameMap: Record<string, string> = {}
    for (const p of partners || []) nameMap[p.id] = `${p.name}${p.city ? ` · ${p.city}` : ''}`
    setPartnerNames(nameMap)

    setHistory(alerts || [])
    // Render today's most recent run from history if present
    const today = istToday()
    const todays = (alerts || []).filter((a: any) => a.run_date === today)
    if (todays.length) {
      setDigest(rebuildDigestFromHistory(todays, tMap, nameMap))
    }
    setLoading(false)
  }

  function rebuildDigestFromHistory(rows: any[], tMap: Record<string, string>, names: Record<string, string>): DigestResponse {
    const flagged: Flagged[] = rows.map(r => {
      const namePieces = (names[r.partner_id] || '').split(' · ')
      return {
        partner_id: r.partner_id,
        partner_name: namePieces[0] || 'Unknown',
        city: namePieces[1] ?? null,
        consumed_total: Number(r.consumed_total) || 0,
        benchmark_total: Number(r.benchmark_total) || 0,
        variance_total: Number(r.variance_total) || 0,
        negative_count: r.negative_count || 0,
        unlinked_count: r.unlinked_count || 0,
        unlinked_consumed: Number(r.unlinked_consumed) || 0,
        reasons: r.triggered_reasons || [],
      }
    })
    return {
      run_date: rows[0].run_date,
      window_days: rows[0].window_days,
      thresholds: {
        window_days: parseInt(tMap.reconciliation_alert_window_days || '7', 10),
        variance_g: parseFloat(tMap.reconciliation_alert_variance_g || '2') || 2,
        negative_count: parseInt(tMap.reconciliation_alert_negative_count || '1', 10),
        unlinked_count: parseInt(tMap.reconciliation_alert_unlinked_count || '3', 10),
      },
      partners_scanned: 0,
      partners_flagged: flagged.length,
      flagged,
      message: '',
    }
  }

  async function runNow() {
    setRunning(true)
    setErr('')
    try {
      const res = await fetch('/api/cron/reconciliation-digest', {
        method: 'POST', credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error || 'Failed to run digest')
      } else {
        setDigest(json)
        // refresh history
        const { data: alerts } = await supabase.from('reconciliation_alerts')
          .select('*').order('run_date', { ascending: false }).limit(50)
        setHistory(alerts || [])
      }
    } catch (e: any) {
      setErr(e?.message || 'Network error')
    }
    setRunning(false)
  }

  async function saveThresholds() {
    setSavingThresholds(true)
    const upserts = [
      ...THRESHOLD_KEYS.map(k => ({
        key: k, value: thresholds[k] || '', updated_at: new Date().toISOString(),
      })),
      ...DISPATCH_KEYS.map(k => ({
        key: k, value: dispatch[k] || '', updated_at: new Date().toISOString(),
      })),
    ]
    const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
    setSavingThresholds(false)
    if (error) { alert('Error: ' + error.message); return }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  function copyMessage() {
    if (!digest?.message) return
    navigator.clipboard.writeText(digest.message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const waLink = useMemo(() => {
    if (!digest?.message) return ''
    const cleaned = whatsappTo.replace(/\D/g, '')
    const text = encodeURIComponent(digest.message)
    return cleaned ? `https://wa.me/${cleaned}?text=${text}` : `https://wa.me/?text=${text}`
  }, [digest, whatsappTo])

  // Group history by date for the trail
  const historyByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const r of history) (map[r.run_date] ||= []).push(r)
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [history])

  const today = istToday()

  const inp = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-800/30'
  const lbl = 'block text-xs font-medium text-stone-600 mb-1'

  return (
    <div className="p-4 lg:p-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manufacturing" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-stone-800" /> Karigar reconciliation digest
          </h1>
          <p className="text-stone-500 text-sm truncate">Daily heads-up for partners with notable variance, negative balances, or unlinked consumption.</p>
        </div>
        <button onClick={runNow} disabled={running}
          className="flex items-center gap-2 bg-stone-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-60">
          <Play className="w-4 h-4" /> {running ? 'Running…' : 'Run digest now'}
        </button>
      </div>

      {err && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>
      )}

      {/* Today's run */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="font-medium text-stone-900 text-sm">Today's digest</h2>
            <p className="text-xs text-stone-400">{digest?.run_date || today} · last {digest?.window_days || thresholds.reconciliation_alert_window_days || '7'} days</p>
          </div>
          {digest && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${digest.partners_flagged > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {digest.partners_flagged} flagged
            </span>
          )}
        </div>

        {loading ? (
          <p className="px-4 py-8 text-sm text-stone-400 text-center">Loading…</p>
        ) : !digest ? (
          <p className="px-4 py-8 text-sm text-stone-400 text-center">
            No digest has been generated yet today. Press <span className="font-medium text-stone-600">Run digest now</span> to scan all active karigars.
          </p>
        ) : digest.flagged.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-stone-700 font-medium">All clear</p>
            <p className="text-xs text-stone-400 mt-1">Every active karigar is within thresholds for the last {digest.window_days} day{digest.window_days === 1 ? '' : 's'}.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {digest.flagged.map(f => (
              <div key={f.partner_id} className="px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/manufacturing/partners/${f.partner_id}/reconciliation`}
                      className="text-sm font-medium text-stone-800 hover:underline">
                      {f.partner_name}
                    </Link>
                    {f.city && <span className="text-xs text-stone-400">{f.city}</span>}
                    {f.reasons.map(r => {
                      const meta = REASON_LABELS[r] || { label: r, cls: 'bg-stone-100 text-stone-600' }
                      return (
                        <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium ${meta.cls}`}>{meta.label}</span>
                      )
                    })}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      Net variance:
                      {Math.abs(f.variance_total) < 0.001 ? (
                        <span className="text-stone-500 font-medium">0.000g</span>
                      ) : f.variance_total > 0 ? (
                        <span className="text-red-600 font-medium inline-flex items-center gap-0.5">
                          <ArrowUpRight className="w-3 h-3" />+{fmt(f.variance_total)}g
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium inline-flex items-center gap-0.5">
                          <ArrowDownRight className="w-3 h-3" />{fmt(f.variance_total)}g
                        </span>
                      )}
                    </span>
                    <span>Consumed: <span className="text-stone-700">{fmt(f.consumed_total)}g</span></span>
                    <span>Benchmark: <span className="text-stone-700">{fmt(f.benchmark_total)}g</span></span>
                    <span>Negative: <span className="text-stone-700">{f.negative_count}</span></span>
                    <span>Unlinked: <span className="text-stone-700">{f.unlinked_count} ({fmt(f.unlinked_consumed)}g)</span></span>
                  </div>
                </div>
                <Link href={`/manufacturing/partners/${f.partner_id}/reconciliation`}
                  className="text-stone-400 hover:text-stone-700 shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share / send */}
      {digest && digest.message && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-stone-900 text-sm">Share via WhatsApp / email</h3>
            <div className="flex gap-2">
              <button onClick={copyMessage}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-50">
                <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
              </button>
              <a href={waLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700">
                <Send className="w-3.5 h-3.5" /> Send via WhatsApp
              </a>
            </div>
          </div>
          <pre className="text-xs text-stone-700 bg-stone-50 border border-stone-100 rounded-lg p-3 whitespace-pre-wrap font-sans">
{digest.message}
          </pre>
          <p className="text-xs text-stone-400 mt-2">
            Sends to {whatsappTo ? <span className="text-stone-600">{whatsappTo}</span> : <span>your saved WhatsApp number (set in <Link href="/settings" className="text-stone-800 underline">Settings</Link>)</span>}.
          </p>
        </div>
      )}

      {/* Thresholds */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-stone-900 text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-stone-800" /> Alert thresholds
          </h3>
          <button onClick={saveThresholds} disabled={savingThresholds}
            className="flex items-center gap-1.5 bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-stone-900 disabled:opacity-60">
            <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Saved' : (savingThresholds ? 'Saving…' : 'Save')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Look-back window (days)</label>
            <input type="number" min="1" className={inp}
              value={thresholds.reconciliation_alert_window_days || ''}
              onChange={e => setThresholds(p => ({ ...p, reconciliation_alert_window_days: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Net variance ≥ (grams)</label>
            <input type="number" step="0.1" min="0" className={inp}
              value={thresholds.reconciliation_alert_variance_g || ''}
              onChange={e => setThresholds(p => ({ ...p, reconciliation_alert_variance_g: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Negative-balance rows ≥</label>
            <input type="number" min="0" className={inp}
              value={thresholds.reconciliation_alert_negative_count || ''}
              onChange={e => setThresholds(p => ({ ...p, reconciliation_alert_negative_count: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Unlinked consumption rows ≥</label>
            <input type="number" min="0" className={inp}
              value={thresholds.reconciliation_alert_unlinked_count || ''}
              onChange={e => setThresholds(p => ({ ...p, reconciliation_alert_unlinked_count: e.target.value }))} />
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-3">
          Set a count to <code className="bg-stone-100 px-1 rounded">0</code> to disable that trigger.
        </p>

        <div className="border-t border-stone-100 mt-4 pt-4">
          <h4 className="text-sm font-medium text-stone-800 mb-1">Auto-send (email)</h4>
          <p className="text-xs text-stone-400 mb-3">
            When at least one karigar is flagged, the cron job emails the digest to these recipients via Resend. Leave blank to skip auto-send and only use the WhatsApp/copy buttons above. Requires <code className="bg-stone-100 px-1 rounded">RESEND_API_KEY</code> + <code className="bg-stone-100 px-1 rounded">CRON_SECRET</code> in environment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Recipients (comma separated)</label>
              <input className={inp} placeholder="kaushal@shewah.com, ops@shewah.com"
                value={dispatch.reconciliation_alert_email_to}
                onChange={e => setDispatch(p => ({ ...p, reconciliation_alert_email_to: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>From address</label>
              <input className={inp} placeholder="alerts@shewah.com"
                value={dispatch.reconciliation_alert_email_from}
                onChange={e => setDispatch(p => ({ ...p, reconciliation_alert_email_from: e.target.value }))} />
            </div>
          </div>
        </div>

        {digest?.dispatch && (
          <div className={`mt-4 px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${
            digest.dispatch.sent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : digest.dispatch.error ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-stone-50 text-stone-600 border border-stone-200'}`}>
            <span className="font-medium shrink-0">Last dispatch:</span>
            {digest.dispatch.sent
              ? <span>emailed to <span className="font-medium">{digest.dispatch.recipients}</span></span>
              : digest.dispatch.error
                ? <span>failed — {digest.dispatch.error}</span>
                : <span>{digest.partners_flagged === 0 ? 'nothing to send (no karigar flagged)' : 'auto-send not configured (set RESEND_API_KEY + recipients + from address)'}</span>}
          </div>
        )}
      </div>

      {/* History trail */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="font-medium text-stone-900 text-sm">Recent digests</h3>
          <p className="text-xs text-stone-400">Last 50 alert rows across all partners.</p>
        </div>
        {historyByDate.length === 0 ? (
          <p className="px-4 py-8 text-sm text-stone-400 text-center">No alerts recorded yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {historyByDate.map(([date, rows]) => (
              <div key={date} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-stone-800">{formatDate(date)}</p>
                  <span className="text-xs text-stone-400">{rows.length} flagged</span>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs flex-wrap">
                      <Link href={`/manufacturing/partners/${r.partner_id}/reconciliation`}
                        className="text-stone-800 hover:underline font-medium">
                        {partnerNames[r.partner_id] || r.partner_id.slice(0, 8)}
                      </Link>
                      {(r.triggered_reasons || []).map((reason: string) => {
                        const meta = REASON_LABELS[reason] || { label: reason, cls: 'bg-stone-100 text-stone-600' }
                        return <span key={reason} className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium ${meta.cls}`}>{meta.label}</span>
                      })}
                      <span className="text-stone-500">
                        var {r.variance_total > 0 ? '+' : ''}{fmt(Number(r.variance_total))}g · neg {r.negative_count} · unlinked {r.unlinked_count}
                      </span>
                      {r.notified_at && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase font-medium">sent</span>
                      )}
                      {r.notify_error && (
                        <span title={r.notify_error} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase font-medium">send failed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
