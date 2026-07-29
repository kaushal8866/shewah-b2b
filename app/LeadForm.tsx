'use client'

import { useState, FormEvent } from 'react'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { VOLUME_OPTIONS, BRAND } from '@/lib/landingCopy'
import { LANDING_VARIANT_COOKIE, isLandingVariant } from '@/lib/landingVariant'

type FormState = {
  /* Step 1 — the only required fields */
  full_name: string
  whatsapp: string
  city: string
  /* Step 2 — optional, captured when the user is willing */
  store_name: string
  phone: string
  /* Mirror checkbox so users don't have to enter their phone twice */
  phone_same_as_whatsapp: boolean
  email: string
  gst_number: string
  monthly_volume: string
  note: string
  /* Bot honeypot — real users never fill this */
  website: string
}

const empty: FormState = {
  full_name: '', whatsapp: '', city: '',
  store_name: '', phone: '', phone_same_as_whatsapp: true,
  email: '', gst_number: '', monthly_volume: '', note: '',
  website: '',
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

// Task 102 — read the A/B test cookie set by middleware and forward it
// with the signup payload so we can attribute conversions per variant.
function readLandingVariant(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find(c => c.startsWith(`${LANDING_VARIANT_COOKIE}=`))
  if (!match) return null
  const v = decodeURIComponent(match.split('=')[1] || '')
  return isLandingVariant(v) ? v : null
}

const validIndianMobile = (raw: string): boolean => {
  const d10 = raw.replace(/\D/g, '').replace(/^(0|91)/, '')
  return d10.length === 10 && /^[6-9]/.test(d10)
}

export default function LeadForm({
  compact = false,
  multiStep = false,
  whatsappE164,
}: {
  compact?: boolean
  multiStep?: boolean
  whatsappE164?: string
}) {
  const wa = (whatsappE164 || BRAND.whatsappE164).replace(/\D/g, '')
  const [f, setF] = useState<FormState>(empty)
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF(prev => ({ ...prev, [k]: v }))
  }

  function validateStep1(): string | null {
    if (!f.full_name.trim() || !f.whatsapp.trim() || !f.city.trim()) {
      return 'Please fill your name, WhatsApp number and city.'
    }
    if (!validIndianMobile(f.whatsapp)) {
      return 'Please enter a valid 10-digit Indian WhatsApp number.'
    }
    return null
  }

  function validateStep2(): string | null {
    if (!f.phone_same_as_whatsapp && f.phone.trim() && !validIndianMobile(f.phone)) {
      return 'Please enter a valid 10-digit phone number, or check "same as WhatsApp".'
    }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      return 'That email address doesn\u2019t look right.'
    }
    return null
  }

  async function submit() {
    setSubmitting(true)
    try {
      const phone = f.phone_same_as_whatsapp || !f.phone.trim() ? f.whatsapp : f.phone
      const payload = {
        ...f,
        phone,
        ...readUtm(),
        landing_variant: readLandingVariant(),
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
      try { (window as any).gtag && (window as any).gtag('event', 'conversion', { send_to: 'AW-18068366696/1IaCCIqgn9UcEOjKladD', value: 1.0, currency: 'INR' }) } catch {}
      try {
        if ((window as any).pintrk) {
          (window as any).pintrk('track', 'lead', {
            event_id: `lead_${Date.now()}`,
            lead_type: f.business_type || 'Custom Ring',
            em: f.email ? f.email.trim().toLowerCase() : undefined,
          })
        }
      } catch {}
      setDone(true)
      setF(empty)
      setStep(1)
      if (typeof window !== 'undefined') {
        window.location.href = '/consultation/thank-you'
      }
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const err1 = validateStep1()
    if (err1) { setError(err1); if (multiStep) setStep(1); return }

    if (multiStep && step === 1) {
      setStep(2)
      return
    }
    const err2 = validateStep2()
    if (err2) { setError(err2); return }
    await submit()
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Thanks — we&rsquo;ve got it.</p>
            <p className="mt-1 text-sm text-emerald-800">
              Your assigned partner manager will reach out on WhatsApp within one business day. Save this number to your contacts so it doesn&rsquo;t go to spam: <span className="font-medium">{`+${wa.slice(0,2)} ${wa.slice(2,7)} ${wa.slice(7)}`}</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:border-stone-800 focus:ring-2 focus:ring-stone-800/15 bg-white'

  const honeypot = (
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
  )

  const stepIndicator = multiStep ? (
    <div className="flex items-center gap-2 text-xs text-stone-500">
      <span className={step === 1 ? 'font-semibold text-stone-800' : ''}>Step 1 · Quick intro</span>
      <span className="text-stone-300">›</span>
      <span className={step === 2 ? 'font-semibold text-stone-800' : ''}>Step 2 · A few optional details</span>
    </div>
  ) : null

  const renderStep1 = (
    <>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">Your name *</label>
        <input className={inputCls} value={f.full_name} onChange={e => set('full_name', e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">WhatsApp number *</label>
        <input
          type="tel"
          inputMode="tel"
          className={inputCls}
          value={f.whatsapp}
          onChange={e => set('whatsapp', e.target.value)}
          placeholder="10-digit Indian mobile"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">City *</label>
        <input className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} required />
      </div>
    </>
  )

  const renderStep2 = (
    <>
      <p className="text-xs text-stone-500">
        These help us prep your call. All optional — skip anything you&rsquo;d rather share over WhatsApp.
      </p>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">Store name <span className="text-stone-400 font-normal">(optional)</span></label>
        <input className={inputCls} value={f.store_name} onChange={e => set('store_name', e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="phone-same"
          type="checkbox"
          className="rounded border-stone-300"
          checked={f.phone_same_as_whatsapp}
          onChange={e => set('phone_same_as_whatsapp', e.target.checked)}
        />
        <label htmlFor="phone-same" className="text-xs text-stone-600">My phone is the same as my WhatsApp</label>
      </div>
      {!f.phone_same_as_whatsapp && (
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Phone <span className="text-stone-400 font-normal">(optional)</span></label>
          <input type="tel" inputMode="tel" className={inputCls} value={f.phone} onChange={e => set('phone', e.target.value)} />
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
        <label className="block text-xs font-medium text-stone-700 mb-1">Monthly diamond piece volume <span className="text-stone-400 font-normal">(optional)</span></label>
        <select className={inputCls} value={f.monthly_volume} onChange={e => set('monthly_volume', e.target.value)}>
          {VOLUME_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1">Anything you&rsquo;d like us to know <span className="text-stone-400 font-normal">(optional)</span></label>
        <textarea rows={3} className={inputCls} value={f.note} onChange={e => set('note', e.target.value)} />
      </div>
    </>
  )

  const showStep2 = multiStep && step === 2

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? 'space-y-3' : 'space-y-4'}>
      {honeypot}
      {stepIndicator}
      {showStep2 ? renderStep2 : renderStep1}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800">
          {error}
        </div>
      )}

      {multiStep && step === 2 ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => { setError(null); setStep(1) }}
            className="sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-stone-700 border border-stone-200 px-4 py-3 rounded-xl font-medium hover:bg-stone-50">
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-stone-800 text-white px-5 py-3 rounded-xl font-medium hover:bg-stone-900 disabled:opacity-60">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Sending…' : 'Send my details'}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-stone-800 text-white px-5 py-3 rounded-xl font-medium hover:bg-stone-900 disabled:opacity-60">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting
            ? 'Sending…'
            : multiStep
              ? (<>Continue <ArrowRight className="w-4 h-4" /></>)
              : 'Request a call'}
        </button>
      )}

      <p className="text-[11px] text-stone-500 text-center">
        By submitting you agree to receive a WhatsApp / call from a Shewah partner manager. We don&rsquo;t share your details with anyone outside Shewah.
      </p>
    </form>
  )
}
