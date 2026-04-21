'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Loader2, Phone, MessageCircle, Mail, MapPin, ChevronDown,
  CheckCircle2, XCircle, ArrowUpRight, Filter, Inbox,
} from 'lucide-react'

type Lead = {
  id: string
  created_at: string
  full_name: string
  store_name: string
  city: string
  phone: string
  whatsapp: string
  email: string | null
  gst_number: string | null
  monthly_volume: string | null
  note: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  status: 'new' | 'contacted' | 'qualified' | 'onboarded' | 'rejected'
  internal_notes: string | null
  contacted_at: string | null
  converted_partner_id: string | null
  assigned_to: string | null
  email_dispatch: any
  whatsapp_dispatch: any
}

type Staff = { id: string; display_name: string | null; username: string; role: string }

const STATUSES: Lead['status'][] = ['new', 'contacted', 'qualified', 'onboarded', 'rejected']

const STATUS_STYLE: Record<Lead['status'], string> = {
  new:        'bg-amber-100 text-amber-800 border-amber-200',
  contacted:  'bg-sky-100 text-sky-800 border-sky-200',
  qualified:  'bg-violet-100 text-violet-800 border-violet-200',
  onboarded:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:   'bg-stone-100 text-stone-600 border-stone-200',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function dispatchPill(label: string, dispatch: any) {
  if (!dispatch) return <span className="text-[10px] text-stone-400">{label} —</span>
  const ok = dispatch?.sent === true
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
      title={dispatch?.error || ''}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label} {ok ? 'sent' : 'failed'}
    </span>
  )
}

