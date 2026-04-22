'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import {
  Diamond, ChevronDown, MessageCircle, ShieldCheck, ArrowRight, Menu, X,
} from 'lucide-react'
import {
  BRAND, HERO, STATS, VALUE_PROPS, HOW_IT_WORKS, FAQ, TESTIMONIALS,
  FOUNDER, PARTNER_LOGOS, PARTNER_BAND,
  NAV, FORM_PANEL, SECTIONS, FINAL_CTA, FOOTER, MOBILE_BAR,
  WHATSAPP_INTRO_MESSAGE,
} from '@/lib/landingCopy'
import LeadForm from './LeadForm'

export default function LandingPage({ whatsappE164 }: { whatsappE164?: string }) {
  // Operator-editable override flows in from `app/page.tsx` (Settings →
  // Marketing landing page). Falls back to the build-time default.
  const wa = (whatsappE164 || BRAND.whatsappE164).replace(/\D/g, '')
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const gaId    = process.env.NEXT_PUBLIC_GA_ID
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const original = document.body.style.overflow
    if (mobileMenuOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileMenuOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const waChatHref = `https://wa.me/${wa}?text=${encodeURIComponent(WHATSAPP_INTRO_MESSAGE)}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { (window as any).fbq && (window as any).fbq('track', 'PageView') } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 selection:bg-[#1E3A5F] selection:text-white pb-24 md:pb-0">
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

      {/* ── Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#1E3A5F] flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">{BRAND.name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {NAV.links.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[#1E3A5F] transition-colors">{l.label}</a>
            ))}
            <Link href="/login" className="hover:text-[#1E3A5F] transition-colors">{NAV.partnerSignIn}</Link>
            <a
              href={waChatHref}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#1E3A5F] bg-[#1E3A5F]/10 px-4 py-2 rounded-full hover:bg-[#1E3A5F]/20 transition-colors">
              <MessageCircle className="w-4 h-4" />
              {NAV.whatsappCta}
            </a>
          </nav>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-40">
            <div
              className="absolute inset-0 bg-slate-900/40"
              aria-hidden
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              id="mobile-menu"
              className="absolute top-0 left-0 right-0 bg-white border-b border-slate-200 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom) + 5rem)' }}
            >
              <nav className="px-6 py-4 flex flex-col">
                {NAV.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-3 text-base font-medium text-slate-700 hover:text-[#1E3A5F] border-b border-slate-100"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-base font-medium text-slate-700 hover:text-[#1E3A5F] border-b border-slate-100"
                >
                  {NAV.partnerSignIn}
                </Link>
                <a
                  href={waChatHref}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-4 inline-flex items-center justify-center gap-2 text-[#1E3A5F] bg-[#1E3A5F]/10 px-4 py-3 rounded-full font-medium hover:bg-[#1E3A5F]/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {NAV.whatsappCta}
                </a>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-10 pb-12 md:pt-20 md:pb-24 px-5 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-white to-white -z-10" aria-hidden />
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_420px] gap-8 md:gap-12 lg:gap-16 items-start">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#1E3A5F] text-[11px] sm:text-xs font-semibold uppercase tracking-widest mb-5 md:mb-7">
              <ShieldCheck className="w-4 h-4" />
              {HERO.eyebrow}
            </div>

            <h1 className="text-[2rem] sm:text-4xl md:text-5xl lg:text-[60px] font-serif leading-[1.1] text-slate-900 mb-4 md:mb-6 tracking-tight">
              {HERO.headline}
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">
              {HERO.subhead}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 sm:gap-6 border-y border-slate-200 py-6 md:py-8 mt-8 md:mt-10">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col min-w-0">
                  <span className="text-xl sm:text-2xl md:text-3xl font-serif text-[#1E3A5F] mb-1 whitespace-nowrap">{s.value}</span>
                  <span className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider leading-tight">{s.label}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 md:mt-6 text-sm text-slate-500">{HERO.trustLine}</p>
          </div>

          {/* Lead form (preserves existing LeadForm behaviour) */}
          <div id="signup" className="bg-white p-6 sm:p-7 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 relative scroll-mt-20">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#1E3A5F] rounded-t-2xl" aria-hidden />
            <h2 className="text-2xl font-serif font-medium mb-2">{FORM_PANEL.title}</h2>
            <p className="text-slate-500 text-sm mb-6">{FORM_PANEL.subtitle}</p>
            <LeadForm compact whatsappE164={wa} />
          </div>
        </div>
      </section>

      {/* ── What you get ──────────────────────────────────── */}
      <section id="what-you-get" className="py-20 md:py-24 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">{SECTIONS.whatYouGet.eyebrow}</p>
            <h2 className="text-3xl md:text-4xl font-serif leading-tight">{SECTIONS.whatYouGet.heading}</h2>
            <p className="mt-4 text-lg text-slate-600">{SECTIONS.whatYouGet.body}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="bg-white p-7 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                {v.metric && (
                  <div className="text-xs font-bold text-[#1E3A5F] uppercase tracking-widest mb-4 pb-4 border-b border-slate-100">
                    {v.metric}
                  </div>
                )}
                <h3 className="text-lg font-serif font-medium leading-snug mb-3">{v.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed flex-grow">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">{SECTIONS.howItWorks.eyebrow}</p>
            <h2 className="text-3xl md:text-4xl font-serif leading-tight">{SECTIONS.howItWorks.heading}</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className="relative">
                <div className="text-4xl font-serif text-slate-200 mb-4">{s.step}</div>
                <h3 className="text-lg font-medium mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{s.body}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-2 right-0 w-5 h-5 text-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ──────────────────────────────────── */}
      {/* Hidden entirely until at least one real, consented testimonial has
          been added to TESTIMONIALS in lib/landingCopy.ts. */}
      {TESTIMONIALS.length > 0 && (
        <section className="py-20 md:py-24 px-6 bg-[#1E3A5F] text-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif mb-12 text-center text-white">{SECTIONS.socialProof.heading}</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {TESTIMONIALS.map((t) => {
                const initials = t.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'SP'
                return (
                  <figure key={t.quote} className="bg-white/10 p-8 rounded-xl backdrop-blur-sm border border-white/20">
                    <blockquote className="text-lg md:text-xl font-serif italic text-white/90 leading-snug">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-4">
                      {t.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.photoUrl}
                          alt={`${t.name} headshot`}
                          className="w-10 h-10 rounded-full object-cover border border-white/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                          {initials}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-sm text-white/60">{t.location}</div>
                      </div>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Partner-jeweller trust band ───────────────────── */}
      {/* Hidden entirely until at least one real partner is added to
          PARTNER_LOGOS in lib/landingCopy.ts. */}
      {PARTNER_LOGOS.length > 0 && (
        <section className="py-16 md:py-20 px-6 bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">{PARTNER_BAND.eyebrow}</p>
              <h2 className="text-2xl md:text-3xl font-serif leading-tight">{PARTNER_BAND.heading}</h2>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {PARTNER_LOGOS.map((p) => {
                const initials = p.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'PJ'
                return (
                  <li key={`${p.name}-${p.city}`} className="flex flex-col items-center text-center gap-2">
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logoUrl}
                        alt={`${p.name} logo`}
                        className="h-12 w-auto object-contain grayscale opacity-80 hover:opacity-100 hover:grayscale-0 transition"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-[#1E3A5F]">
                        {initials}
                      </div>
                    )}
                    <div className="text-sm font-medium text-slate-800 leading-tight">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.city}</div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── Founder note ──────────────────────────────────── */}
      {/* Hidden entirely until FOUNDER.photoUrl is populated. */}
      {FOUNDER.photoUrl && (
        <section className="py-20 md:py-24 px-6 bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FOUNDER.photoUrl}
              alt={FOUNDER.name ? `${FOUNDER.name} — ${FOUNDER.title || 'Founder'}` : 'Founder'}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-md shrink-0"
            />
            <div className="text-center md:text-left">
              {FOUNDER.note && (
                <blockquote className="text-xl md:text-2xl font-serif leading-snug text-slate-800">
                  &ldquo;{FOUNDER.note}&rdquo;
                </blockquote>
              )}
              {(FOUNDER.name || FOUNDER.title) && (
                <div className="mt-5">
                  {FOUNDER.name && <div className="font-medium text-slate-900">{FOUNDER.name}</div>}
                  {FOUNDER.title && <div className="text-sm text-slate-500">{FOUNDER.title}</div>}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-semibold mb-3">{SECTIONS.faq.eyebrow}</p>
            <h2 className="text-3xl md:text-4xl font-serif leading-tight">{SECTIONS.faq.heading}</h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={f.q} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span className="font-medium text-base md:text-lg pr-4">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-6 pb-5 text-slate-600 leading-relaxed border-t border-slate-100 pt-4 text-sm md:text-base">
                      {f.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-4xl font-serif leading-tight">{FINAL_CTA.heading}</h2>
          <p className="mt-4 text-slate-600">{FINAL_CTA.body}</p>
          <a href="#signup"
            className="mt-7 inline-flex items-center gap-1.5 bg-[#1E3A5F] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#152943]">
            {HERO.primaryCta} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Diamond className="w-5 h-5 text-white" />
              <span className="text-xl font-bold text-white tracking-tight">{BRAND.name}</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed">{FOOTER.blurb}</p>
          </div>
          <div>
            <h4 className="text-white text-xs uppercase tracking-wider font-semibold mb-4">{FOOTER.contactHeading}</h4>
            <ul className="space-y-2 text-sm">
              <li>{BRAND.contactEmail}</li>
              <li>{FOOTER.whatsappLabel}: +{wa.slice(0,2)} {wa.slice(2,7)} {wa.slice(7)}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs uppercase tracking-wider font-semibold mb-4">{FOOTER.partnerHeading}</h4>
            <Link href="/login" className="text-sm hover:text-white">{FOOTER.partnerLinkLabel}</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-800 text-xs">
          <p>{FOOTER.copyright(new Date().getFullYear())}</p>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 px-3 pt-3 bg-white border-t border-slate-200 md:hidden z-50 flex items-stretch gap-2 shadow-[0_-4px_20px_rgb(0,0,0,0.05)]"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <a
          href="#signup"
          className="flex-1 min-w-0 bg-[#1E3A5F] text-white py-3 rounded-lg font-medium text-center text-sm sm:text-base truncate"
        >
          {MOBILE_BAR.primaryCta}
        </a>
        <a
          href={waChatHref}
          target="_blank" rel="noopener noreferrer"
          aria-label={MOBILE_BAR.whatsappAria}
          className="w-12 shrink-0 bg-[#25D366] text-white rounded-lg flex items-center justify-center shadow-sm"
        >
          <MessageCircle className="w-5 h-5" />
        </a>
      </div>

      {/* Desktop floating WhatsApp */}
      <a
        href={waChatHref}
        target="_blank" rel="noopener noreferrer"
        className="hidden md:flex fixed bottom-8 right-8 bg-[#25D366] text-white px-5 py-3 rounded-full shadow-lg items-center gap-2 text-sm font-medium hover:-translate-y-1 transition-transform z-50 hover:shadow-xl"
      >
        <MessageCircle className="w-5 h-5" />
        {NAV.whatsappCta}
      </a>
    </div>
  )
}
