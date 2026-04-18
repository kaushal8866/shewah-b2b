'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookUser, Plus, Edit2, Trash2, X, Save, Phone, Clock, Send, MessageSquareWarning, CheckCircle2, Archive, ArchiveRestore, ExternalLink, Sparkles, UserPlus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Partner = {
  id: string
  name: string
  phone: string | null
  notes: string | null
  default_ttl_days: number
  is_active: boolean
  created_at: string
  stats?: {
    total_links: number
    active_links: number
    last_share_at: string | null
    last_opened_at: string | null
  }
  active_links?: {
    token: string
    cad_request_id: string
    created_at: string
    expires_at: string
    last_opened_at: string | null
  }[]
  recent_responses?: {
    id: string
    link_id: string
    decision: 'approved' | 'revision'
    comment: string | null
    partner_name: string | null
    responded_at: string
    cad_request_id: string
  }[]
}

const blank = { name: '', phone: '', notes: '', default_ttl_days: 7 }

type Suggestion = {
  key: string
  name: string
  phone: string | null
  link_count: number
  last_share_at: string
}

export default function CadPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<typeof blank>(blank)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Partner>>({})
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [adoptingKey, setAdoptingKey] = useState<string | null>(null)
  const [adoptedNotice, setAdoptedNotice] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [r, rs] = await Promise.all([
        fetch('/api/cad-partners?stats=1'),
        fetch('/api/cad-partners/suggestions'),
      ])
      const j = await r.json()
      setPartners(j.partners || [])
      if (rs.ok) {
        const js = await rs.json()
        setSuggestions(js.suggestions || [])
      } else {
        setSuggestions([])
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    }
    setLoading(false)
  }

  async function adoptSuggestion(s: Suggestion) {
    setAdoptingKey(s.key); setError(null); setAdoptedNotice(null)
    try {
      const r = await fetch('/api/cad-partners/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, phone: s.phone || '' }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j?.error || 'Failed to add to directory')
      } else {
        const n = j?.backfilled || 0
        setAdoptedNotice(
          `Added "${s.name}" to the directory${n ? ` and linked ${n} past share link${n === 1 ? '' : 's'}` : ''}.`,
        )
        await load()
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setAdoptingKey(null)
    }
  }

  async function createPartner() {
    if (!draft.name.trim()) { setError('Name is required'); return }
    setBusy(true); setError(null)
    const r = await fetch('/api/cad-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) { setError(j?.error || 'Failed'); return }
    setShowNew(false)
    setDraft(blank)
    load()
  }

  async function saveEdit() {
    if (!editingId) return
    setBusy(true); setError(null)
    const r = await fetch(`/api/cad-partners/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) { setError(j?.error || 'Failed'); return }
    setEditingId(null)
    setEditDraft({})
    load()
  }

  async function toggleActive(p: Partner) {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`/api/cad-partners/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j?.error || `Failed to ${p.is_active ? 'archive' : 'reactivate'} partner`)
        return
      }
      await load()
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(p: Partner) {
    if (!confirm(`Delete "${p.name}" from the directory? Past share links will be kept but lose the directory link.`)) return
    setBusy(true); setError(null)
    const r = await fetch(`/api/cad-partners/${p.id}`, { method: 'DELETE' })
    const j = await r.json()
    setBusy(false)
    if (!r.ok) { setError(j?.error || 'Failed'); return }
    load()
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  const activePartners = partners.filter(p => p.is_active)
  const archivedPartners = partners.filter(p => !p.is_active)

  return (
    <div className="p-4 lg:p-7 max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <BookUser className="w-6 h-6 text-[#1E3A5F]" /> CAD partners
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Directory of recurring CAD vendors. Pick them from a dropdown when generating a share link instead of retyping name and number.
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(null) }}
          className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]"
        >
          <Plus className="w-4 h-4" /> Add CAD partner
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {adoptedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2 mb-4 flex items-start justify-between gap-2">
          <span>{adoptedNotice}</span>
          <button onClick={() => setAdoptedNotice(null)} className="text-emerald-500 hover:text-emerald-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 mb-5">
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h2 className="font-medium text-stone-900 text-sm">Suggest from past links</h2>
              <p className="text-xs text-stone-600 mt-0.5">
                These names came up repeatedly in older share links but aren&apos;t in your directory yet. Add them in one click and we&apos;ll back-link their past shares automatically.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {suggestions.map(s => (
              <li key={s.key} className="bg-white rounded-lg border border-amber-100 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-900 font-medium truncate">{s.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500 mt-0.5">
                    {s.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</span>
                    )}
                    <span>{s.link_count} past link{s.link_count === 1 ? '' : 's'}</span>
                    <span>Last shared {formatDate(s.last_share_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => adoptSuggestion(s)}
                  disabled={adoptingKey === s.key}
                  className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#162B47] disabled:opacity-50 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {adoptingKey === s.key ? 'Adding…' : 'Add to directory'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showNew && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-900">New CAD partner</h2>
            <button onClick={() => { setShowNew(false); setDraft(blank); setError(null) }}>
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={lbl}>Name *</label>
              <input className={inp} value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Sparkle CAD Studio" />
            </div>
            <div>
              <label className={lbl}>WhatsApp number</label>
              <input className={inp} value={draft.phone}
                onChange={e => setDraft({ ...draft, phone: e.target.value })}
                placeholder="919XXXXXXXXX" />
            </div>
            <div>
              <label className={lbl}>Default link TTL (days)</label>
              <select className={inp} value={draft.default_ttl_days}
                onChange={e => setDraft({ ...draft, default_ttl_days: parseInt(e.target.value) || 7 })}>
                {[1, 3, 7, 14, 30].map(d => (
                  <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} min-h-[64px]`} value={draft.notes}
                onChange={e => setDraft({ ...draft, notes: e.target.value })}
                placeholder="File format preferences, working hours, fee structure…" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createPartner} disabled={busy}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
              <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save partner'}
            </button>
            <button onClick={() => { setShowNew(false); setDraft(blank); setError(null) }}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-stone-200 p-10 text-center">
          <BookUser className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-600 font-medium mb-1">No CAD partners in your directory yet</p>
          <p className="text-stone-400 text-sm mb-4">
            Add the studios and freelancers you work with regularly so the team can pick them in one click.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]"
          >
            <Plus className="w-4 h-4" /> Add your first CAD partner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activePartners.map(p => (
            <PartnerCard key={p.id} p={p}
              editing={editingId === p.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onEdit={() => { setEditingId(p.id); setEditDraft(p); setError(null) }}
              onCancelEdit={() => { setEditingId(null); setEditDraft({}) }}
              onSaveEdit={saveEdit}
              onToggleActive={() => toggleActive(p)}
              onDelete={() => remove(p)}
              busy={busy}
            />
          ))}

          {archivedPartners.length > 0 && (
            <details className="mt-6">
              <summary className="text-sm text-stone-500 cursor-pointer hover:text-stone-700 mb-2">
                Archived ({archivedPartners.length})
              </summary>
              <div className="space-y-3 mt-2">
                {archivedPartners.map(p => (
                  <PartnerCard key={p.id} p={p}
                    editing={editingId === p.id}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    onEdit={() => { setEditingId(p.id); setEditDraft(p); setError(null) }}
                    onCancelEdit={() => { setEditingId(null); setEditDraft({}) }}
                    onSaveEdit={saveEdit}
                    onToggleActive={() => toggleActive(p)}
                    onDelete={() => remove(p)}
                    busy={busy}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function PartnerCard({
  p, editing, editDraft, setEditDraft,
  onEdit, onCancelEdit, onSaveEdit,
  onToggleActive, onDelete, busy,
}: {
  p: Partner
  editing: boolean
  editDraft: Partial<Partner>
  setEditDraft: (d: Partial<Partner>) => void
  onEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  busy: boolean
}) {
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className={`bg-white rounded-xl border ${p.is_active ? 'border-stone-200' : 'border-stone-200 opacity-75'} p-5`}>
      {editing ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={lbl}>Name *</label>
              <input className={inp} value={editDraft.name || ''}
                onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>WhatsApp number</label>
              <input className={inp} value={editDraft.phone || ''}
                onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Default link TTL (days)</label>
              <select className={inp} value={editDraft.default_ttl_days || 7}
                onChange={e => setEditDraft({ ...editDraft, default_ttl_days: parseInt(e.target.value) || 7 })}>
                {[1, 3, 7, 14, 30].map(d => (
                  <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} min-h-[64px]`} value={editDraft.notes || ''}
                onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEdit} disabled={busy}
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
              <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={onCancelEdit}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-medium text-stone-900">{p.name}</h3>
                {!p.is_active && (
                  <span className="text-[10px] uppercase tracking-wider bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">Archived</span>
                )}
                {(p.stats?.active_links ?? 0) > 0 && (
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                    {p.stats!.active_links} active link{p.stats!.active_links === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                {p.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>
                )}
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Default TTL {p.default_ttl_days}d</span>
                <span>Total links shared: {p.stats?.total_links ?? 0}</span>
                {p.stats?.last_share_at && (
                  <span>Last share: {formatDate(p.stats.last_share_at)}</span>
                )}
                {p.stats?.last_opened_at && (
                  <span>Last opened: {formatDate(p.stats.last_opened_at)}</span>
                )}
              </div>
              {p.notes && (
                <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{p.notes}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={onEdit}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onToggleActive} disabled={busy}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg disabled:opacity-50"
                title={p.is_active ? 'Archive' : 'Reactivate'}>
                {p.is_active ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
              </button>
              <button onClick={onDelete} disabled={busy}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(p.active_links?.length || 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-2 flex items-center gap-1">
                <Send className="w-3 h-3" /> Active share links
              </p>
              <ul className="space-y-1">
                {p.active_links!.map(l => (
                  <li key={l.token} className="flex items-center justify-between gap-2 text-xs bg-stone-50 rounded-lg px-3 py-2">
                    <span className="text-stone-600">
                      Expires {formatDate(l.expires_at)}
                      {l.last_opened_at
                        ? ` · last opened ${formatDate(l.last_opened_at)}`
                        : ' · not yet opened'}
                    </span>
                    <Link href={`/cad-requests/${l.cad_request_id}`}
                      className="flex items-center gap-1 text-[#1E3A5F] hover:underline shrink-0">
                      <ExternalLink className="w-3 h-3" /> Open CAD request
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(p.recent_responses?.length || 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-2">Recent decisions</p>
              <ul className="space-y-2">
                {p.recent_responses!.map(r => (
                  <li key={r.id} className="text-xs">
                    <div className="flex items-start gap-2">
                      {r.decision === 'approved'
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        : <MessageSquareWarning className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-700">
                          <span className={r.decision === 'approved' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                            {r.decision === 'approved' ? 'Approved' : 'Revision requested'}
                          </span>
                          <span className="text-stone-400"> · {formatDate(r.responded_at)}</span>
                          {' · '}
                          <Link href={`/cad-requests/${r.cad_request_id}`} className="text-[#1E3A5F] hover:underline">
                            view CAD
                          </Link>
                        </p>
                        {r.comment && (
                          <p className="text-stone-500 mt-0.5 line-clamp-2">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
