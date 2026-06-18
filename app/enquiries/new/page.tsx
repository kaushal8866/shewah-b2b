'use client'

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import {
  PRODUCT_TYPES, OCCASIONS, SOURCES,
  displayPhone, normalisePhone,
  type Customer,
} from '@/lib/customers'
import { Loader2, Search, UserPlus, X, Image as ImageIcon, Check } from 'lucide-react'

type Staff = { id: string; display_name: string | null; username: string }

export default function NewEnquiryPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-secondary">Loading...</div>}>
      <NewEnquiryForm />
    </Suspense>
  )
}

function NewEnquiryForm() {
  const router = useRouter()
  const params = useSearchParams()
  const presetCustomerId = params.get('customer_id')

  // Customer step
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // New customer fields
  const [cFullName, setCFullName] = useState('')
  const [cWhatsapp, setCWhatsapp] = useState('')
  const [cEmail,    setCEmail]    = useState('')
  const [cCity,     setCCity]     = useState('')
  const [cSource,   setCSource]   = useState('')
  const [cReferral, setCReferral] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  // Enquiry fields
  const [title,       setTitle]       = useState('')
  const [productType, setProductType] = useState('')
  const [occasion,    setOccasion]    = useState('')
  const [targetDate,  setTargetDate]  = useState('')
  const [budgetMin,   setBudgetMin]   = useState('')
  const [budgetMax,   setBudgetMax]   = useState('')
  const [karat,       setKarat]       = useState<'' | '14' | '18' | '22'>('')
  const [description, setDescription] = useState('')
  const [assignedTo,  setAssignedTo]  = useState('')
  const [staff, setStaff] = useState<Staff[]>([])

  // Image upload
  const [uploads, setUploads] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load preset customer if passed via query
  useEffect(() => {
    if (!presetCustomerId) return
    fetch(`/api/customers/${presetCustomerId}`).then(async r => {
      if (!r.ok) return
      const j = await r.json()
      if (j.customer) setCustomer(j.customer)
    })
  }, [presetCustomerId])

  // Staff for assignee picker
  useEffect(() => {
    fetch('/api/staff').then(async r => {
      if (!r.ok) return
      const j = await r.json().catch(() => null)
      setStaff(j?.staff || [])
    })
  }, [])

  // Customer search (debounced)
  useEffect(() => {
    if (customer) return
    const q = searchQ.trim()
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const digits = q.replace(/\D/g, '')
      let query: any = supabase.from('customers').select('*').is('archived_at', null).limit(10)
      if (digits.length >= 4) {
        query = query.or(`whatsapp.ilike.%${digits}%,phone.ilike.%${digits}%`)
      } else {
        query = query.ilike('full_name', `%${q}%`)
      }
      const { data } = await query
      setSearchResults((data as Customer[]) || [])
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ, customer])

  async function handleCreateCustomer() {
    setError(null)
    if (!cFullName.trim() || !cWhatsapp.trim()) {
      setError('Name and WhatsApp number are required for a new customer.')
      return
    }
    setCreatingCustomer(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cFullName,
          whatsapp:  cWhatsapp,
          email:     cEmail || null,
          city:      cCity || null,
          source:    cSource || null,
          referral_source: cReferral || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Failed to create customer'); return }
      setCustomer(j.customer)
      setShowCreate(false)
      if (j.existing) setError(`Found existing customer with this number — using ${j.customer.full_name}.`)
    } finally {
      setCreatingCustomer(false)
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (list.length === 0) return
    setUploading(true); setError(null)
    try {
      for (const file of list) {
        const url = await uploadToCloudinary(file, 'd2c_enquiry')
        setUploads(prev => [...prev, { url, name: file.name }])
      }
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items)
    const files = items.map(i => i.getAsFile()).filter((f): f is File => !!f && f.type.startsWith('image/'))
    if (files.length > 0) {
      e.preventDefault()
      handleFiles(files)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!customer) { setError('Pick or create a customer first.'); return }
    if (!title.trim()) { setError('Add a title for the enquiry.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id:  customer.id,
          title:        title.trim(),
          product_type: productType || null,
          occasion:     occasion || null,
          target_date:  targetDate || null,
          budget_min:   budgetMin || null,
          budget_max:   budgetMax || null,
          karat:        karat || null,
          description:  description || null,
          assigned_to:  assignedTo || null,
          reference_image_urls: uploads.map(u => u.url),
        }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'Failed to create enquiry'); return }
      router.push(`/enquiries/${j.enquiry.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">D2C</p>
      <h1 className="text-2xl font-serif mt-0.5 mb-1">Log a customer enquiry</h1>
      <p className="text-sm text-stone-600 mb-6">Capture a walk-in, phone or DM enquiry. The customer record is created or merged automatically.</p>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}

      {/* Step 1 — Customer */}
      <section className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-stone-900">1. Customer</h2>
          {customer && (
            <button onClick={() => { setCustomer(null); setSearchQ('') }}
              className="text-xs text-stone-500 hover:text-stone-800">Change</button>
          )}
        </div>

        {customer ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-stone-900">{customer.full_name}</p>
              <p className="text-xs text-stone-600">
                {displayPhone(customer.whatsapp)}{customer.email ? ` · ${customer.email}` : ''}{customer.city ? ` · ${customer.city}` : ''}
              </p>
            </div>
          </div>
        ) : !showCreate ? (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-lg text-sm" />
              {searching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 animate-spin" />}
            </div>
            {searchResults.length > 0 && (
              <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 mb-3 max-h-72 overflow-y-auto">
                {searchResults.map(c => (
                  <button key={c.id} onClick={() => setCustomer(c)}
                    className="w-full text-left px-3 py-2.5 hover:bg-stone-50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{c.full_name}</p>
                      <p className="text-xs text-stone-500">{displayPhone(c.whatsapp)}{c.city ? ` · ${c.city}` : ''}</p>
                    </div>
                    <span className="text-[11px] text-stone-400">Use →</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowCreate(true)}
              className="text-sm inline-flex items-center gap-1.5 text-[#1E3A5F] hover:text-[#172d49] font-medium">
              <UserPlus className="w-4 h-4" /> Create new customer
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name *">
                <input value={cFullName} onChange={e => setCFullName(e.target.value)} className={inp} />
              </Field>
              <Field label="WhatsApp number *">
                <input value={cWhatsapp} onChange={e => setCWhatsapp(e.target.value)} placeholder="98765 43210" className={inp} />
              </Field>
              <Field label="Email">
                <input value={cEmail} onChange={e => setCEmail(e.target.value)} className={inp} />
              </Field>
              <Field label="City">
                <input value={cCity} onChange={e => setCCity(e.target.value)} className={inp} />
              </Field>
              <Field label="Source">
                <select value={cSource} onChange={e => setCSource(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Referral / event name">
                <input value={cReferral} onChange={e => setCReferral(e.target.value)} className={inp} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCreateCustomer} disabled={creatingCustomer}
                className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
                {creatingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                Save customer
              </button>
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-stone-600">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Step 2 — Enquiry details */}
      <section className={`bg-white rounded-xl border border-stone-200 p-5 mb-5 ${customer ? '' : 'opacity-50 pointer-events-none'}`}>
        <h2 className="font-semibold text-stone-900 mb-3">2. Enquiry details</h2>
        <div className="space-y-3">
          <Field label="Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Solitaire engagement ring, 1ct round, platinum-look" className={inp} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Product type">
              <select value={productType} onChange={e => setProductType(e.target.value)} className={inp}>
                <option value="">—</option>
                {PRODUCT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Occasion">
              <select value={occasion} onChange={e => setOccasion(e.target.value)} className={inp}>
                <option value="">—</option>
                {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Target date">
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Budget min (₹)">
              <input inputMode="numeric" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} className={inp} />
            </Field>
            <Field label="Budget max (₹)">
              <input inputMode="numeric" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} className={inp} />
            </Field>
            <Field label="Karat">
              <select value={karat} onChange={e => setKarat(e.target.value as any)} className={inp}>
                <option value="">—</option>
                <option value="14">14kt</option>
                <option value="18">18kt</option>
                <option value="22">22kt</option>
              </select>
            </Field>
          </div>
          <Field label="Description / notes">
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Diamond preferences, design ideas, finger size, special requests…"
              className={inp} />
          </Field>
          <Field label="Assign to">
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inp}>
              <option value="">Unassigned</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.display_name || s.username}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {/* Step 3 — Reference images */}
      <section className={`bg-white rounded-xl border border-stone-200 p-5 mb-5 ${customer ? '' : 'opacity-50 pointer-events-none'}`}
        onPaste={handlePaste}>
        <h2 className="font-semibold text-stone-900 mb-1">3. Reference images</h2>
        <p className="text-xs text-stone-500 mb-3">Upload, drag-drop, or paste from clipboard (Cmd/Ctrl+V).</p>

        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-sm border border-stone-200 rounded-lg hover:border-stone-300 inline-flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Choose files
          </button>
          {uploading && <span className="text-xs text-stone-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</span>}
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)} />
        </div>

        {uploads.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {uploads.map((u, i) => (
              <div key={i} className="relative group">
                <img src={u.url} alt={u.name} className="w-full aspect-square object-cover rounded-lg border border-stone-200" />
                <button onClick={() => setUploads(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link href="/enquiries" className="text-sm text-stone-600 hover:text-stone-900 px-3 py-2">Cancel</Link>
        <button onClick={handleSubmit} disabled={submitting || !customer || !title.trim()}
          className="px-5 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Save enquiry
        </button>
      </div>
    </div>
  )
}

const inp = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
