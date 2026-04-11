'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Settings2, Calculator, User, Phone } from 'lucide-react'
import { useToast } from '@/app/components/Toast'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data }) => {
      const map: Record<string, string> = {}
      data?.forEach(row => { map[row.key] = row.value || '' })
      setSettings(map)
    })
  }, [])

  function set(key: string, val: string) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  async function saveAll() {
    setSaving(true)
    const upserts = Object.entries(settings).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-7 max-w-2xl">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
          <p className="text-stone-500 text-sm mt-0.5">Admin configuration</p>
        </div>
        <button onClick={saveAll} disabled={saving}
          className="flex items-center gap-2 bg-[#C49C64] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save all changes'}
        </button>
      </div>

      <div className="space-y-5">
        {/* Business info */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-[#C49C64]" />
            <h2 className="font-medium text-stone-900">Business information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Business name</label>
              <input className={input} value={settings.business_name || ''} onChange={e => set('business_name', e.target.value)} />
            </div>
            <div>
              <label className={label}>Owner name</label>
              <input className={input} value={settings.owner_name || ''} onChange={e => set('owner_name', e.target.value)} />
            </div>
            <div>
              <label className={label}>WhatsApp number (with country code)</label>
              <input className={input} value={settings.whatsapp_number || ''} onChange={e => set('whatsapp_number', e.target.value)} placeholder="919XXXXXXXXX" />
            </div>
            <div>
              <label className={label}>Business address</label>
              <input className={input} value={settings.surat_address || ''} onChange={e => set('surat_address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Default pricing */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-[#C49C64]" />
            <h2 className="font-medium text-stone-900">Default pricing parameters</h2>
          </div>
          <p className="text-xs text-stone-400 mb-4">These defaults are used in the gold rate calculator and new product forms.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Default IGI cert cost (₹)</label>
              <input type="number" className={input} value={settings.default_igi_cost || ''} onChange={e => set('default_igi_cost', e.target.value)} />
            </div>
            <div>
              <label className={label}>Default making charges (₹)</label>
              <input type="number" className={input} value={settings.default_making_charges || ''} onChange={e => set('default_making_charges', e.target.value)} />
            </div>
            <div>
              <label className={label}>Trade margin target (% above COGS)</label>
              <input type="number" className={input} value={settings.trade_margin_target || ''}
                onChange={e => set('trade_margin_target', e.target.value)} placeholder="28" />
              <p className="text-xs text-stone-400 mt-1">e.g. 28 means trade price = COGS × 1.28</p>
            </div>
            <div>
              <label className={label}>MRP markup target (% above trade)</label>
              <input type="number" className={input} value={settings.mrp_markup_target || ''}
                onChange={e => set('mrp_markup_target', e.target.value)} placeholder="40" />
              <p className="text-xs text-stone-400 mt-1">e.g. 40 means MRP = trade × 1.40</p>
            </div>
          </div>
        </div>

        {/* Gold rate multipliers */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-[#C49C64]" />
            <h2 className="font-medium text-stone-900">Gold karat multipliers</h2>
          </div>
          <p className="text-xs text-stone-400 mb-4">These are used to calculate gold cost per gram for each karat from the 24K base rate.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'gold_markup_14k', label: '14K multiplier', default: '0.585' },
              { key: 'gold_markup_18k', label: '18K multiplier', default: '0.750' },
              { key: 'gold_markup_22k', label: '22K multiplier', default: '0.916' },
            ].map(f => (
              <div key={f.key}>
                <label className={label}>{f.label}</label>
                <input type="number" step="0.001" className={input}
                  value={settings[f.key] || f.default}
                  onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* CAD SLA */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-4 h-4 text-[#C49C64]" />
            <h2 className="font-medium text-stone-900">Operations defaults</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>CAD turnaround SLA (hours)</label>
              <input type="number" className={input}
                value={settings.cad_sla_hours || '48'}
                onChange={e => set('cad_sla_hours', e.target.value)} />
            </div>
            <div>
              <label className={label}>Default catalog delivery (days)</label>
              <input type="number" className={input}
                value={settings.default_delivery_days || '14'}
                onChange={e => set('default_delivery_days', e.target.value)} />
            </div>
            <div>
              <label className={label}>Advance payment required (%)</label>
              <input type="number" className={input}
                value={settings.advance_pct || '50'}
                onChange={e => set('advance_pct', e.target.value)} />
              <p className="text-xs text-stone-400 mt-1">% of total order value required upfront</p>
            </div>
            <div>
              <label className={label}>Follow-up reminder (days after visit)</label>
              <input type="number" className={input}
                value={settings.followup_days || '3'}
                onChange={e => set('followup_days', e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
