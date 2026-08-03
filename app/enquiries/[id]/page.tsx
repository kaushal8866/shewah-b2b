'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import {
  ENQUIRY_STATUSES, ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLE,
  formatINR, displayPhone,
  type CustomerEnquiry, type Customer, type EnquiryActivity,
} from '@/lib/customers'
import { useSession } from 'next-auth/react'
import {
  Loader2, ArrowLeft, MessageCircle, Phone, Mail, MapPin, Calendar,
  ImagePlus, Send, X, Image as ImageIcon, User as UserIcon, Link as LinkIcon, Eye, Copy, Check,
  Trash2, AlertTriangle,
} from 'lucide-react'

type Staff = { id: string; display_name: string | null; username: string }

export default function EnquiryDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id as string

  const [enquiry, setEnquiry] = useState<CustomerEnquiry | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [activity, setActivity] = useState<EnquiryActivity[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [journeyLink, setJourneyLink] = useState<{ token: string; expires_at: string; revoked_at?: string | null; opened_count: number; last_opened_at?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [noteText, setNoteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete is master-only and confirmed inline rather than in a popup.
  const { data: session } = useSession()
  const isMaster = (session?.user as any)?.role === 'master'
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/enquiries/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Server refusals (e.g. already converted to an order) carry a reason
        // worth reading, so show it in place instead of a generic failure.
        setDeleteError(body.error || `Could not delete (${res.status})`)
        setDeleting(false)
        return
      }
      router.push('/enquiries')
    } catch (e: any) {
      setDeleteError(e?.message || 'Network error')
      setDeleting(false)
    }
  }

  async function load() {
    setLoading(true); setError(null)
    const { data: e, error: err } = await supabase
      .from('customer_enquiries').select('*').eq('id', id).maybeSingle()
    if (err) { setError(err.message); setLoading(false); return }
    if (!e)  { setError('Not found'); setLoading(false); return }
    setEnquiry(e as any)
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', (e as any).customer_id).maybeSingle(),
      supabase.from('customer_enquiry_activity').select('*').eq('enquiry_id', id).order('created_at', { ascending: false }),
    ])
    setCustomer((c as any) || null)
    setActivity((a as any) || [])

    // Fetch the journey link for this customer's most-recent order, if any.
    // Surfaced on the side rail so the operator can copy/share without
    // hopping over to the order page.
    if ((e as any).converted_order_id) {
      const { data: jl } = await supabase
        .from('customer_journey_links')
        .select('token, expires_at, revoked_at, opened_count, last_opened_at')
        .eq('order_id', (e as any).converted_order_id)
        .maybeSingle()
      setJourneyLink((jl as any) || null)
    } else if ((e as any).customer_id) {
      const { data: jl } = await supabase
        .from('customer_journey_links')
        .select('token, expires_at, revoked_at, opened_count, last_opened_at, created_at')
        .eq('customer_id', (e as any).customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
      setJourneyLink((jl?.[0] as any) || null)
    } else {
      setJourneyLink(null)
    }

    setLoading(false)
  }
  useEffect(() => { if (id) load() }, [id])

  useEffect(() => {
    fetch('/api/staff').then(async r => {
      if (!r.ok) return
      const j = await r.json().catch(() => null)
      setStaff(j?.staff || [])
    })
  }, [])

  const staffById: Record<string, Staff> = {}
  for (const s of staff) staffById[s.id] = s

  async function patch(partial: Partial<CustomerEnquiry>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Save failed'); return }
      await load()
    } finally { setBusy(false) }
  }

  async function addNote() {
    if (!noteText.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/enquiries/${id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteText.trim() }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Save failed'); return }
      setNoteText('')
      await load()
    } finally { setBusy(false) }
  }

  async function handleFiles(files: FileList | File[]) {
    if (!enquiry) return
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (list.length === 0) return
    setBusy(true)
    try {
      const newUrls: string[] = []
      for (const f of list) {
        const url = await uploadToCloudinary(f, 'd2c_enquiry')
        newUrls.push(url)
      }
      await patch({ reference_image_urls: [...(enquiry.reference_image_urls || []), ...newUrls] })
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally { setBusy(false) }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items)
    const files = items.map(i => i.getAsFile()).filter((f): f is File => !!f && f.type.startsWith('image/'))
    if (files.length > 0) { e.preventDefault(); handleFiles(files) }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-stone-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  if (error)   return <div className="p-8 text-rose-700">{error}</div>
  if (!enquiry || !customer) return null

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto" onPaste={handlePaste}>
      <Link href="/enquiries" className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to inbox
      </Link>

      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-xs text-stone-500 font-mono">{enquiry.enquiry_number}</p>
          <h1 className="text-2xl font-serif mt-0.5">{enquiry.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            {enquiry.product_type && <span className="capitalize">{enquiry.product_type}</span>}
            {enquiry.occasion && <><span className="text-stone-300">·</span><span className="capitalize">{enquiry.occasion}</span></>}
            {enquiry.target_date && <><span className="text-stone-300">·</span><Calendar className="w-3 h-3" /><span>by {new Date(enquiry.target_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span></>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 border font-medium ${ENQUIRY_STATUS_STYLE[enquiry.status]}`}>
            {ENQUIRY_STATUS_LABEL[enquiry.status]}
          </span>
          {busy && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
          {isMaster && !confirmingDelete && (
            <button
              type="button"
              onClick={() => { setConfirmingDelete(true); setDeleteError(null) }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-600 transition-colors px-2 py-1 -mr-2 rounded-lg min-h-[32px]"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Inline delete confirmation — deliberately in the page flow, not a
          modal, so it can't be dismissed by a stray tap on a phone. */}
      {confirmingDelete && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-900">
                Delete {enquiry.enquiry_number}?
              </p>
              <p className="text-sm text-rose-800/80 mt-1">
                This removes the enquiry and its whole timeline. It cannot be undone.
                To just clear it from the inbox, set the status to <strong>Dropped</strong> instead.
              </p>

              {deleteError && (
                <p className="text-sm text-rose-900 bg-rose-100 border border-rose-200 rounded-lg px-3 py-2 mt-3">
                  {deleteError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg min-h-[44px]"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Deleting…' : 'Yes, delete it'}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmingDelete(false); setDeleteError(null) }}
                  disabled={deleting}
                  className="text-sm text-stone-600 hover:text-stone-900 px-4 py-2 rounded-lg min-h-[44px]"
                >
                  Keep it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          {enquiry.description && (
            <Card title="Description">
              <p className="text-sm text-stone-800 whitespace-pre-wrap">{enquiry.description}</p>
            </Card>
          )}

          {/* Specs */}
          <Card title="Specs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Karat" value={enquiry.karat ? `${enquiry.karat}kt` : '—'} />
              <Stat label="Gold est." value={enquiry.gold_weight_estimate_g ? `${enquiry.gold_weight_estimate_g} g` : '—'} />
              <Stat label="Budget min" value={formatINR(enquiry.budget_min)} />
              <Stat label="Budget max" value={formatINR(enquiry.budget_max)} />
            </div>
          </Card>

          {/* Reference images */}
          <Card title={`Reference images (${enquiry.reference_image_urls?.length || 0})`}
            action={
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs inline-flex items-center gap-1 text-stone-800 hover:text-stone-900">
                <ImagePlus className="w-3.5 h-3.5" /> Add (or paste)
              </button>
            }>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)} />
            {(enquiry.reference_image_urls?.length || 0) === 0 ? (
              <p className="text-xs text-stone-400">No images yet — upload, drag-drop, or paste from clipboard.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {enquiry.reference_image_urls.map((u, i) => (
                  <div key={u} className="relative group">
                    <a href={u} target="_blank" rel="noopener noreferrer">
                      <img src={u} className="w-full aspect-square object-cover rounded-lg border border-stone-200" alt="" />
                    </a>
                    <button onClick={() => patch({ reference_image_urls: enquiry.reference_image_urls.filter((_, j) => j !== i) })}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Activity */}
          <Card title="Timeline">
            <div className="flex items-start gap-2 mb-4">
              <textarea rows={2} value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Add an internal note (visible to the team only)…"
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm" />
              <button onClick={addNote} disabled={busy || !noteText.trim()}
                className="px-3 py-2 bg-stone-800 text-white text-sm rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Post
              </button>
            </div>
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-xs text-stone-400">No activity yet.</p>
              ) : activity.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 text-stone-500">
                    <UserIcon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-stone-500">
                      <span className="font-medium text-stone-700">{a.actor_id ? (staffById[a.actor_id]?.display_name || staffById[a.actor_id]?.username || 'Team') : 'System'}</span>
                      <span className="mx-1.5">·</span>
                      {describeActivity(a)}
                      <span className="mx-1.5">·</span>
                      {new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {a.body && <p className="mt-1 text-sm text-stone-800 whitespace-pre-wrap">{a.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <Card title="Customer">
            <Link href={`/customers/${customer.id}`} className="block group">
              <p className="font-semibold text-stone-900 group-hover:text-stone-800">{customer.full_name}</p>
              <p className="text-xs text-stone-500 mt-0.5">View profile →</p>
            </Link>
            <div className="mt-3 space-y-1.5 text-sm">
              <a href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800">
                <MessageCircle className="w-3.5 h-3.5" /> {displayPhone(customer.whatsapp)}
              </a>
              {customer.phone && customer.phone !== customer.whatsapp && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-stone-700 hover:text-stone-900">
                  <Phone className="w-3.5 h-3.5" /> {displayPhone(customer.phone)}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-stone-700 hover:text-stone-900">
                  <Mail className="w-3.5 h-3.5" /> {customer.email}
                </a>
              )}
              {customer.city && (
                <p className="flex items-center gap-2 text-stone-600"><MapPin className="w-3.5 h-3.5" /> {customer.city}</p>
              )}
            </div>
          </Card>

          <Card title="Workflow">
            <label className="block">
              <span className="text-xs text-stone-500">Status</span>
              <select value={enquiry.status} onChange={e => patch({ status: e.target.value as any })}
                className="w-full mt-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white">
                {ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{ENQUIRY_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="block mt-3">
              <span className="text-xs text-stone-500">Assigned to</span>
              <select value={enquiry.assigned_to || ''} onChange={e => patch({ assigned_to: (e.target.value || null) as any })}
                className="w-full mt-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white">
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.display_name || s.username}</option>)}
              </select>
            </label>
            <label className="block mt-3">
              <span className="text-xs text-stone-500">Next follow-up</span>
              <input type="datetime-local"
                value={enquiry.next_followup_at ? toLocalInput(enquiry.next_followup_at) : ''}
                onChange={e => patch({ next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : (null as any) })}
                className="w-full mt-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white" />
            </label>
          </Card>

          {journeyLink && <JourneyLinkCard link={journeyLink} />}

          <Card title="Internal notes">
            <textarea rows={3}
              defaultValue={enquiry.internal_notes || ''}
              onBlur={e => { if (e.target.value !== (enquiry.internal_notes || '')) patch({ internal_notes: e.target.value }) }}
              className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm"
              placeholder="Saved on blur." />
          </Card>
        </div>
      </div>
    </div>
  )
}

function JourneyLinkCard({ link }: { link: { token: string; expires_at: string; revoked_at?: string | null; opened_count: number; last_opened_at?: string | null } }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/c/${link.token}` : `/c/${link.token}`
  const isRevoked = !!link.revoked_at
  const isExpired = new Date(link.expires_at).getTime() < Date.now()
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }
  return (
    <Card title="Customer journey link">
      <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
        {isRevoked ? <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">Revoked</span>
          : isExpired ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expired</span>
          : <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">Active</span>}
        <Eye className="w-3 h-3" />
        <span>{link.last_opened_at ? `viewed ${new Date(link.last_opened_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'never viewed'}</span>
        <span>· {link.opened_count} opens</span>
      </div>
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5">
        <LinkIcon className="w-3 h-3 text-stone-400 shrink-0" />
        <code className="text-[11px] text-stone-700 truncate flex-1">{url}</code>
        <button onClick={copy} className="text-stone-400 hover:text-stone-700 p-0.5 shrink-0">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </Card>
  )
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-stone-400">{label}</p>
      <p className="text-sm text-stone-900 mt-0.5">{value}</p>
    </div>
  )
}

function describeActivity(a: EnquiryActivity): string {
  switch (a.type) {
    case 'created':       return 'created the enquiry'
    case 'note':          return 'added a note'
    case 'status_change': return `moved status: ${a.payload?.from || '—'} → ${a.payload?.to || '—'}`
    case 'assigned':      return a.payload?.to ? 'reassigned' : 'unassigned'
    case 'image_added':   return `added ${a.payload?.count || 1} image(s)`
    case 'followup_set':  return `set follow-up for ${a.payload?.to ? new Date(a.payload.to).toLocaleString('en-IN') : (a.payload?.at ? new Date(a.payload.at).toLocaleString('en-IN') : '—')}`
    case 'followup_cleared': return 'cleared the follow-up reminder'
    case 'updated':       return `edited ${(a.payload?.fields || []).join(', ') || 'fields'}`
    default:              return a.type
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
