'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import StoreLayout from '@/components/d2c/StoreLayout'
import { useCart } from '@/components/d2c/CartContext'
import { formatCurrency, type CurrencyCode } from '@/lib/markets'
import { Diamond, ShieldCheck, Clock, Truck, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react'

/* ──────────────────────────────────────────────────────────────────────────
   Multi-Market Bespoke Floor Rates
   ────────────────────────────────────────────────────────────────────────── */
interface BespokeMarketPricing {
  lgdFrom: number
  naturalFrom: number
  lgdFormatted: string
  naturalFormatted: string
  fxRateToInr: number
}

const MARKET_BESPOKE_RATES: Record<string, BespokeMarketPricing> = {
  US: { lgdFrom: 450, naturalFrom: 1450, lgdFormatted: '$450', naturalFormatted: '$1,450', fxRateToInr: 87.0 },
  GB: { lgdFrom: 380, naturalFrom: 1200, lgdFormatted: '£380', naturalFormatted: '£1,200', fxRateToInr: 110.0 },
  EU: { lgdFrom: 420, naturalFrom: 1350, lgdFormatted: '€420', naturalFormatted: '€1,350', fxRateToInr: 94.0 },
  DE: { lgdFrom: 420, naturalFrom: 1350, lgdFormatted: '€420', naturalFormatted: '€1,350', fxRateToInr: 94.0 },
  FR: { lgdFrom: 420, naturalFrom: 1350, lgdFormatted: '€420', naturalFormatted: '€1,350', fxRateToInr: 94.0 },
  AU: { lgdFrom: 680, naturalFrom: 2200, lgdFormatted: 'A$680', naturalFormatted: 'A$2,200', fxRateToInr: 56.0 },
}

const DEFAULT_MARKET_RATE = MARKET_BESPOKE_RATES.US

const WHATSAPP_E164 = '919662266360'
const WHATSAPP_INTRO = 'Hi Shewah Atelier — I would like an indicative price for a bespoke commission.'

const TRUST = [
  { k: 'Certified Stones', v: 'IGI & GIA certified diamonds' },
  { k: 'Hallmarked Gold',  v: 'Independently assay hallmarked' },
  { k: '12-14 Days',       v: 'Atelier design to doorstep' },
  { k: 'Insured Shipping', v: 'Complimentary express delivery' },
]

const PROOF = [
  { n: '12,000+', l: 'Pieces crafted for international jewellers' },
  { n: '180+',    l: 'Artisans and stone setters in our atelier' },
  { n: '100%',    l: 'Certified diamonds & solid gold craftsmanship' },
]

const STEPS = [
  { n: '01', h: 'Submit your brief',    p: 'Share your desired style, diamond parameters, and budget. Simple 2-minute form, no calls needed.' },
  { n: '02', h: '3D CAD render',        p: 'Receive custom photorealistic 3D CAD renders of your design with revisions within 3 days.' },
  { n: '03', h: 'Transparent approval', p: 'Complete itemised breakdown of pure gold weight, labour, and diamond specifications before crafting.' },
  { n: '04', h: 'Insured delivery',     p: 'Individually crafted, hallmarked, and delivered in secure discreet packaging to your doorstep.' },
]

const empty = {
  first_name: '',
  whatsapp: '',
  city: '',
  budget: '',
  occasion: '',
  jewellery_type: 'ring',
  website: '',
}

const CARATS = [
  { label: '0.25 ct', v: 0.25 },
  { label: '0.50 ct', v: 0.5 },
  { label: '0.75 ct', v: 0.75 },
  { label: '1.00 ct', v: 1.0 },
]

const KARATS = [
  { label: '9KT Solid Gold',  v: 9 },
  { label: '14KT Solid Gold', v: 14 },
  { label: '18KT Solid Gold', v: 18 },
]

const SETTINGS = [
  { label: 'Solitaire',   v: 'solitaire' },
  { label: 'Halo',        v: 'halo' },
  { label: 'Three Stone', v: 'three_stone' },
]

interface PriceResult {
  ok: boolean
  lines: { item: string; amount: number }[]
  subtotal: number
  gst: number
  total: number
  gold_rate_24k: number
  note: string
}


function Choice({
  options,
  value,
  onChange,
  label,
}: {
  options: { label: string; v: any }[]
  value: any
  onChange: (v: any) => void
  label: string
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-[10px] uppercase tracking-[0.25em] text-[#8C8275] font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.v === value
          return (
            <button
              key={String(o.v)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.v)}
              className={`border px-4 py-2 text-xs uppercase tracking-wider transition-all rounded-lg font-medium ${
                active
                  ? 'border-[#2A241B] bg-[#2A241B] text-white shadow-sm'
                  : 'border-[#E8DFC9] bg-white text-[#5C5347] hover:border-[#A88A4F] hover:text-[#2A241B]'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function PriceCalculator({ activePricing, currency }: { activePricing: BespokeMarketPricing; currency: CurrencyCode }) {
  const [carat, setCarat] = useState(0.25)
  const [karat, setKarat] = useState(18)
  const [setting, setSetting] = useState('solitaire')
  const [result, setResult] = useState<PriceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/public/ring-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carat, karat, setting, stone: 'lgd' }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok || !j?.ok) {
          setResult(null)
          setError(j?.error || 'Could not price that combination just now.')
          return
        }
        setResult(j)
      })
      .catch(() => { if (!cancelled) setError('Network error. Please try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [carat, karat, setting])

  const fxRate = activePricing.fxRateToInr || 87.0
  const convertAmount = (inrAmount: number) => {
    const localVal = Math.round(inrAmount / fxRate)
    return formatCurrency(localVal, currency)
  }

  const spec = `${CARATS.find((c) => c.v === carat)?.label}, ${karat}KT, ${
    SETTINGS.find((s) => s.v === setting)?.label
  }`
  const waHref = `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(
    `Hi Shewah Atelier — I configured a bespoke ring: ${spec}${
      result ? ` (est. ${convertAmount(result.total)})` : ''
    }. I would like to receive the full itemised quote.`,
  )}`

  return (
    <div className="mt-10 border border-[#E8DFC9] bg-white rounded-2xl p-6 sm:p-10 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#A88A4F]" />
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
          Instant Atelier Estimator
        </p>
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl text-[#2A241B]">
        Configure Your Ring. See Real Atelier Pricing.
      </h3>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="flex flex-col gap-6">
          <Choice label="Centre Diamond Size" options={CARATS} value={carat} onChange={setCarat} />
          <Choice label="Gold Alloy & Purity" options={KARATS} value={karat} onChange={setKarat} />
          <Choice label="Setting Style" options={SETTINGS} value={setting} onChange={setSetting} />
          <p className="max-w-md text-xs leading-relaxed text-[#5C5347]">
            IGI certified lab-grown diamonds, solid gold hand-cast in our workshops. Live pricing calculated server-side according to daily market metal spot rates.
          </p>
        </div>

        <div className="border border-[#E8DFC9] bg-[#FBF7F0] rounded-xl p-6" aria-live="polite" aria-busy={loading}>
          {error ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed text-red-600">{error}</p>
              <a href="#brief" className="text-xs uppercase tracking-wider text-[#2A241B] font-semibold underline underline-offset-4">
                Send a brief instead
              </a>
            </div>
          ) : result ? (
            <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              <dl className="space-y-3">
                {result.lines.map((l) => (
                  <div key={l.item} className="flex items-baseline justify-between gap-4 border-b border-[#E8DFC9]/60 pb-2">
                    <dt className="text-xs text-[#5C5347]">{l.item}</dt>
                    <dd className="font-mono text-xs font-semibold text-[#2A241B] tabular-nums">
                      {convertAmount(l.amount)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 pt-3">
                  <dt className="text-xs uppercase tracking-wider text-[#2A241B] font-semibold">Estimated Total</dt>
                  <dd className="font-serif text-2xl text-[#2A241B] font-medium tabular-nums">
                    {convertAmount(result.total)}
                  </dd>
                </div>
              </dl>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 block w-full bg-[#2A241B] py-3.5 text-center text-xs uppercase tracking-widest text-white rounded-xl transition-all hover:bg-[#A88A4F] font-semibold shadow-sm"
              >
                Inquire on WhatsApp
              </a>
              <p className="mt-3 text-[11px] leading-relaxed text-[#8C8275] text-center">
                Indicative. Final quote locked upon 3D CAD approval.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-xs text-[#8C8275]">
              Calculating atelier estimate&hellip;
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full border border-[#E8DFC9] bg-white px-4 py-3 text-xs text-[#2A241B] rounded-xl outline-none transition-all placeholder:text-stone-400 focus:border-[#A88A4F] focus:ring-1 focus:ring-[#A88A4F]'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8C8275]">
        {label} {required && <span className="text-[#A88A4F]">*</span>}
      </span>
      {children}
    </label>
  )
}

const OCCASIONS = [
  'Engagement Ring',
  'Wedding Band',
  'Anniversary Creation',
  'Milestone Gift',
  'Self-Purchase',
  'Other Bespoke Design',
]

export default function BespokePage() {
  const { market } = useCart()
  const activePricing = MARKET_BESPOKE_RATES[market?.code] || DEFAULT_MARKET_RATE
  const currency = market?.currency || 'USD'

  const [f, setF] = useState(empty)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const budgetOptions = useMemo(() => {
    switch (currency) {
      case 'GBP':
        return [
          { label: 'Up to £1,000', value: '400 - 1000' },
          { label: '£1,000 – £2,500', value: '1000 - 2500' },
          { label: '£2,500 – £6,000', value: '2500 - 6000' },
          { label: '£6,000+', value: '6000+' },
        ]
      case 'EUR':
        return [
          { label: 'Up to €1,200', value: '500 - 1200' },
          { label: '€1,200 – €3,000', value: '1200 - 3000' },
          { label: '€3,000 – €7,000', value: '3000 - 7000' },
          { label: '€7,000+', value: '7000+' },
        ]
      case 'AUD':
        return [
          { label: 'Up to A$1,800', value: '700 - 1800' },
          { label: 'A$1,800 – A$4,500', value: '1800 - 4500' },
          { label: 'A$4,500 – A$10,000', value: '4500 - 10000' },
          { label: 'A$10,000+', value: '10000+' },
        ]
      default:
        return [
          { label: 'Up to $1,500', value: '500 - 1500' },
          { label: '$1,500 – $3,500', value: '1500 - 3500' },
          { label: '$3,500 – $8,000', value: '3500 - 8000' },
          { label: '$8,000+', value: '8000+' },
        ]
    }
  }, [currency])

  const faqs = useMemo(
    () => [
      {
        q: 'What does a bespoke commission actually cost?',
        a: `Solitaire creations start from ${activePricing.lgdFormatted} with IGI-certified lab-grown diamonds in solid 18K gold. Natural mined diamonds with GIA certification start from ${activePricing.naturalFormatted}. Every commission is fully itemised before crafting begins.`,
      },
      {
        q: 'How long does bespoke manufacturing take?',
        a: 'Typically 12 to 14 business days from 3D CAD approval to insured international delivery. If you have an impending proposal or wedding date, please inform us in your brief.',
      },
      {
        q: 'Are the diamonds and precious metals certified?',
        a: 'Yes. All stones 0.30ct and above are accompanied by verifiable digital and physical dossiers from IGI or GIA. Gold alloys are independently assay-hallmarked to guarantee karat purity.',
      },
      {
        q: 'What if I want design modifications after seeing the 3D CAD sketch?',
        a: 'We offer complimentary 3D CAD design iterations within your design window. We never cast the piece until you approve the precise digital render and final itemised quote.',
      },
      {
        q: 'Do I have to attend a mandatory video call?',
        a: 'No. You can conduct your entire commission comfortably over WhatsApp or email with your dedicated jewellery specialist.',
      },
    ],
    [activePricing]
  )

  function set<K extends keyof typeof empty>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }))
    if (error) setError(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (!f.first_name.trim() || !f.whatsapp.trim() || !f.city.trim()) {
      setError('Please fill your name, WhatsApp number, and city.')
      return
    }
    const digits = f.whatsapp.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) {
      setError('Please enter a valid mobile / WhatsApp number.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          source_page: '/bespoke',
          market: market?.code || 'US',
          currency,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok === false) {
        setError(j?.error || `Could not send (${res.status}). Please try again.`)
        return
      }
      const eid = typeof j?.event_id === 'string' ? j.event_id : null
      window.location.href = eid
        ? `/consultation/thank-you?eid=${encodeURIComponent(eid)}`
        : '/consultation/thank-you'
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <StoreLayout>
      <div className="bg-[#FBF7F0] text-[#2A241B] font-sans">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative">
          <div className="relative h-[65vh] min-h-[460px] w-full">
            <Image
              src="/consultation/hero_preview.jpg"
              alt="A bespoke Shewah solitaire ring crafted in our atelier"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-stone-950/60" />
            <div className="absolute inset-0 flex items-center">
              <div className="mx-auto w-full max-w-5xl px-6 sm:px-8">
                <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-[#D4AF37] font-semibold">
                  Atelier Handcrafted · Master Jeweller Provenance
                </p>
                <h1 className="max-w-2xl font-serif text-4xl leading-[1.1] text-white sm:text-6xl font-light">
                  Your Bespoke Design, <br />
                  Crafted from {activePricing.lgdFormatted}.
                </h1>
                <p className="mt-5 max-w-xl text-xs sm:text-sm leading-relaxed text-white/80 font-light">
                  Certified diamonds, solid 18K gold alloys, and an itemised transparent quote before crafting begins. Real atelier prices without booking a high-pressure sales call.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href="#brief"
                    className="inline-block bg-[#D4AF37] px-8 py-3.5 text-xs uppercase tracking-widest text-[#2A241B] font-semibold rounded-full transition-all hover:bg-white shadow-lg"
                  >
                    Send Your Brief →
                  </a>
                  <a
                    href="#calculator"
                    className="inline-block border border-white/40 px-8 py-3.5 text-xs uppercase tracking-widest text-white font-semibold rounded-full transition-all hover:bg-white/10"
                  >
                    Estimate Cost
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Strip ────────────────────────────────────────────── */}
        <section className="border-b border-[#E8DFC9] bg-white">
          <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E8DFC9]">
            {TRUST.map((t) => (
              <div key={t.k} className="p-6 text-center space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-[#2A241B]">{t.k}</p>
                <p className="text-[11px] text-[#5C5347] font-light">{t.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Transparent Pricing Overview ───────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <div className="text-center space-y-3 mb-12">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
              Transparent Economics
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B]">
              Atelier Direct Pricing, Before The Conversation.
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto leading-relaxed font-light">
              Every commission is broken down into pure metal weight, certified diamond cost, and master artisan labour. Zero distributor markups.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-8 shadow-sm space-y-4">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                Option 1 · Conscious Luxury
              </span>
              <h3 className="font-serif text-2xl text-[#2A241B]">Lab-Grown Diamonds</h3>
              <p className="font-serif text-4xl text-[#2A241B] font-light">
                <span className="text-sm font-sans text-[#8C8275]">from </span>
                {activePricing.lgdFormatted}
              </p>
              <p className="text-xs text-[#5C5347] leading-relaxed font-light">
                Handcrafted in solid 18K gold with 0.25ct+ IGI-certified lab-grown diamonds. Perfect optical and chemical equivalence.
              </p>
            </div>

            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-8 shadow-sm space-y-4">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#A88A4F] font-semibold">
                Option 2 · Rare Heritage
              </span>
              <h3 className="font-serif text-2xl text-[#2A241B]">Natural Mined Diamonds</h3>
              <p className="font-serif text-4xl text-[#2A241B] font-light">
                <span className="text-sm font-sans text-[#8C8275]">from </span>
                {activePricing.naturalFormatted}
              </p>
              <p className="text-xs text-[#5C5347] leading-relaxed font-light">
                Handcrafted in solid 18K gold with ethically sourced GIA-certified mined diamonds with full Kimberley Process provenance.
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 border-t border-[#E8DFC9] text-center">
            {PROOF.map((p) => (
              <div key={p.l} className="space-y-1">
                <p className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-light">{p.n}</p>
                <p className="text-[11px] uppercase tracking-wider text-[#8C8275]">{p.l}</p>
              </div>
            ))}
          </div>

          {/* ── Interactive Calculator Anchor ── */}
          <div id="calculator" className="pt-12 scroll-mt-24">
            <PriceCalculator activePricing={activePricing} currency={currency} />
          </div>
        </section>

        {/* ── How Bespoke Works ──────────────────────────────────────── */}
        <section className="bg-white border-y border-[#E8DFC9] py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center space-y-3 mb-16">
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
                The Journey
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B]">
                Four Steps From Idea to Heirloom
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((s) => (
                <div key={s.n} className="space-y-3">
                  <span className="font-serif text-3xl text-[#A88A4F] font-light">{s.n}</span>
                  <h4 className="font-serif text-lg text-[#2A241B]">{s.h}</h4>
                  <p className="text-xs text-[#5C5347] leading-relaxed font-light">{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Brief Submission Form ──────────────────────────────────── */}
        <section id="brief" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 items-start">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
                  Private Consultation
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#2A241B] mt-2">
                  Send Your Design Brief
                </h2>
                <p className="mt-4 text-xs sm:text-sm text-[#5C5347] leading-relaxed font-light">
                  Tell us what you envision. Our atelier will reply with an indicative price estimate and 3D CAD preview within one business day.
                </p>
              </div>

              <div className="bg-white border border-[#E8DFC9] rounded-2xl p-6 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[#2A241B] font-semibold">
                  Prefer direct messaging?
                </p>
                <p className="text-xs text-[#5C5347]">
                  Chat live with our diamond gemologists on WhatsApp with your reference photos.
                </p>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(WHATSAPP_INTRO)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-semibold text-[#A88A4F] underline hover:text-[#2A241B]"
                  >
                    Open WhatsApp Concierge →
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E8DFC9] rounded-2xl p-8 shadow-sm">
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                {/* Honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={f.website}
                  onChange={(e) => set('website', e.target.value)}
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />

                <Field label="Your Full Name" required>
                  <input
                    type="text"
                    value={f.first_name}
                    onChange={(e) => set('first_name', e.target.value)}
                    placeholder="e.g. Catherine Howard"
                    className={inputCls}
                    autoComplete="given-name"
                  />
                </Field>

                <Field label="Phone / WhatsApp (with country code)" required>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={f.whatsapp}
                    onChange={(e) => set('whatsapp', e.target.value)}
                    placeholder="e.g. +1 (555) 234-5678"
                    className={inputCls}
                    autoComplete="tel"
                  />
                </Field>

                <Field label="City & Country" required>
                  <input
                    type="text"
                    value={f.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="e.g. New York, USA"
                    className={inputCls}
                    autoComplete="address-level2"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Estimated Budget">
                    <select value={f.budget} onChange={(e) => set('budget', e.target.value)} className={inputCls}>
                      <option value="">Flexible / Undecided</option>
                      {budgetOptions.map((b) => (
                        <option key={b.value} value={b.value}>{b.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Creation Type">
                    <select value={f.occasion} onChange={(e) => set('occasion', e.target.value)} className={inputCls}>
                      <option value="">Select type</option>
                      {OCCASIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {error && (
                  <p role="alert" className="border border-red-200 bg-red-50 p-3 rounded-lg text-xs text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#2A241B] py-3.5 text-xs uppercase tracking-widest text-white rounded-xl transition-all hover:bg-[#A88A4F] font-semibold disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Submitting Brief…' : 'Submit Bespoke Brief →'}
                </button>
                <p className="text-[11px] leading-relaxed text-[#8C8275] text-center">
                  Confidential. Direct atelier communication with zero spam.
                </p>
              </form>
            </div>
          </div>
        </section>

        {/* ── FAQ Accordions ─────────────────────────────────────────── */}
        <section className="bg-white border-t border-[#E8DFC9] py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-6">
            <div className="text-center space-y-3 mb-12">
              <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
                Client Inquiries
              </span>
              <h2 className="font-serif text-3xl text-[#2A241B]">
                Bespoke Atelier FAQ
              </h2>
            </div>

            <div className="divide-y divide-[#E8DFC9] border-y border-[#E8DFC9]">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx
                return (
                  <div key={idx} className="py-5">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="font-serif text-base text-[#2A241B] font-medium pr-4">
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#A88A4F] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#8C8275] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#5C5347] font-light">
                        {faq.a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  )
}
