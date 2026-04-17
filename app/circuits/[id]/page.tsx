'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import {
  ArrowLeft, Save, Edit2, X, Plus, MapPin,
  Target, TrendingUp, IndianRupee, Calendar,
  CheckCircle2, Clock, Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'

export default function CircuitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { toast } = useToast()

  const [circuit, setCircuit] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [allPartners, setAllPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Visit logging
  const [showLogVisit, setShowLogVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({
    partner_id: '', visit_date: new Date().toISOString().split('T')[0],
    outcome: 'met_owner', notes: '', sample_offered: false, catalog_left: false,
    next_action: '', next_action_date: '',
  })
  const [savingVisit, setSavingVisit] = useState(false)

  // Expense logging
  const [showExpense, setShowExpense] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: c } = await supabase.from('circuits').select('*').eq('id', id).single()
    if (!c) { router.push('/circuits'); return }
    setCircuit(c)
    setForm(c)

    const [{ data: v }, { data: p }, { data: ap }] = await Promise.all([
      supabase.from('visits')
        .select('*, partners(store_name, city)')
        .eq('circuit', c.name)
        .order('visit_date', { ascending: false })
        .limit(50),
      supabase.from('partners')
        .select('id, store_name, owner_name, city, stage, status')
        .eq('circuit', c.name)
        .order('store_name'),
      supabase.from('partners')
        .select('id, store_name, city')
        .order('store_name'),
    ])
    setVisits(v || [])
    setPartners(p || [])
    setAllPartners(ap || [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('circuits').update({
      name: form.name,
      region: form.region || null,
      cities: form.cities
        ? (typeof form.cities === 'string'
            ? form.cities.split(',').map((s: string) => s.trim()).filter(Boolean)
            : form.cities)
        : [],
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      target_visits: parseInt(form.target_visits) || null,
      target_samples: parseInt(form.target_samples) || null,
      target_partners: parseInt(form.target_partners) || null,
      budget_inr: parseFloat(form.budget_inr) || null,
      notes: form.notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setEditing(false)
    toast('Circuit updated', 'success')
    load()
  }

  async function handleDelete() {
    const { error } = await supabase.from('circuits').delete().eq('id', id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Circuit deleted', 'success')
    router.push('/circuits')
  }

  async function startTrip() {
    const km = prompt('Enter starting KM (Odometer reading):')
    if (!km) return
    
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('circuits').update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      start_km: parseInt(km),
      active_trip_rep_id: session?.user?.id
    }).eq('id', id)
    
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Trip started! Good luck on the road.', 'success')
    load()
  }

  async function closeTrip() {
    const km = prompt('Enter ending KM (Odometer reading):')
    if (!km) return

    const { error } = await supabase.from('circuits').update({
      status: 'completed',
      closed_at: new Date().toISOString(),
      end_km: parseInt(km),
    }).eq('id', id)

    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Trip closed. Welcome back!', 'success')
    load()
  }

  async function addExpense() {
    const amount = parseFloat(expenseAmount)
    if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return }

    // Aggregate spend
    const newSpent = (circuit.spent_inr || 0) + amount
    
    // Update ledger (JSONB)
    const category = (expenseNote.toLowerCase().trim() || 'other') as keyof typeof circuit.expense_ledger
    const ledger = { ...circuit.expense_ledger }
    if (ledger && category in ledger) {
      ledger[category] = (ledger[category] || 0) + amount
    } else {
      ledger['other'] = (ledger['other'] || 0) + amount
    }

    await supabase.from('circuits').update({
      spent_inr: newSpent,
      expense_ledger: ledger
    }).eq('id', id)

    setShowExpense(false)
    setExpenseAmount('')
    setExpenseNote('')
    toast(`₹${amount.toLocaleString('en-IN')} logged under ${String(category)}`, 'success')
    load()
  }


  async function logVisit() {
    if (!visitForm.partner_id) { toast('Select a partner', 'error'); return }
    setSavingVisit(true)

    const { data: { session } } = await supabase.auth.getSession()

    // Insert into visits table
    const { error: visitError } = await supabase.from('visits').insert([{
      partner_id: visitForm.partner_id,
      rep_id: session?.user?.id,
      visit_date: visitForm.visit_date,
      circuit: circuit.name,
      city: allPartners.find(p => p.id === visitForm.partner_id)?.city || '',
      outcome: visitForm.outcome,
      notes: visitForm.notes || null,
      sample_offered: visitForm.sample_offered,
      catalog_left: visitForm.catalog_left,
      next_action: visitForm.next_action || null,
      next_action_date: visitForm.next_action_date || null,
    }])

    if (visitError) { toast('Error: ' + visitError.message, 'error'); setSavingVisit(false); return }

    // Increment actual_visits on circuit
    await supabase.from('circuits').update({
      actual_visits: (circuit.actual_visits || 0) + 1,
      actual_samples: visitForm.sample_offered ? (circuit.actual_samples || 0) + 1 : circuit.actual_samples,
    }).eq('id', id)

    setSavingVisit(false)
    setShowLogVisit(false)
    setVisitForm({
      partner_id: '', visit_date: new Date().toISOString().split('T')[0],
      outcome: 'met_owner', notes: '', sample_offered: false, catalog_left: false,
      next_action: '', next_action_date: '',
    })
    toast('Visit logged!', 'success')
    load()
  }

  function pct(actual: number, target: number) {
    if (!target) return 0
    return Math.min(Math.round((actual / target) * 100), 100)
  }

  const ProgressBar = ({ value, color = 'bg-[#C49C64]' }: { value: number; color?: string }) => (
    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
    </div>
  )

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const isActive = circuit.status === 'in_progress'

  return (
    <div className="p-4 lg:p-7 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/circuits" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-900">{circuit.name}</h1>
            <span className={`status-pill ${getStatusColor(circuit.status)}`}>{circuit.status.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-stone-400 text-sm">
            {circuit.region} · {partners.length} partners · {visits.length} visits logged
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              {circuit.status === 'planned' && (
                <button onClick={startTrip}
                  className="bg-primary text-surface-lowest px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  Start Trip
                </button>
              )}
              {circuit.status === 'in_progress' && (
                <button onClick={closeTrip}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
                  End Trip
                </button>
              )}
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50 transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(circuit) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this circuit?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{circuit.name}</strong>? Visits and partners will not be deleted but will lose their circuit association.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-5">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowLogVisit(true)}
              disabled={circuit.status === 'completed'}
              className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-all">
              <Plus className="w-4 h-4" /> Log visit
            </button>
            <button onClick={() => setShowExpense(true)}
              disabled={circuit.status === 'completed'}
              className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm hover:bg-stone-50 disabled:opacity-50 transition-all">
              <IndianRupee className="w-4 h-4" /> Add expense
            </button>
          </div>


          {/* Log visit form */}
          {showLogVisit && (
            <div className="bg-white rounded-xl border-2 border-[#C49C64] p-5">
              <h3 className="font-medium text-stone-900 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C49C64]" /> Log a store visit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={lbl}>Partner / store *</label>
                  <select className={inp} value={visitForm.partner_id} onChange={e => setVisitForm(prev => ({ ...prev, partner_id: e.target.value }))}>
                    <option value="">Select partner...</option>
                    {allPartners.map(p => <option key={p.id} value={p.id}>{p.store_name} — {p.city}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Visit date</label>
                  <input type="date" className={inp} value={visitForm.visit_date} onChange={e => setVisitForm(prev => ({ ...prev, visit_date: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Outcome</label>
                  <select className={inp} value={visitForm.outcome} onChange={e => setVisitForm(prev => ({ ...prev, outcome: e.target.value }))}>
                    <option value="met_owner">Met owner</option>
                    <option value="met_staff">Met staff only</option>
                    <option value="shop_closed">Shop closed</option>
                    <option value="not_interested">Not interested</option>
                    <option value="follow_up_needed">Follow-up needed</option>
                    <option value="order_placed">Order placed</option>
                    <option value="sample_given">Sample given</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Notes</label>
                  <textarea className={`${inp} resize-none`} rows={2} value={visitForm.notes}
                    onChange={e => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="What happened during the visit..." />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input type="checkbox" checked={visitForm.sample_offered}
                      onChange={e => setVisitForm(prev => ({ ...prev, sample_offered: e.target.checked }))}
                      className="rounded" />
                    Sample offered
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input type="checkbox" checked={visitForm.catalog_left}
                      onChange={e => setVisitForm(prev => ({ ...prev, catalog_left: e.target.checked }))}
                      className="rounded" />
                    Catalog left
                  </label>
                </div>
                <div>
                  <label className={lbl}>Next action</label>
                  <input className={inp} value={visitForm.next_action}
                    onChange={e => setVisitForm(prev => ({ ...prev, next_action: e.target.value }))}
                    placeholder="e.g. Send quotation" />
                </div>
                <div>
                  <label className={lbl}>Follow-up date</label>
                  <input type="date" className={inp} value={visitForm.next_action_date}
                    onChange={e => setVisitForm(prev => ({ ...prev, next_action_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={logVisit} disabled={savingVisit}
                  className="bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
                  {savingVisit ? 'Saving...' : 'Save visit'}
                </button>
                <button onClick={() => setShowLogVisit(false)} className="text-stone-500 text-sm px-3">Cancel</button>
              </div>
            </div>
          )}

          {/* Expense form */}
          {showExpense && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-medium text-stone-900 mb-3">Add expense</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Amount (₹)</label>
                  <input type="number" className={inp} value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="e.g. 500" />
                </div>
                <div>
                  <label className={lbl}>Note</label>
                  <input className={inp} value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="e.g. Hotel, Auto, Food" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addExpense} className="bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40]">Save</button>
                <button onClick={() => setShowExpense(false)} className="text-stone-500 text-sm px-3">Cancel</button>
              </div>
            </div>
          )}

          {/* Progress cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-stone-500">Store visits</span>
              </div>
              <p className="text-2xl font-semibold text-stone-900 mb-2">
                {circuit.actual_visits || 0} <span className="text-sm text-stone-400 font-normal">/ {circuit.target_visits || '—'}</span>
              </p>
              <ProgressBar value={pct(circuit.actual_visits, circuit.target_visits || 0)} color="bg-blue-500" />
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-stone-500">Sample orders</span>
              </div>
              <p className="text-2xl font-semibold text-stone-900 mb-2">
                {circuit.actual_samples || 0} <span className="text-sm text-stone-400 font-normal">/ {circuit.target_samples || '—'}</span>
              </p>
              <ProgressBar value={pct(circuit.actual_samples, circuit.target_samples || 0)} color="bg-yellow-500" />
            </div>
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs text-stone-500">Partners signed</span>
              </div>
              <p className="text-2xl font-semibold text-stone-900 mb-2">
                {circuit.actual_partners || 0} <span className="text-sm text-stone-400 font-normal">/ {circuit.target_partners || '—'}</span>
              </p>
              <ProgressBar value={pct(circuit.actual_partners, circuit.target_partners || 0)} color="bg-green-500" />
            </div>
          </div>

          {/* Budget tracking */}
          {circuit.budget_inr && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-medium text-stone-900 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-[#C49C64]" /> Budget
                </h2>
                <span className="text-sm text-stone-500">
                  {formatCurrency(circuit.spent_inr || 0)} / {formatCurrency(circuit.budget_inr)}
                  <span className="ml-1 text-xs text-stone-400">({pct(circuit.spent_inr || 0, circuit.budget_inr)}%)</span>
                </span>
              </div>
              <ProgressBar value={pct(circuit.spent_inr || 0, circuit.budget_inr)}
                color={pct(circuit.spent_inr || 0, circuit.budget_inr) > 90 ? 'bg-red-500' : 'bg-[#C49C64]'} />
              <p className="text-xs text-stone-400 mt-2">
                Remaining: {formatCurrency(Math.max(0, circuit.budget_inr - (circuit.spent_inr || 0)))}
              </p>
            </div>
          )}

          {/* Circuit details */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Circuit details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Circuit name', circuit.name],
                ['Region', circuit.region || '—'],
                ['Status', circuit.status],
                ['Cities', Array.isArray(circuit.cities) ? circuit.cities.join(', ') || '—' : circuit.cities || '—'],
                ['Start date', circuit.start_date ? formatDate(circuit.start_date) : '—'],
                ['End date', circuit.end_date ? formatDate(circuit.end_date) : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5 capitalize">{String(v)}</p>
                </div>
              ))}
            </div>
            {circuit.notes && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Notes</p>
                <p className="text-sm text-stone-700 leading-relaxed">{circuit.notes}</p>
              </div>
            )}
          </div>

          {/* Partners */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="font-medium text-stone-900">Partners in this circuit ({partners.length})</h2>
            </div>
            {partners.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone-400">No partners assigned to this circuit yet</p>
            ) : (
              <div className="divide-y divide-stone-50">
                {partners.map(p => (
                  <Link key={p.id} href={`/partners/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{p.store_name}</p>
                      <p className="text-xs text-stone-400">{p.owner_name} · {p.city}</p>
                    </div>
                    <span className={`status-pill ${getStatusColor(p.status)}`}>{p.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Visit log */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-medium text-stone-900">Visit log ({visits.length})</h2>
              <button onClick={() => setShowLogVisit(true)} className="text-xs text-[#C49C64] hover:underline">+ Log visit</button>
            </div>
            {visits.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <MapPin className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                <p className="text-sm text-stone-400">No visits logged yet</p>
                <button onClick={() => setShowLogVisit(true)} className="text-sm text-[#C49C64] hover:underline mt-1">Log your first visit →</button>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {visits.map(v => (
                  <div key={v.id} className="px-5 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-800">{v.partners?.store_name || '—'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-stone-500 capitalize">{v.outcome?.replace(/_/g, ' ')}</span>
                          {v.sample_offered && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">sample</span>}
                          {v.catalog_left && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">catalog</span>}
                        </div>
                        {v.notes && <p className="text-xs text-stone-400 mt-1">{v.notes}</p>}
                        {v.next_action && (
                          <p className="text-xs text-[#C49C64] mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {v.next_action}
                            {v.next_action_date && ` — by ${formatDate(v.next_action_date)}`}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 shrink-0">{formatDate(v.visit_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Edit circuit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Circuit name</label>
                <input className={inp} value={form.name || ''} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Region</label>
                <input className={inp} value={form.region || ''} onChange={e => set('region', e.target.value)} placeholder="e.g. Gujarat, Maharashtra" />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || 'planned'} onChange={e => set('status', e.target.value)}>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Cities (comma separated)</label>
                <input className={inp}
                  value={Array.isArray(form.cities) ? form.cities.join(', ') : form.cities || ''}
                  onChange={e => set('cities', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Start date</label>
                <input type="date" className={inp} value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>End date</label>
                <input type="date" className={inp} value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Target visits</label>
                <input type="number" className={inp} value={form.target_visits || ''} onChange={e => set('target_visits', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Target samples</label>
                <input type="number" className={inp} value={form.target_samples || ''} onChange={e => set('target_samples', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Target partners</label>
                <input type="number" className={inp} value={form.target_partners || ''} onChange={e => set('target_partners', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Budget (₹)</label>
                <input type="number" className={inp} value={form.budget_inr || ''} onChange={e => set('budget_inr', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes</label>
                <textarea className={`${inp} resize-none`} rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