export default function PartnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Lead['status']>('all')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [staff, setStaff] = useState<Staff[]>([])
  const [canAssign, setCanAssign] = useState<boolean>(false)

  useEffect(() => {
    // Fetch admin staff for the assignee dropdown. /api/staff is open to
    // any authenticated admin user (master or sub) and returns only the
    // narrow subset of fields needed for the picker.
    fetch('/api/staff')
      .then(async r => {
        if (!r.ok) return null
        const j = await r.json().catch(() => null)
        return j?.staff as Staff[] | undefined
      })
      .then(staffList => {
        if (!staffList) return
        setStaff(staffList)
        setCanAssign(true)
      })
      .catch(() => {})
  }, [])

  const staffById = useMemo(() => {
    const m: Record<string, Staff> = {}
    for (const s of staff) m[s.id] = s
    return m
  }, [staff])

  async function load() {
    setLoading(true)
    setError(null)
    let q: any = supabase.from('partner_signups').select('*').order('created_at', { ascending: false }).limit(500)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data, error } = await q
    if (error) setError(error.message)
    setLeads(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length }
    for (const s of STATUSES) c[s] = leads.filter(l => l.status === s).length
    return c
  }, [leads])

  async function setStatus(id: string, status: Lead['status']) {
    setBusyId(id)
    const patch: any = { status }
    if (status === 'contacted' || status === 'qualified') patch.contacted_at = new Date().toISOString()
    const { error } = await supabase.from('partner_signups').update(patch).eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    }
    setBusyId(null)
  }

  async function saveNote(id: string, value: string) {
    setBusyId(id)
    const { error } = await supabase.from('partner_signups').update({ internal_notes: value }).eq('id', id)
    if (error) setError(error.message)
    else setLeads(prev => prev.map(l => l.id === id ? { ...l, internal_notes: value } : l))
    setBusyId(null)
  }

  async function setAssignee(id: string, assignee: string | null) {
    setBusyId(id)
    const { error } = await supabase.from('partner_signups').update({ assigned_to: assignee }).eq('id', id)
    if (error) setError(error.message)
    else setLeads(prev => prev.map(l => l.id === id ? { ...l, assigned_to: assignee } : l))
    setBusyId(null)
  }

  function assigneeLabel(id: string | null): string {
    if (!id) return 'Unassigned'
    const s = staffById[id]
    if (!s) return 'Assigned'
    return s.display_name || s.username
  }

  function convertHref(l: Lead): string {
    const params = new URLSearchParams()
    params.set('store_name', l.store_name)
    params.set('owner_name', l.full_name)
    params.set('phone', l.phone)
    if (l.email) params.set('email', l.email)
    params.set('city', l.city)
    params.set('source', `landing:${l.utm_source || 'direct'}`)
    params.set('lead_id', l.id)
    return `/partners/new?${params.toString()}`
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Partners</p>
          <h1 className="text-2xl font-serif mt-0.5">Lead inbox</h1>
        </div>
        <Link href="/partners" className="text-sm text-stone-600 hover:text-stone-900">All partners →</Link>
      </div>
      <p className="text-sm text-stone-600 mb-6">Inbound leads from the public landing page at /. Triage them here, then convert qualified leads into partners.</p>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Filter className="w-4 h-4 text-stone-400" />
        {(['all', ...STATUSES] as const).map(k => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'}`}>
            {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[k] || 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error.includes('relation') && error.includes('does not exist')
            ? 'The partner_signups table is not yet provisioned. Run scripts/migrate_task85_partner_signups.sql in the Supabase SQL Editor and refresh.'
            : error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <Inbox className="w-8 h-8 mx-auto text-stone-300" />
          <p className="mt-3 text-sm">No leads {filter !== 'all' ? `with status "${filter}"` : 'yet'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(l => {
            const open = expanded.has(l.id)
            return (
              <div key={l.id} className="bg-white rounded-xl border border-stone-200">
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                      <p className="font-semibold text-stone-900">{l.full_name}</p>
                      <span className="text-stone-300">·</span>
                      <p className="text-stone-700">{l.store_name}</p>
                      <span className="text-xs text-stone-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{l.city}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-stone-900"><Phone className="w-3.5 h-3.5" />{l.phone}</a>
                      <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</a>
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-stone-900"><Mail className="w-3.5 h-3.5" />{l.email}</a>
                      )}
                      {l.monthly_volume && (
                        <span className="text-xs text-stone-500">{l.monthly_volume} pcs/mo</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {dispatchPill('Email', l.email_dispatch)}
                      {dispatchPill('WhatsApp', l.whatsapp_dispatch)}
                      <span className="text-[10px] text-stone-400">{formatDate(l.created_at)}</span>
                      {(l.utm_source || l.utm_campaign) && (
                        <span className="text-[10px] text-stone-500">{[l.utm_source, l.utm_campaign].filter(Boolean).join(' / ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="relative">
                      <select
                        disabled={busyId === l.id}
                        value={l.status}
                        onChange={e => setStatus(l.id, e.target.value as Lead['status'])}
                        className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white pr-7 appearance-none">
                        {STATUSES.map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    </div>
                    {canAssign ? (
                      <div className="relative">
                        <select
                          disabled={busyId === l.id}
                          value={l.assigned_to || ''}
                          onChange={e => setAssignee(l.id, e.target.value || null)}
                          className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white pr-7 appearance-none max-w-[180px]"
                          title="Assigned to">
                          <option value="">Unassigned</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>{s.display_name || s.username}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-500" title="Assigned to">
                        {assigneeLabel(l.assigned_to)}
                      </span>
                    )}
                    {l.converted_partner_id ? (
                      <Link href={`/partners/${l.converted_partner_id}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800">
                        Open partner <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <Link href={convertHref(l)}
                        className="inline-flex items-center gap-1 text-xs text-[#1E3A5F] hover:text-[#172d49] font-medium">
                        Convert to partner <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    )}
                    <button onClick={() => toggle(l.id)} className="text-xs text-stone-500 hover:text-stone-700">
                      {open ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-stone-100 px-4 py-4 bg-stone-50 space-y-3 rounded-b-xl">
                    {l.note && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">What they said</p>
                        <p className="mt-1 text-sm text-stone-800 whitespace-pre-wrap">{l.note}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white rounded p-2.5 border border-stone-100">
                        <p className="text-stone-500">GST</p>
                        <p className="text-stone-900">{l.gst_number || '—'}</p>
                      </div>
                      <div className="bg-white rounded p-2.5 border border-stone-100">
                        <p className="text-stone-500">Referrer</p>
                        <p className="text-stone-900 truncate" title={l.referrer || ''}>{l.referrer || '—'}</p>
                      </div>
                      <div className="bg-white rounded p-2.5 border border-stone-100">
                        <p className="text-stone-500">UTM source / medium</p>
                        <p className="text-stone-900">{[l.utm_source, l.utm_medium].filter(Boolean).join(' / ') || '—'}</p>
                      </div>
                      <div className="bg-white rounded p-2.5 border border-stone-100">
                        <p className="text-stone-500">Campaign</p>
                        <p className="text-stone-900">{l.utm_campaign || '—'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Internal notes</p>
                      <textarea
                        rows={2}
                        defaultValue={l.internal_notes || ''}
                        onBlur={e => {
                          const v = e.target.value
                          if (v !== (l.internal_notes || '')) saveNote(l.id, v)
                        }}
                        className="w-full text-sm border border-stone-200 rounded p-2 bg-white"
                        placeholder="Notes for your team — saved on blur."
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
