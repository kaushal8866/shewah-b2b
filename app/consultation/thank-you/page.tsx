'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, MessageCircle, ArrowRight, ShieldCheck, Sparkles, Clock, Calendar, ChevronRight } from 'lucide-react'

const WHATSAPP_NUMBER = '919662266360'
const WHATSAPP_MESSAGE = encodeURIComponent('Hi Shewah team! I just reserved my bespoke consultation on your website and would like to share my initial ring ideas.')

const NEXT_STEPS = [
  {
    step: '01',
    title: 'Design Review',
    timeframe: 'Within 4 Hours',
    desc: 'Our Atelier Directors evaluate your preferred carat weight, diamond shape, and setting style.',
    icon: Clock,
  },
  {
    step: '02',
    title: '3D Render & Sketch Portfolio',
    timeframe: 'Same Day',
    desc: 'You receive high-resolution CAD sketches and lab-grown diamond certificate options on WhatsApp.',
    icon: Sparkles,
  },
  {
    step: '03',
    title: '1-on-1 Atelier Session',
    timeframe: 'Flexible Schedule',
    desc: 'Review your custom parameters, inspect stone optical brilliance, and finalize your commission with zero obligation.',
    icon: Calendar,
  },
]

const FEATURED_INSPIRED_STYLES = [
  {
    title: 'The Solitaire Promise',
    tag: 'Timeless Classic',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=600',
    desc: 'Four-prong classic peg head in 18k Solid Yellow Gold with ultra-thin micro band.',
  },
  {
    title: 'Hidden Halo Oval',
    tag: 'Client Favorite',
    image: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&q=80&w=600',
    desc: 'Elongated oval cut lab diamond surrounded by an intricate pavé hidden halo.',
  },
  {
    title: 'Toi et Moi Emerald & Pear',
    tag: 'Bespoke Statement',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=600',
    desc: 'Dual-stone harmony pairing a step-cut emerald with a brilliant pear solitaire.',
  },
]

