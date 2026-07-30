'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'

/* ──────────────────────────────────────────────────────────────────────────
   Pricing. The entry price (₹15,000) is confirmed; the two higher tiers are
   derived from it and should be checked against real quotes before launch.

   This is the most important content on the page. The Meta account spent ₹912
   across ~5,600 engagements and produced zero conversations, running ads that
   said "Chat With Us For Pricing" — i.e. they refused to answer the first
   question an engagement-ring buyer asks. Publishing the floor price is what
   turns that traffic into enquiries.
   ────────────────────────────────────────────────────────────────────────── */
const PRICING = {
  from: '₹15,000',
  tiers: [
    { label: 'Solitaire rings',  from: '₹15,000', note: 'Lab-grown stone, 14K/18K gold' },
    { label: 'Natural diamond',  from: '₹45,000', note: 'IGI / GIA certified stone' },
    { label: 'Full bespoke set', from: '₹75,000', note: 'Ring + matched band' },
  ],
}

const WHATSAPP_E164 = '919662266360'
const WHATSAPP_INTRO = 'Hi Shewah — I would like a price for a bespoke piece.'

const TRUST = [
  { k: 'IGI & GIA', v: 'Certified stones' },
  { k: 'BIS 916',   v: 'Hallmarked gold' },
  { k: 'Unlimited', v: 'CAD revisions' },
  { k: 'Insured',   v: 'Doorstep delivery' },
]

const STEPS = [
  { n: '01', h: 'Tell us the brief',  p: 'Budget, stone, timeline. Two minutes, no call required.' },
  { n: '02', h: 'See a CAD sketch',   p: 'Your design rendered in 3D, with the full price broken down. Revise it as many times as you like.' },
  { n: '03', h: 'Approve the quote',  p: 'Gold weight, labour and stone cost itemised. Nothing starts until you say yes.' },
  { n: '04', h: 'Hand-made in 40 days', p: 'Crafted by our karigars, certified, and delivered insured to your door.' },
]

const FAQ = [
  {
    q: 'What does a bespoke ring actually cost?',
    a: `Solitaire rings start at ${PRICING.tiers[0].from} with a lab-grown stone in 14K or 18K gold. Natural certified diamonds start at ${PRICING.tiers[1].from}. You get an itemised quote — stone, gold weight, labour — before anything is made.`,
  },
  {
    q: 'How long does it take?',
    a: 'Around 40 days from approved design to delivery. If you have a fixed date, tell us in the form and we will confirm whether it is possible before you commit.',
  },
  {
    q: 'Are the diamonds certified?',
    a: 'Yes — IGI or GIA certified, and the certificate ships with the piece. Gold is BIS 916 hallmarked.',
  },
  {
    q: 'What if I do not like the design?',
    a: 'CAD revisions are unlimited and free. Nothing goes into production until you approve the render and the price.',
  },
  {
    q: 'Do I have to talk to someone to get a price?',
    a: 'No. Send the brief and we will reply on WhatsApp with an indicative price. A call only happens if you want one.',
  },
]

// Values must stay in the "min - max" / "min+" shape that mapBudget() in
// app/api/public/consultation/route.ts parses.
const BUDGETS = [
  { label: '₹15,000 – ₹40,000',     value: '15000 - 40000' },
  { label: '₹40,000 – ₹75,000',     value: '40000 - 75000' },
  { label: '₹75,000 – ₹1,50,000',   value: '75000 - 150000' },
  { label: '₹1,50,000+',            value: '150000+' },
]

const OCCASIONS = ['engagement', 'wedding', 'anniversary', 'gift', 'self', 'other']

const empty = {
  first_name: '', whatsapp: '', city: '',
  budget: '', occasion: '', jewellery_type: 'ring',
  website: '', // honeypot
}

