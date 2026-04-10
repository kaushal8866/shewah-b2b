'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewPartnerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    store_name: '', owner_name: '', phone: '', email: '',
    city: '', state: '', circuit: '', address: '', sarafa_bazaar: '',
    store_type: 'independent', annual_revenue: '',
    model_preference: '', status: 'cold', stage: 'prospect',
    source: 'cold_visit', notes: '',
  })

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!form.store_name || !form.owner_name || !form.phone || !form.city || !form.state) {
      alert('Please fill in all required fields')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.from('partners').insert([form]).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push(`/partners/${data.id}`)
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] focus:ring-1 focus:ring-[#C49C64] outline-none"
  const select = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 lg:mb-7">
        <Link href="/partners" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Add partner</h1>
          <p className="text-stone-500 text-sm">New jeweler contact</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Store info */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Store information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Store name *</label>
              <input className={input} value={form.store_name} onChange={e => set('store_name', e.target.value)} placeholder="e.g. Shri Ram Jewellers" />
            </div>
            <div>
              <label className={label}>Owner name *</label>
              <input className={input} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="e.g. Ramesh Gupta" />
            </div>
            <div>
              <label className={label}>WhatsApp / Phone *</label>
              <input className={input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className={label}>Email</label>
              <input className={input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className={label}>Store type</label>
              <select className={select} value={form.store_type} onChange={e => set('store_type', e.target.value)}>
                <option value="independent">Independent store</option>
                <option value="boutique">Boutique jeweler</option>
                <option value="chain">Multi-store chain</option>
              </select>
            </div>
            <div>
              <label className={label}>Annual revenue (estimate)</label>
              <select className={select} value={form.annual_revenue} onChange={e => set('annual_revenue', e.target.value)}>
                <option value="">Not known</option>
                <option value="under_50L">Under ₹50L</option>
                <option value="50L-1Cr">₹50L – ₹1Cr</option>
                <option value="1Cr-5Cr">₹1Cr – ₹5Cr</option>
                <option value="above_5Cr">Above ₹5Cr</option>
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>City *</label>
              <input className={input} value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Nashik" />
            </div>
            <div>
              <label className={label}>State *</label>
              <select className={select} value={form.state} onChange={e => set('state', e.target.value)}>
                <option value="">Select state</option>
                {['Gujarat','Maharashtra','Madhya Pradesh','Rajasthan','Karnataka','Tamil Nadu','Delhi','Uttar Pradesh','Punjab','Haryana'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Circuit</label>
              <select className={select} value={form.circuit} onChange={e => set('circuit', e.target.value)}>
                <option value="">No circuit assigned</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="MP">Madhya Pradesh</option>
                <option value="Rajasthan">Rajasthan</option>
              </select>
            </div>
            <div>
              <label className={label}>Sarafa Bazaar / Market</label>
              <input className={input} value={form.sarafa_bazaar} onChange={e => set('sarafa_bazaar', e.target.value)} placeholder="e.g. Main Sarafa Bazaar" />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Full address</label>
              <input className={input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Shop no., street, landmark" />
            </div>
          </div>
        </div>

        {/* CRM */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">CRM details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Lead status</label>
              <select className={select} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="hot">🔥 Hot</option>
                <option value="warm">🟡 Warm</option>
                <option value="cold">🔵 Cold</option>
              </select>
            </div>
            <div>
              <label className={label}>Pipeline stage</label>
              <select className={select} value={form.stage} onChange={e => set('stage', e.target.value)}>
                <option value="prospect">Prospect</option>
                <option value="contacted">Contacted</option>
                <option value="sample_sent">Sample Sent</option>
                <option value="active">Active Partner</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className={label}>How we found them</label>
              <select className={select} value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="cold_visit">Cold visit</option>
                <option value="referral">Referral</option>
                <option value="trade_fair">Trade fair</option>
                <option value="indiamart">IndiaMART</option>
                <option value="whatsapp_group">WhatsApp group</option>
              </select>
            </div>
            <div>
              <label className={label}>Model preference</label>
              <select className={select} value={form.model_preference} onChange={e => set('model_preference', e.target.value)}>
                <option value="">Not decided</option>
                <option value="wholesale">Wholesale catalog</option>
                <option value="design_make">Design + Make</option>
                <option value="white_label">White Label OEM</option>
                <option value="all">All models</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Notes (from visit / call)</label>
              <textarea className={`${input} resize-none`} rows={3}
                value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="What did you discuss? What's their interest level? Any specific requirements?" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <Link href="/partners" className="px-5 py-2.5 text-sm text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save partner'}
          </button>
        </div>
      </div>
    </div>
  )
}
