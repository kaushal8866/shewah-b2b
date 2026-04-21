'use client'

import { useState, FormEvent } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { VOLUME_OPTIONS, BRAND } from '@/lib/landingCopy'

type FormState = {
  full_name: string
  store_name: string
  city: string
  phone: string
  whatsapp: string
  email: string
  gst_number: string
  monthly_volume: string
  note: string
  /* Bot honeypot — real users never fill this */
  website: string
  /* Mirror checkbox so users don't have to enter WhatsApp twice */
  whatsapp_same: boolean
}

const empty: FormState = {
  full_name: '', store_name: '', city: '', phone: '', whatsapp: '',
  email: '', gst_number: '', monthly_volume: '', note: '',
  website: '', whatsapp_same: true,
}

function readUtm(): Record<string, string | null> {
  if (typeof window === 'undefined') return {}
  const sp = new URLSearchParams(window.location.search)
  return {
    utm_source:   sp.get('utm_source'),
    utm_medium:   sp.get('utm_medium'),
    utm_campaign: sp.get('utm_campaign'),
    utm_content:  sp.get('utm_content'),
    utm_term:     sp.get('utm_term'),
    referrer:     document.referrer || null,
    landing_path: window.location.pathname + window.location.search,
  }
}

export default function LeadForm({ compact = false }: { compact?: boolean }) {
  const [f, setF] = useState<FormState>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF(prev => ({ ...prev, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.full_name.trim() || !f.store_name.trim() || !f.city.trim() || !f.phone.trim()) {
      setError('Please fill name, store, city and phone.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...f,
        whatsapp: f.whatsapp_same ? f.phone : f.whatsapp,
        ...readUtm(),
      }
      const res = await fetch('/api/public/partner-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j?.error || `Could not submit (${res.status}). Please try again.`)
        return
      }
      // Fire conversion pixels (best-effort)
      try { (window as any).fbq && (window as any).fbq('track', 'Lead') } catch {}
      try { (window as any).gtag && (window as any).gtag('event', 'generate_lead', { value: 1 }) } catch {}
      setDone(true)
      setF(empty)
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Thanks — we&rsquo;ve got it.</p>
            <p className="mt-1 text-sm text-emerald-800">
              Your assigned partner manager will reach out on WhatsApp within one business day. Save this number to your contacts so it doesn&rsquo;t go to spam: <span className="font-medium">{`+${BRAND.whatsappE164.slice(0,2)} ${BRAND.whatsappE164.slice(2)}`}</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/15 bg-white'

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Honeypot — hidden visually & from screen readers */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={f.website}
        onChange={e => set('website', e.target.value)}
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0 }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Your name *</label>
          <input className={inputCls} value={f.full_name} onChange={e => set('full_name', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Store name *</label>
          <input className={inputCls} value={f.store_name} onChange={e => set('store_name', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">City *</label>
          <input className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Phone *</label>
          <input type="tel" inputMode="tel" className={inputCls} value={f.phone} onChange={e => set('phone', e.target.value)} required />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id="wa-same" type="checkbox" className="rounded border-stone-300" checked={f.whatsapp_same} onChange={e => set('whatsapp_same', e.target.checked)} />
        <label htmlFor="wa-same" className="text-xs text-stone-600">My WhatsApp is the same as my phone</label>
      </div>
      {!f.whatsapp_same && (
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">WhatsApp number *</label>
          <input type="tel" inputMode="tel" className={inputCls} value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} required={!f.whatsapp_same} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Email <span className="text-stone-400 font-normal">(optional)</span></label>
          <input type="email" className={inputCls} value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">GST <span className="text-stone-400 font-normal">(optional)</span></label>
          <input className={inputCls} value={f.gst_number} onChange={e => set('gst_number', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">Monthly diamond piece volume</label>
        <select className={inputCls} value={f.monthly_volume} onChange={e => set('monthly_volume', e.target.value)}>
          {VOLUME_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">Anything you&rsquo;d like us to know <span className="text-stone-400 font-normal">(optional)</span></label>
        <textarea rows={3} className={inputCls} value={f.note} onChange={e => set('note', e.target.value)} />
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#1E3A5F] text-white px-5 py-3 rounded-xl font-medium hover:bg-[#172d49] disabled:opacity-60">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Sending…' : 'Request a call'}
      </button>
      <p className="text-[11px] text-stone-500 text-center">
        By submitting you agree to receive a WhatsApp / call from a Shewah partner manager. We don&rsquo;t share your details with anyone outside Shewah.
      </p>
    </form>
  )
}
