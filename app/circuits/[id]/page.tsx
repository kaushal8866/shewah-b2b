'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Edit2, X } from 'lucide-react'
import Link from 'next/link'

export default function CircuitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [circuit, setCircuit] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: c } = await supabase.from('circuits').select('*').eq('id', id).single()
    if (!c) { router.push('/circuits'); return }
    setCircuit(c)
    setForm(c)

    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from('visits')
        .select('*, partners(store_name)')
        .eq('circuit', c.name)
        .order('visit_date', { ascending: false })
        .limit(20),
      supabase.from('partners')
        .select('id, store_name, owner_name, city, stage, status')
        .eq('circuit', c.name)
        .order('store_name'),
    ])
    setVisits(v || [])
    setPartners(p || [])
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
    if (error) { alert('Error: ' + error.message); return }
    setEditing(false)
    load()
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/circuits" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{circuit.name} Circuit</h1>
          <p className="text-stone-400 text-sm">
            {circuit.region} · {partners.length} partners
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(circuit) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#C49C64] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <span className={`status-pill ${getStatusColor(circuit.status)}`}>{circuit.status}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Partners', value: `${circuit.actual_partners || 0} / ${circuit.target_partners || '—'}` },
              { label: 'Store visits', value: `${circuit.actual_visits || 0} / ${circuit.target_visits || '—'}` },
              { label: 'Sample orders', value: `${circuit.actual_samples || 0} / ${circuit.target_samples || '—'}` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-4">
                <p className="text-xs text-stone-400">{s.label}</p>
                <p className="text-lg font-semibold text-stone-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

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
                ['Budget', circuit.budget_inr ? `₹${circuit.budget_inr.toLocaleString('en-IN')}` : '—'],
                ['Spent', `₹${(circuit.spent_inr || 0).toLocaleString('en-IN')}`],
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

          {visits.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="font-medium text-stone-900">Recent visits ({visits.length})</h2>
              </div>
              <div className="divide-y divide-stone-50">
                {visits.map(v => (
                  <div key={v.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{v.partners?.store_name}</p>
                      <p className="text-xs text-stone-400 capitalize">{v.outcome?.replace(/_/g, ' ')}</p>
                      {v.notes && <p className="text-xs text-stone-400 mt-0.5">{v.notes}</p>}
                    </div>
                    <p className="text-xs text-stone-400 shrink-0">{formatDate(v.visit_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
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