export default function BespokePage() {
  const [f, setF] = useState(empty)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
        body: JSON.stringify(f),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok === false) {
        setError(j?.error || `Could not send (${res.status}). Please try again.`)
        return
      }
      // The Meta `Lead` event fires on /consultation/thank-you, not here — see
      // app/LeadForm.tsx for why firing it before a hard navigation is unsafe.
      window.location.href = '/consultation/thank-you'
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-stone-900 font-sans">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="font-serif text-xl tracking-[0.25em] text-stone-900">SHEWAH</span>
          <a
            href="#brief"
            className="border border-stone-900 px-4 py-2 text-[10px] uppercase tracking-cta text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
          >
            Get a price
          </a>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative h-[62vh] min-h-[420px] w-full">
          <Image
            src="/consultation/hero_preview.jpg"
            alt="A bespoke Shewah solitaire ring held in the hand"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-stone-950/55" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-5xl px-5">
              <p className="mb-4 text-[10px] uppercase tracking-eyebrow text-accent-soft">
                Bespoke engagement rings · Made in India
              </p>
              <h1 className="max-w-2xl font-serif text-4xl leading-[1.1] text-white sm:text-6xl">
                Your design, made to order — from {PRICING.from}.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                Certified diamonds, hallmarked gold, an itemised quote before anything is
                made. See real prices without booking a call.
              </p>
              <a
                href="#brief"
                className="mt-8 inline-block bg-accent px-8 py-4 text-[11px] uppercase tracking-cta text-stone-950 transition-colors hover:bg-accent-soft"
              >
                Send your brief →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip — moved above the fold-adjacent area, not buried ── */}
      <section className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-4">
          {TRUST.map((t, i) => (
            <div
              key={t.k}
              className={`px-5 py-5 ${i > 0 ? 'border-l border-stone-200' : ''} ${i < 2 ? 'border-b border-stone-200 sm:border-b-0' : ''}`}
            >
              <p className="text-[11px] uppercase tracking-micro text-stone-900">{t.k}</p>
              <p className="mt-1 text-[11px] text-stone-500">{t.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing — the single biggest fix vs the old page ────────── */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <p className="text-[10px] uppercase tracking-eyebrow text-stone-400">What it costs</p>
        <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight text-stone-900 sm:text-4xl">
          Prices, before the conversation.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-600">
          Every quote is itemised — stone, gold weight, labour — so you can see exactly
          what you are paying for.
        </p>

        <div className="mt-10 grid gap-px border border-stone-200 bg-stone-200 sm:grid-cols-3">
          {PRICING.tiers.map((t) => (
            <div key={t.label} className="bg-white px-6 py-8">
              <p className="text-[11px] uppercase tracking-micro text-stone-500">{t.label}</p>
              <p className="mt-3 font-serif text-3xl text-stone-900">
                <span className="text-sm text-stone-400">from </span>
                {t.from}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-stone-500">{t.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Process ────────────────────────────────────────────────── */}
      <section className="border-y border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <p className="text-[10px] uppercase tracking-eyebrow text-stone-400">How it works</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-900 sm:text-4xl">
            Four steps, forty days.
          </h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-stone-300 pt-5">
                <p className="font-mono text-[11px] tracking-micro text-accent">{s.n}</p>
                <h3 className="mt-3 font-serif text-xl text-stone-900">{s.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The brief form — 4 fields, one screen, no 5-step quiz ───── */}
      <section id="brief" className="mx-auto max-w-5xl scroll-mt-4 px-5 py-16 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-eyebrow text-stone-400">Send your brief</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-900 sm:text-4xl">
              Get an indicative price on WhatsApp.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">
              Four fields. We reply with a price range and a starting sketch — no call
              unless you want one.
            </p>
            <div className="mt-8 border-t border-stone-200 pt-6">
              <p className="text-[11px] uppercase tracking-micro text-stone-500">
                Prefer to message directly?
              </p>
              <a
                href={`https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(WHATSAPP_INTRO)}`}
                className="mt-2 inline-block border-b border-stone-900 pb-0.5 text-sm text-stone-900 transition-colors hover:border-accent hover:text-accent"
              >
                Open WhatsApp instead
              </a>
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {/* honeypot */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={f.website} onChange={(e) => set('website', e.target.value)}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            <Field label="Your name" required>
              <input
                type="text" value={f.first_name} onChange={(e) => set('first_name', e.target.value)}
                className={inputCls} autoComplete="given-name"
              />
            </Field>

            <Field label="WhatsApp number" required>
              <input
                type="tel" inputMode="tel" value={f.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="10-digit mobile" className={inputCls} autoComplete="tel"
              />
            </Field>

            <Field label="City" required>
              <input
                type="text" value={f.city} onChange={(e) => set('city', e.target.value)}
                className={inputCls} autoComplete="address-level2"
              />
            </Field>

            <Field label="Budget">
              <select value={f.budget} onChange={(e) => set('budget', e.target.value)} className={inputCls}>
                <option value="">Not sure yet</option>
                {BUDGETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Occasion">
              <select value={f.occasion} onChange={(e) => set('occasion', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
            </Field>

            {/* `red` is the system alias for the oxblood ramp (see tailwind.config.ts).
                `oxblood-*` is not an exported color key and emits no CSS. */}
            {error && (
              <p role="alert" className="border border-red-200 bg-stone-50 px-4 py-3 text-[13px] text-status-danger-fg">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full bg-stone-900 px-8 py-4 text-[11px] uppercase tracking-cta text-white transition-colors hover:bg-accent hover:text-stone-950 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send brief →'}
            </button>
            <p className="text-[11px] leading-relaxed text-stone-400">
              We reply on WhatsApp within one business day. We never share your details.
            </p>
          </form>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          <p className="text-[10px] uppercase tracking-eyebrow text-stone-400">Questions</p>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-900 sm:text-4xl">
            The things people ask first.
          </h2>
          <div className="mt-10 border-t border-stone-300">
            {FAQ.map((item, i) => (
              <div key={item.q} className="border-b border-stone-300">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="flex w-full items-start justify-between gap-6 py-5 text-left"
                >
                  <span className="text-sm text-stone-900">{item.q}</span>
                  <span className="mt-0.5 font-mono text-xs text-stone-400">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <p className="pb-6 pr-10 text-sm leading-relaxed text-stone-600">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-[10px] uppercase tracking-micro text-stone-400">
            © 2026 Shewah · Private jewellery atelier
          </p>
        </div>
      </footer>
    </main>
  )
}

const inputCls =
  'w-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-micro text-stone-500">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </label>
  )
}
