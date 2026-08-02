'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLE,
  formatINR, displayPhone, normalisePhone, SOURCES,
  type Customer, type CustomerAddress,
} from '@/lib/customers'
import {
  Loader2, ArrowLeft, MessageCircle, Phone, Mail, MapPin, Plus,
  ArrowUpRight, Pencil, Save, X, Home,
} from 'lucide-react'
import CustomerIntelligenceWidget from '@/components/aurora/CustomerIntelligenceWidget'

type EnquirySummary = {
  id: string
  enquiry_number: string
  title: string
  status: keyof typeof ENQUIRY_STATUS_LABEL
  created_at: string
  budget_min: number | null
  budget_max: number | null
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [enquiries, setEnquiries] = useState<EnquirySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState<Partial<Customer>>({})
  const [busy, setBusy] = useState(false)
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [newAddr, setNewAddr] = useState<Partial<CustomerAddress>>({ country: 'India' })

  async function load() {
    setLoading(true); setError(null)
    const res = await fetch(`/api/customers/${id}`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to load')
      setLoading(false)
      return
    }
    const j = await res.json()
    setCustomer(j.customer)
    setAddresses(j.addresses)
    setEnquiries(j.enquiries)
    setLoading(false)
  }
  useEffect(() => { if (id) load() }, [id])

  async function saveEdit() {
    if (!customer) return
    setBusy(true)
    const patch: any = { ...edit, updated_at: new Date().toISOString() }
    if (patch.whatsapp) patch.whatsapp = normalisePhone(patch.whatsapp as string)
    if (patch.phone)    patch.phone    = normalisePhone(patch.phone as string)
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id)
    setBusy(false)
    if (error) { setError(error.message); return }
    setEditing(false); setEdit({})
    await load()
  }

  async function addAddress() {
    if (!customer) return
    if (!newAddr.line1 || !newAddr.city || !newAddr.pincode) {
      setError('Address requires line 1, city and pincode.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('customer_addresses').insert({
      customer_id: customer.id,
      label:    newAddr.label || null,
      line1:    newAddr.line1,
      line2:    newAddr.line2 || null,
      city:     newAddr.city,
      state:    newAddr.state || null,
      pincode:  newAddr.pincode,
      country:  newAddr.country || 'India',
      is_default: !!newAddr.is_default,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setShowAddrForm(false)
    setNewAddr({ country: 'India' })
    await load()
  }

  async function deleteAddress(addrId: string) {
    if (!confirm('Delete this address?')) return
    const { error } = await supabase.from('customer_addresses').delete().eq('id', addrId)
    if (error) { setError(error.message); return }
    await load()
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-stone-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  if (error)   return <div className="p-8 text-rose-700">{error}</div>
  if (!customer) return null

  const e = editing ? { ...customer, ...edit } : customer

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <Link href="/customers" className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to customers
      </Link>

      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">D2C customer</p>
          <h1 className="text-2xl font-serif mt-0.5">{customer.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <a href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800">
              <MessageCircle className="w-3.5 h-3.5" /> {displayPhone(customer.whatsapp)}
            </a>
            {customer.phone && customer.phone !== customer.whatsapp && (
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900">
                <Phone className="w-3.5 h-3.5" /> {displayPhone(customer.phone)}
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 text-stone-700 hover:text-stone-900">
                <Mail className="w-3.5 h-3.5" /> {customer.email}
              </a>
            )}
            {customer.city && <span className="inline-flex items-center gap-1 text-stone-600"><MapPin className="w-3.5 h-3.5" />{customer.city}</span>}
          </div>
        </div>
        <Link href={`/enquiries/new?customer_id=${customer.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-900">
          <Plus className="w-4 h-4" /> New enquiry
        </Link>
      </div>

      {/* Embedded AURORA Customer Intelligence Widget */}
      <CustomerIntelligenceWidget customerId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Enquiries */}
          <section className="bg-white rounded-xl border border-stone-200">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">Enquiries ({enquiries.length})</h3>
            </div>
            {enquiries.length === 0 ? (
              <p className="px-4 py-8 text-sm text-stone-500 text-center">No enquiries yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-xs text-stone-500">
                    <th className="text-left px-4 py-2 font-medium">Enquiry</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Budget</th>
                    <th className="text-left px-4 py-2 font-medium">Created</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map(en => (
                    <tr key={en.id} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-stone-900">{en.title}</p>
                        <p className="text-[11px] text-stone-500 font-mono">{en.enquiry_number}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 border font-medium ${ENQUIRY_STATUS_STYLE[en.status]}`}>
                          {ENQUIRY_STATUS_LABEL[en.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-stone-700">
                        {en.budget_min || en.budget_max ? `${formatINR(en.budget_min)} – ${formatINR(en.budget_max)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">{new Date(en.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/enquiries/${en.id}`} className="text-stone-800 hover:text-stone-900">
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Addresses */}
          <section className="bg-white rounded-xl border border-stone-200">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">Addresses ({addresses.length})</h3>
              {!showAddrForm && (
                <button onClick={() => setShowAddrForm(true)} className="text-xs text-stone-800 hover:text-stone-900 inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add address
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              {addresses.length === 0 && !showAddrForm && (
                <p className="text-sm text-stone-500">No addresses on file.</p>
              )}
              {addresses.map(a => (
                <div key={a.id} className="flex items-start justify-between gap-3 border border-stone-100 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Home className="w-4 h-4 text-stone-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {a.label || 'Address'} {a.is_default && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">default</span>}
                      </p>
                      <p className="text-sm text-stone-700">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
                      <p className="text-xs text-stone-500">{[a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteAddress(a.id)} className="text-xs text-rose-600 hover:text-rose-800">Delete</button>
                </div>
              ))}
              {showAddrForm && (
                <div className="border border-stone-200 rounded-lg p-3 space-y-2 bg-stone-50">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Label (Home/Office)" value={newAddr.label || ''} onChange={ev => setNewAddr(s => ({ ...s, label: ev.target.value }))} className={inp} />
                    <label className="inline-flex items-center gap-1.5 text-xs text-stone-600">
                      <input type="checkbox" checked={!!newAddr.is_default} onChange={ev => setNewAddr(s => ({ ...s, is_default: ev.target.checked }))} />
                      Set as default
                    </label>
                  </div>
                  <input placeholder="Line 1 *" value={newAddr.line1 || ''} onChange={ev => setNewAddr(s => ({ ...s, line1: ev.target.value }))} className={inp} />
                  <input placeholder="Line 2" value={newAddr.line2 || ''} onChange={ev => setNewAddr(s => ({ ...s, line2: ev.target.value }))} className={inp} />
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="City *" value={newAddr.city || ''} onChange={ev => setNewAddr(s => ({ ...s, city: ev.target.value }))} className={inp} />
                    <input placeholder="State" value={newAddr.state || ''} onChange={ev => setNewAddr(s => ({ ...s, state: ev.target.value }))} className={inp} />
                    <input placeholder="Pincode *" value={newAddr.pincode || ''} onChange={ev => setNewAddr(s => ({ ...s, pincode: ev.target.value }))} className={inp} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={addAddress} disabled={busy}
                      className="px-3 py-1.5 bg-stone-800 text-white text-xs rounded-lg disabled:opacity-50">Save address</button>
                    <button onClick={() => { setShowAddrForm(false); setNewAddr({ country: 'India' }) }}
                      className="px-3 py-1.5 text-xs text-stone-600">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Side: profile + edit */}
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Profile</h3>
              {editing ? (
                <div className="flex items-center gap-1">
                  <button onClick={saveEdit} disabled={busy} className="text-xs inline-flex items-center gap-1 text-emerald-700">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => { setEditing(false); setEdit({}) }} className="text-xs inline-flex items-center gap-1 text-stone-500">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="text-xs inline-flex items-center gap-1 text-stone-800 hover:text-stone-900">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Name">{editing
                ? <input className={inp} defaultValue={e.full_name} onChange={ev => setEdit(s => ({ ...s, full_name: ev.target.value }))} />
                : e.full_name}</Row>
              <Row label="WhatsApp">{editing
                ? <input className={inp} defaultValue={displayPhone(e.whatsapp)} onChange={ev => setEdit(s => ({ ...s, whatsapp: ev.target.value }))} />
                : displayPhone(e.whatsapp)}</Row>
              <Row label="Phone">{editing
                ? <input className={inp} defaultValue={e.phone || ''} onChange={ev => setEdit(s => ({ ...s, phone: ev.target.value }))} />
                : (e.phone ? displayPhone(e.phone) : '—')}</Row>
              <Row label="Email">{editing
                ? <input className={inp} defaultValue={e.email || ''} onChange={ev => setEdit(s => ({ ...s, email: ev.target.value }))} />
                : (e.email || '—')}</Row>
              <Row label="City">{editing
                ? <input className={inp} defaultValue={e.city || ''} onChange={ev => setEdit(s => ({ ...s, city: ev.target.value }))} />
                : (e.city || '—')}</Row>
              <Row label="GST">{editing
                ? <input className={inp} defaultValue={e.gst_number || ''} onChange={ev => setEdit(s => ({ ...s, gst_number: ev.target.value }))} />
                : (e.gst_number || '—')}</Row>
              <Row label="Birthday">{editing
                ? <input type="date" className={inp} defaultValue={e.birthday || ''} onChange={ev => setEdit(s => ({ ...s, birthday: ev.target.value }))} />
                : (e.birthday ? new Date(e.birthday).toLocaleDateString('en-IN') : '—')}</Row>
              <Row label="Anniversary">{editing
                ? <input type="date" className={inp} defaultValue={e.anniversary || ''} onChange={ev => setEdit(s => ({ ...s, anniversary: ev.target.value }))} />
                : (e.anniversary ? new Date(e.anniversary).toLocaleDateString('en-IN') : '—')}</Row>
              <Row label="Source">{editing
                ? <select className={inp} defaultValue={e.source || ''} onChange={ev => setEdit(s => ({ ...s, source: ev.target.value || null }))}>
                    <option value="">—</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : (e.source || '—')}</Row>
              <Row label="Referral">{editing
                ? <input className={inp} defaultValue={e.referral_source || ''} onChange={ev => setEdit(s => ({ ...s, referral_source: ev.target.value }))} />
                : (e.referral_source || '—')}</Row>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-2">Internal notes</h3>
            <textarea rows={4} defaultValue={customer.internal_notes || ''}
              onBlur={async ev => {
                if (ev.target.value === (customer.internal_notes || '')) return
                await supabase.from('customers').update({ internal_notes: ev.target.value, updated_at: new Date().toISOString() }).eq('id', customer.id)
                await load()
              }}
              placeholder="Saved on blur."
              className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-sm" />
          </section>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full px-2.5 py-1.5 border border-stone-200 rounded text-sm'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-stone-500 pt-1.5 w-24 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{typeof children === 'string' ? <span className="text-sm text-stone-800 break-words">{children}</span> : children}</div>
    </div>
  )
}
