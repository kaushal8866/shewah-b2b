'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewManufacturingPartnerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    speciality: '',
    material_policy: 'client_material',
    labour_rate_14k: '',
    labour_rate_18k: '',
    labour_rate_22k: '',
    min_labour_grams: '1',
    status: 'active',
    notes: '',
  })

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.name || !form.phone || !form.city) {
      alert('Name, phone, and city are required')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      owner_name: form.owner_name || null,
      phone: form.phone,
      email: form.email || null,
      city: form.city,
      address: form.address || null,
      speciality: form.speciality ? form.speciality.split(',').map(s => s.trim()).filter(Boolean) : null,
      material_policy: form.material_policy,
      labour_rate_14k: parseFloat(form.labour_rate_14k) || null,
      labour_rate_18k: parseFloat(form.labour_rate_18k) || null,
      labour_rate_22k: parseFloat(form.labour_rate_22k) || null,
      min_labour_grams: parseFloat(form.min_labour_grams) || 1,
      status: form.status,
      notes: form.notes || null,
    }
    const { error } = await supabase.from('manufacturing_partners').insert([payload])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/manufacturing')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/manufacturing" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Add manufacturing partner</h1>
          <p className="text-stone-500 text-sm">Register a new workshop or craftsman</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Partner details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Business / workshop name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Patel Jewellery Works" />
            </div>
            <div>
              <label className={lbl}>Owner name</label>
              <input className={inp} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="e.g. Ramesh Patel" />
            </div>
            <div>
              <label className={lbl}>Phone *</label>
              <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" className={inp} value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>City *</label>
              <input className={inp} value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Surat" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Address</label>
              <input className={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Workshop address" />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_hold">On hold</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Specialities (comma separated)</label>
              <input className={inp} value={form.speciality} onChange={e => set('speciality', e.target.value)}
                placeholder="e.g. rings, bangles, diamond setting" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Manufacturing terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Material policy</label>
              <select className={inp} value={form.material_policy} onChange={e => set('material_policy', e.target.value)}>
                <option value="client_material">Karigar supplies own material</option>
                <option value="owner_material">We supply material (via float deposit)</option>
                <option value="both">Both options available</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Labour rate 14K (₹/gram)</label>
              <input type="number" className={inp} value={form.labour_rate_14k} onChange={e => set('labour_rate_14k', e.target.value)} placeholder="e.g. 900" />
            </div>
            <div>
              <label className={lbl}>Labour rate 18K (₹/gram)</label>
              <input type="number" className={inp} value={form.labour_rate_18k} onChange={e => set('labour_rate_18k', e.target.value)} placeholder="e.g. 1200" />
            </div>
            <div>
              <label className={lbl}>Labour rate 22K (₹/gram)</label>
              <input type="number" className={inp} value={form.labour_rate_22k} onChange={e => set('labour_rate_22k', e.target.value)} placeholder="e.g. 1500" />
            </div>
            <div>
              <label className={lbl}>Minimum chargeable weight (grams)</label>
              <input type="number" step="0.1" className={inp} value={form.min_labour_grams} onChange={e => set('min_labour_grams', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} resize-none`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any specific working instructions, payment terms, speciality details..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/manufacturing" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Add partner'}
          </button>
        </div>
      </div>
    </div>
  )
}
