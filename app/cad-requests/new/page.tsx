'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewCADRequestPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [partners, setPartners] = useState<{ id: string; store_name: string; city: string }[]>([])
  const [cadParties, setCadParties] = useState<{ id: string; name: string; city?: string }[]>([])

  const [form, setForm] = useState({
    partner_id: '', brief_text: '', diamond_shape: 'round',
    diamond_weight: '', gold_karat: '18', setting_type: '',
    special_requests: '', priority: 'normal',
    cad_party_id: '',
    due_date: new Date(Date.now() + 48 * 3600000).toISOString().split('T')[0],
  })

  useEffect(() => {
    Promise.all([
      supabase.from('partners').select('id, store_name, city').eq('stage', 'active').order('store_name'),
      supabase.from('vendors').select('id, name, city').order('name'),
    ]).then(([{ data: p }, { data: v }]) => {
      setPartners(p || [])
      setCadParties(v || [])
    })
  }, [])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.partner_id || !form.brief_text) {
      alert('Partner and brief are required')
      return
    }
    setSaving(true)

    // Generate request number
    const { count } = await supabase.from('cad_requests').select('*', { count: 'exact', head: true })
    const num = `SH-CAD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { data, error } = await supabase.from('cad_requests').insert([{
      ...form,
      request_number: num,
      gold_karat: parseInt(form.gold_karat),
      cad_party_id: form.cad_party_id || null,
      received_date: new Date().toISOString().split('T')[0],
    }]).select().single()

    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/cad-requests')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/cad-requests" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">New CAD request</h1>
          <p className="text-stone-500 text-sm">48-hour design turnaround</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Request details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={label}>Partner (jeweler) *</label>
              <select className={input} value={form.partner_id} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.store_name} — {p.city}</option>
                ))}
              </select>
              {partners.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No active partners found. <Link href="/partners/new" className="underline">Add a partner first.</Link></p>
              )}
            </div>
            <div>
              <label className={label}>Priority</label>
              <select className={input} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="normal">Normal (48 hours)</option>
                <option value="urgent">Urgent (24 hours)</option>
              </select>
            </div>
            <div>
              <label className={label}>Due date</label>
              <input type="date" className={input} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>CAD service party</label>
              <select className={input} value={form.cad_party_id} onChange={e => set('cad_party_id', e.target.value)}>
                <option value="">In-house / Select external party...</option>
                {cadParties.map(v => (
                  <option key={v.id} value={v.id}>{v.name}{v.city ? ` — ${v.city}` : ''}</option>
                ))}
              </select>
              <p className="text-xs text-stone-400 mt-1">Select the vendor handling the CAD design work</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Design brief</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={label}>Brief description *</label>
              <textarea className={`${input} resize-none`} rows={4}
                value={form.brief_text} onChange={e => set('brief_text', e.target.value)}
                placeholder="Describe the design: e.g. 'Oval solitaire in 18K yellow gold with thin pavé band. Customer wants something modern but not flashy. Reference image attached.'" />
            </div>
            <div>
              <label className={label}>Diamond shape</label>
              <select className={input} value={form.diamond_shape} onChange={e => set('diamond_shape', e.target.value)}>
                {['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Diamond weight</label>
              <input className={input} value={form.diamond_weight} onChange={e => set('diamond_weight', e.target.value)} placeholder="e.g. 0.5ct or 0.5-0.7ct range" />
            </div>
            <div>
              <label className={label}>Gold karat</label>
              <select className={input} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                <option value="14">14K</option>
                <option value="18">18K</option>
                <option value="22">22K</option>
              </select>
            </div>
            <div>
              <label className={label}>Setting type</label>
              <input className={input} value={form.setting_type} onChange={e => set('setting_type', e.target.value)} placeholder="e.g. prong, bezel, pavé, halo" />
            </div>
            <div className="col-span-2">
              <label className={label}>Special requests / notes</label>
              <textarea className={`${input} resize-none`} rows={2}
                value={form.special_requests} onChange={e => set('special_requests', e.target.value)}
                placeholder="Any specific customer requirements, size preferences, budget constraints..." />
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">After saving this request:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-amber-700">
            <li>Go to your CAD software and create the design</li>
            <li>Upload render images to the request detail page</li>
            <li>Mark status as "Sent" when you WhatsApp the CAD to the partner</li>
            <li>Update to "Approved" or "Revision requested" based on partner response</li>
          </ol>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/cad-requests" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Create request'}
          </button>
        </div>
      </div>
    </div>
  )
}
