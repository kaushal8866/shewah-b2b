'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewVendorPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    gstin: '',
    category: '',
    payment_terms: 'cash',
    credit_limit: '',
    outstanding: '0',
    status: 'active',
    notes: '',
  })

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleSave() {
    if (!form.name || !form.phone) {
      alert('Vendor name and phone are required')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      owner_name: form.owner_name || null,
      phone: form.phone,
      email: form.email || null,
      city: form.city || null,
      address: form.address || null,
      gstin: form.gstin || null,
      category: form.category || null,
      payment_terms: form.payment_terms,
      credit_limit: parseFloat(form.credit_limit) || 0,
      outstanding: parseFloat(form.outstanding) || 0,
      status: form.status,
      notes: form.notes || null,
    }
    const { error } = await supabase.from('vendors').insert([payload])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/vendors')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/vendors" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Add vendor</h1>
          <p className="text-stone-500 text-sm">Register a new supplier</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Vendor details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Vendor / business name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mehta Gems & Diamonds" />
            </div>
            <div>
              <label className={lbl}>Owner name</label>
              <input className={inp} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
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
              <label className={lbl}>City</label>
              <input className={inp} value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Address</label>
              <input className={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Shop / office address" />
            </div>
            <div>
              <label className={lbl}>GSTIN</label>
              <input className={inp} value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="GST registration number" />
            </div>
            <div>
              <label className={lbl}>Category supplied</label>
              <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select category...</option>
                <option value="cad_service">CAD Service Party</option>
                <option value="diamonds">Diamonds</option>
                <option value="gemstones">Gemstones</option>
                <option value="findings">Findings / Parts</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Payment details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Payment terms</label>
              <select className={inp} value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="net_7">Net 7 days</option>
                <option value="net_15">Net 15 days</option>
                <option value="net_30">Net 30 days</option>
                <option value="net_45">Net 45 days</option>
                <option value="net_60">Net 60 days</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Credit limit (₹)</label>
              <input type="number" className={inp} value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Current outstanding (₹)</label>
              <input type="number" className={inp} value={form.outstanding} onChange={e => set('outstanding', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} resize-none`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any notes about this vendor..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/vendors" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Add vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}