export default function ThankYouPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Fire Google Ads Conversion Event for Thank You Page load
    if (typeof window !== 'undefined' && (window as any).gtag) {
      try {
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-18068366696/1IaCCIqgn9UcEOjK1adD',
          value: 1.0,
          currency: 'INR',
        })
      } catch (e) {
        console.error('gtag error:', e)
      }
    }

    // Fire Pinterest Lead Event
    if (typeof window !== 'undefined' && (window as any).pintrk) {
      try {
        (window as any).pintrk('track', 'lead', {
          event_id: `thankyou_lead_${Date.now()}`,
          lead_type: 'Bespoke Consultation',
        })
      } catch (e) {
        console.error('pintrk error:', e)
      }
    }

    // Fire Meta Pixel Lead Event if available.
    //
    // The server already sent this same Lead via the Conversions API. Both must
    // carry the identical eventID or Meta counts one submission as two, which
    // halves every reported cost-per-lead and teaches the algorithm from
    // phantom conversions. The id is minted server-side from the enquiry id and
    // handed back through ?eid=. Without it we skip the browser event entirely
    // and let the server event stand alone — one real conversion beats two
    // fictional ones.
    if (typeof window !== 'undefined' && (window as any).fbq) {
      try {
        // The id prefix says which event the server sent, so the browser fires
        // the matching one. D2C consultations are `Lead`; B2B partner signups
        // are `CompleteRegistration`, kept separate so the bespoke campaign
        // never optimises toward retailers.
        const eid = new URLSearchParams(window.location.search).get('eid')
        if (eid?.startsWith('lead_')) {
          ;(window as any).fbq('track', 'Lead', {}, { eventID: eid })
        } else if (eid?.startsWith('partner_')) {
          ;(window as any).fbq('track', 'CompleteRegistration', {}, { eventID: eid })
        }
      } catch (e) {
        console.error('fbq error:', e)
      }
    }
  }, [])

  return (
    <main className="min-h-screen bg-stone-900 text-white selection:bg-accent/30 selection:text-accent">
      {/* Header Bar */}
      <header className="border-b border-white/10 bg-stone-900/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/consultation" className="flex items-center gap-2 group">
          <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.25em] text-white group-hover:text-accent transition-colors">
            SHEWAH
          </span>
          <span className="text-[10px] tracking-widest text-accent uppercase font-mono border border-accent/30 px-2 py-0.5 ">
            ATELIER
          </span>
        </Link>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366] hover:text-black border border-[#25D366]/30 px-3.5 py-1.5 text-xs font-medium transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Director Line</span>
        </a>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24 max-w-4xl mx-auto text-center space-y-8">
        {/* Glow Scrim */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Animated Badge */}
        <div className="relative inline-flex">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-b from-accent/25 to-accent/5 border border-accent/40 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(212,175,55,0.2)]">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-accent animate-pulse" />
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-4 max-w-2xl mx-auto">
          <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-accent bg-accent/10 px-3 py-1 border border-accent/20">
            Consultation Confirmed
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-light tracking-wide leading-tight text-white">
            Your Bespoke Vision <br className="hidden sm:inline" /> Is Now In Motion
          </h1>
          <p className="text-sm sm:text-base text-white/70 font-light leading-relaxed">
            Thank you for sharing your parameters. Our senior Atelier Directors have received your request and are preparing custom 3D sketch references tailored to your preferences.
          </p>
        </div>

        {/* Immediate WhatsApp Action Box */}
        <div className="bg-stone-900 border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-2xl space-y-5 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366]/5 blur-3xl pointer-events-none" />
          
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0 border border-[#25D366]/30">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-medium text-white">Want Immediate Sketch Inspiration?</h2>
              <p className="text-xs text-white/60 font-light mt-0.5">
                Skip the wait and connect directly with Atelier Directors over WhatsApp to share Pinterest pins or reference photos.
              </p>
            </div>
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20ba59] text-black font-medium py-3.5 px-6 rounded-xl transition-all shadow-[0_0_25px_rgba(37,211,102,0.3)] hover:scale-[1.01] active:scale-[0.99] text-sm"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Message Director on WhatsApp (+91 96622 66360)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </a>
        </div>
      </section>

      {/* What Happens Next Roadmap */}
      <section className="border-t border-white/10 bg-stone-950 py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent">
              Next Steps
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-light text-white">
              What To Expect Next
            </h2>
            <p className="text-xs sm:text-sm text-white/60 font-light max-w-md mx-auto">
              Our 3-step co-creation process ensures complete transparency, certification verification, and custom precision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {NEXT_STEPS.map((item, idx) => {
              const IconComp = item.icon
              return (
                <div
                  key={idx}
                  className="bg-stone-950 border border-white/10 p-6 rounded-2xl relative space-y-4 hover:border-accent/40 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-accent bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">
                      {item.step}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      {item.timeframe}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-accent group-hover:bg-accent/15 transition-colors">
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-serif font-medium text-white">{item.title}</h3>
                    <p className="text-xs text-white/60 font-light leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Inspired Bespoke Showcase */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent">
              Atelier Archive
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-white mt-1">
              Bespoke Creations For Inspiration
            </h2>
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-mono tracking-wider"
          >
            <span>Explore Full Catalog</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURED_INSPIRED_STYLES.map((card, i) => (
            <div key={i} className="group bg-stone-900 border border-white/10 rounded-2xl overflow-hidden hover:border-accent/50 transition-all">
              <div className="relative h-64 w-full overflow-hidden bg-black">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                  unoptimized
                />
                <div className="absolute top-3 left-3">
                  <span className="text-[9px] font-mono uppercase tracking-wider bg-black/70 backdrop-blur-md text-accent px-2.5 py-1 border border-accent/30">
                    {card.tag}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="text-base font-serif text-white group-hover:text-accent transition-colors">{card.title}</h3>
                <p className="text-xs text-white/60 font-light leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Footer */}
      <footer className="border-t border-white/10 bg-stone-900 py-12 px-4 text-center space-y-6">
        <div className="flex flex-wrap justify-center gap-6 text-xs text-white/50 font-light">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>100% Certified Lab-Grown Diamonds</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>BIS Hallmarked Solid Gold</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Confidential & Zero Pressure</span>
          </div>
        </div>

        <p className="text-[11px] text-white/40 font-mono">
          &copy; {new Date().getFullYear()} SHEWAH Atelier. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
