'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import Link from 'next/link'

export default function NewCircuitPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const [form, setForm] = useState({
    name: '', region: '', cities: [] as string[],
    start_date: '', end_date: '', status: 'planned',
    target_visits: '', target_samples: '', target_partners: '',
    budget_inr: '', notes: '',
  })

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  function addCity() {
    if (!cityInput.trim()) return
    if (!form.cities.includes(cityInput.trim())) {
      setForm(prev => ({ ...prev, cities: [...prev.cities, cityInput.trim()] }))
    }
    setCityInput('')
  }

  function removeCity(city: string) {
    setForm(prev => ({ ...prev, cities: prev.cities.filter(c => c !== city) }))
  }

  async function handleSave() {
    if (!form.name) { alert('Circuit name is required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('circuits').insert([{
      ...form,
      target_visits: parseInt(form.target_visits) || null,
      target_samples: parseInt(form.target_samples) || null,
      target_partners: parseInt(form.target_partners) || null,
      budget_inr: parseFloat(form.budget_inr) || null,
      actual_visits: 0, actual_samples: 0, actual_partners: 0, spent_inr: 0,
    }]).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/circuits')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  const SUGGESTED_CITIES = {
    Gujarat: ['Vadodara', 'Rajkot', 'Anand', 'Bharuch', 'Nadiad', 'Bhavnagar'],
    Maharashtra: ['Nashik', 'Aurangabad', 'Nagpur', 'Kolhapur', 'Solapur', 'Amravati'],
    MP: ['Indore', 'Bhopal', 'Ujjain', 'Jabalpur', 'Gwalior', 'Ratlam'],
    Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
  }

  const suggestedForRegion = form.region ? (SUGGESTED_CITIES as any)[form.region] || [] : []

  return (
    <div className="p-4 lg:p-7 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/circuits" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Plan a circuit</h1>
          <p className="text-stone-500 text-sm">B2B visit trip</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Trip details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Circuit name *</label>
              <input className={input} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Gujarat Circuit — Apr 2025" />
            </div>
            <div>
              <label className={label}>Region</label>
              <select className={input} value={form.region} onChange={e => set('region', e.target.value)}>
                <option value="">Select region</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="MP">Madhya Pradesh</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div></div>
            <div>
              <label className={label}>Start date</label>
              <input type="date" className={input} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={label}>End date</label>
              <input type="date" className={input} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Cities to visit</h2>
          {suggestedForRegion.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-stone-400 mb-2">Suggested for {form.region}:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedForRegion.map((city: string) => (
                  <button key={city} onClick={() => {
                    if (!form.cities.includes(city)) {
                      setForm(prev => ({ ...prev, cities: [...prev.cities, city] }))
                    }
                  }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.cities.includes(city)
                        ? 'bg-[#C49C64] text-white border-[#C49C64]'
                        : 'border-stone-200 text-stone-500 hover:border-[#C49C64] hover:text-[#C49C64]'
                    }`}>
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <input className={`${input} flex-1`} value={cityInput} onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCity() } }}
              placeholder="Type a city name and press Enter" />
            <button onClick={addCity}
              className="px-3 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {form.cities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.cities.map((city, i) => (
                <span key={city} className="flex items-center gap-1 bg-stone-100 text-stone-700 text-xs px-2.5 py-1 rounded-full">
                  <span className="text-stone-400 text-xs">{i + 1}.</span>
                  {city}
                  <button onClick={() => removeCity(city)} className="text-stone-400 hover:text-stone-600 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Targets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Store visits target</label>
              <input type="number" className={input} value={form.target_visits}
                onChange={e => set('target_visits', e.target.value)} placeholder="e.g. 20 per day" />
            </div>
            <div>
              <label className={label}>Sample orders target</label>
              <input type="number" className={input} value={form.target_samples}
                onChange={e => set('target_samples', e.target.value)} placeholder="e.g. 5" />
            </div>
            <div>
              <label className={label}>Partners target</label>
              <input type="number" className={input} value={form.target_partners}
                onChange={e => set('target_partners', e.target.value)} placeholder="e.g. 3" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Budget & notes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Budget (₹)</label>
              <input type="number" className={input} value={form.budget_inr}
                onChange={e => set('budget_inr', e.target.value)} placeholder="e.g. 12000" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Notes / preparation checklist</label>
              <textarea className={`${input} resize-none`} rows={3} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="e.g. Carry 50 catalogs, 3 demo rings, 500 visiting cards. Book hotel in Nashik for night 1." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/circuits" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save circuit'}
          </button>
        </div>
      </div>
    </div>
  )
}
