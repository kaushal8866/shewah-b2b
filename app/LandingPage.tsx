'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import { Diamond, Check, ArrowRight, ChevronDown, MessageCircle } from 'lucide-react'
import {
  BRAND, HERO, STATS, VALUE_PROPS, HOW_IT_WORKS, FAQ, TESTIMONIALS,
} from '@/lib/landingCopy'
import LeadForm from './LeadForm'

export default function LandingPage({ whatsappE164 }: { whatsappE164?: string }) {
  // Operator-editable override flows in from `app/page.tsx` (Settings →
  // Marketing landing page). Falls back to the build-time default.
  const wa = (whatsappE164 || BRAND.whatsappE164).replace(/\D/g, '')
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const gaId    = process.env.NEXT_PUBLIC_GA_ID
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Meta Pixel page-view (after init via the Script tag below)
    try { (window as any).fbq && (window as any).fbq('track', 'PageView') } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-white text-stone-900">
      {/* Analytics */}
      {pixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img height="1" width="1" style={{ display: 'none' }}
              alt="" src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
          </noscript>
        </>
      )}
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}

      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="font-semibold text-[15px]">{BRAND.name}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">B2B jewellery partner</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-stone-600">
            <a href="#what-you-get" className="hover:text-stone-900">What you get</a>
            <a href="#how-it-works" className="hover:text-stone-900">How it works</a>
            <a href="#faq" className="hover:text-stone-900">FAQ</a>
            <Link href="/login" className="hover:text-stone-900">Partner sign in</Link>
          </nav>
          <a href="#signup"
            className="inline-flex items-center gap-1.5 bg-[#1E3A5F] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#172d49]">
            Become a partner <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F1EA] via-white to-white" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-5 pt-12 pb-16 md:pt-20 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-4">{HERO.eyebrow}</p>
            <h1 className="text-3xl md:text-5xl font-serif leading-[1.08] text-stone-900">{HERO.headline}</h1>
            <p className="mt-5 text-base md:text-lg text-stone-600 leading-relaxed">{HERO.subhead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#signup"
                className="inline-flex items-center gap-1.5 bg-[#1E3A5F] text-white px-5 py-3 rounded-xl font-medium hover:bg-[#172d49]">
                {HERO.primaryCta} <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#how-it-works"
                className="inline-flex items-center gap-1.5 bg-white text-stone-900 px-5 py-3 rounded-xl font-medium border border-stone-200 hover:border-stone-300">
                {HERO.secondaryCta}
              </a>
            </div>
            <p className="mt-4 text-xs text-stone-500">{HERO.trustLine}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_-20px_rgba(30,58,95,0.25)] border border-stone-100 p-6 md:p-7">
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Tell us about your store</p>
            <p className="mt-1 text-sm text-stone-600">A partner manager will reach out within one business day.</p>
            <div id="signup" className="mt-5">
              <LeadForm compact whatsappE164={wa} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────── */}
      <section className="bg-[#1E3A5F] text-white">
        <div className="max-w-6xl mx-auto px-5 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-2xl md:text-3xl font-serif">{s.value}</p>
              <p className="text-xs md:text-sm text-white/70 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Value props ───────────────────────────────────── */}
      <section id="what-you-get" className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">What you get</p>
          <h2 className="text-2xl md:text-4xl font-serif leading-tight">A complete back-office for the diamond side of your store.</h2>
          <p className="mt-4 text-stone-600">No new software to learn. No setup fee. No exclusivity. Just the catalog, the tooling and the team you wish your existing manufacturer had.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {VALUE_PROPS.map(v => (
            <div key={v.title} className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
              <div className="w-9 h-9 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center mb-4">
                <Check className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-lg leading-snug">{v.title}</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how-it-works" className="bg-stone-50">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">How it works</p>
            <h2 className="text-2xl md:text-4xl font-serif leading-tight">From hello to your first order in a week.</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className="relative">
                <p className="text-[#1E3A5F]/30 font-serif text-3xl">{s.step}</p>
                <h3 className="mt-2 font-semibold text-base">{s.title}</h3>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{s.body}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-4 -right-3 text-stone-300">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIALS.map(t => (
            <figure key={t.quote} className="bg-white rounded-2xl p-7 border border-stone-100">
              <blockquote className="text-stone-800 text-lg font-serif leading-snug">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm text-stone-500">{t.name} · {t.location}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="bg-stone-50">
        <div className="max-w-3xl mx-auto px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">FAQ</p>
            <h2 className="text-2xl md:text-4xl font-serif leading-tight">Questions retailers usually ask first.</h2>
          </div>
          <div className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
            {FAQ.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={f.q}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full text-left py-5 flex items-start justify-between gap-4">
                    <span className="font-medium text-stone-900">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 text-stone-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <p className="pb-5 text-sm text-stone-600 leading-relaxed">{f.a}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="bg-[#1E3A5F] text-white">
        <div className="max-w-4xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-4xl font-serif leading-tight">Ready to add the Shewah catalog to your store?</h2>
          <p className="mt-4 text-white/70">Tell us a bit about your store — we&rsquo;ll WhatsApp you within one business day.</p>
          <a href="#signup"
            className="mt-7 inline-flex items-center gap-1.5 bg-white text-[#1E3A5F] px-6 py-3 rounded-xl font-medium hover:bg-stone-100">
            {HERO.primaryCta} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400">
        <div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
                <Diamond className="w-4 h-4 text-white" />
              </div>
              <p className="text-white font-semibold">{BRAND.name}</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed">B2B diamond jewellery wholesale and manufacturing partner for Indian retailers.</p>
          </div>
          <div>
            <p className="text-white text-xs uppercase tracking-wider font-semibold mb-3">Get in touch</p>
            <p>{BRAND.contactEmail}</p>
            <p className="mt-1">WhatsApp: +{wa.slice(0,2)} {wa.slice(2,7)} {wa.slice(7)}</p>
          </div>
          <div>
            <p className="text-white text-xs uppercase tracking-wider font-semibold mb-3">Already a partner?</p>
            <Link href="/login" className="hover:text-white">Sign in to your portal →</Link>
          </div>
        </div>
        <div className="border-t border-stone-800">
          <p className="max-w-6xl mx-auto px-5 py-4 text-xs">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
        </div>
      </footer>

      {/* Floating WhatsApp CTA */}
      <a
        href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi Shewah, I run a jewellery store and would like to learn more about partnering.')}`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 bg-[#25D366] text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-medium hover:bg-[#1da851]">
        <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
      </a>
    </div>
  )
}
