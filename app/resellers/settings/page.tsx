'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Settings, Check } from 'lucide-react'
import Link from 'next/link'

export default function ResellerSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [settings, setSettings] = useState({
    reseller_default_credit_limit: '50000', // in ₹
    reseller_default_markup_percent: '15.0',
    reseller_sample_return_days: '30',
    reseller_order_payment_hours: '48',
    reseller_auto_suspend_balance: '100000', // in ₹
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', Object.keys(settings))

      if (error) {
        alert('Error loading settings: ' + error.message)
      } else if (data) {
        const loaded: Record<string, string> = {}
        data.forEach((row: any) => {
          if (row.key === 'reseller_default_credit_limit' || row.key === 'reseller_auto_suspend_balance') {
            // Convert paise to rupees for form input
            loaded[row.key] = String(Number(row.value) / 100)
          } else {
            loaded[row.key] = row.value
          }
        })
        setSettings(prev => ({ ...prev, ...loaded }))
      }
    } catch (e: any) {
      alert('Error fetching settings: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)

    try {
      const rows = Object.entries(settings).map(([key, val]) => {
        let value = val
        if (key === 'reseller_default_credit_limit' || key === 'reseller_auto_suspend_balance') {
          // Convert rupees back to paise for database storage
          value = String((Number(val) || 0) * 100)
        }
        return { key, value }
      })

      // Perform upserts for each setting
      const { error } = await supabase.from('settings').upsert(rows)

      if (error) {
        alert('Error saving settings: ' + error.message)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err: any) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm font-semibold text-stone-800'

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading settings...</div>

  return (
    <div className="p-4 lg:p-7 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/resellers"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/resellers" className="hover:text-stone-700">Resellers</Link>
            <span>/</span>
            <span className="text-stone-700">Settings</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-stone-500" />
            Reseller Program Configuration
          </h1>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-55 border border-green-200 text-green-700 rounded-xl text-xs font-semibold flex items-center gap-1">
          <Check className="w-4 h-4" /> Global settings updated successfully.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-stone-800 text-sm pb-2 border-b border-stone-100 mb-3">Onboarding Defaults</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Default Credit Limit (₹)</label>
              <input
                type="number"
                className={inp}
                value={settings.reseller_default_credit_limit}
                onChange={e => setSettings(p => ({ ...p, reseller_default_credit_limit: e.target.value }))}
                min="0"
                required
              />
            </div>
            <div>
              <label className={lbl}>Default Markup %</label>
              <input
                type="number"
                step="0.1"
                className={inp}
                value={settings.reseller_default_markup_percent}
                onChange={e => setSettings(p => ({ ...p, reseller_default_markup_percent: e.target.value }))}
                min="0"
                max="100"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-stone-800 text-sm pb-2 border-b border-stone-100 mb-3">Sample Return & Cancellation Policies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Sample Return Due Duration (Days)</label>
              <input
                type="number"
                className={inp}
                value={settings.reseller_sample_return_days}
                onChange={e => setSettings(p => ({ ...p, reseller_sample_return_days: e.target.value }))}
                min="1"
                required
              />
            </div>
            <div>
              <label className={lbl}>Order Payment Timeframe (Hours)</label>
              <input
                type="number"
                className={inp}
                value={settings.reseller_order_payment_hours}
                onChange={e => setSettings(p => ({ ...p, reseller_order_payment_hours: e.target.value }))}
                min="1"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-stone-800 text-sm pb-2 border-b border-stone-100 mb-3">Risk & Safety Safeguards</h3>
          <div>
            <label className={lbl}>Auto-Suspension Limit (Outstanding Balance ₹)</label>
            <input
              type="number"
              className={inp}
              value={settings.reseller_auto_suspend_balance}
              onChange={e => setSettings(p => ({ ...p, reseller_auto_suspend_balance: e.target.value }))}
              min="0"
              required
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Reseller accounts will be flagged or restricted if their total unpaid outstanding balance exceeds this threshold.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/resellers"
            className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
