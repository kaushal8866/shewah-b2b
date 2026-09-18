import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Hammer, Sparkles, ShieldCheck, Award, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Atelier Craftsmanship | Shewah',
  description: 'Inside the Shewah jewellery atelier: 3D CAD modeling, solid 18K gold casting, micro-pavé setting, and multi-point optical quality inspection.',
}

export default function CraftsmanshipPage() {
  const steps = [
    {
      num: '01',
      title: '3D CAD Architectural Modeling',
      desc: 'Every design begins with mathematical precision. Our CAD artisans sculpt settings to hold each specific diamond securely, balancing structural strength with optimum light refraction.',
    },
    {
      num: '02',
      title: 'Precision Casting in Solid 18K Gold',
      desc: 'We cast individually using solid 18K yellow, white, and rose gold alloys as well as 950 platinum. Never hollow shells or electroplated base metals.',
    },
    {
      num: '03',
      title: 'Micro-Pavé & Artisanal Stone Setting',
      desc: 'Master stone setters inspect every diamond under optical magnification, gently securing beads and prongs over each girdle with steady hand precision.',
    },
    {
      num: '04',
      title: 'Mirror Polishing & Hallmarking',
      desc: 'Each piece undergoes fine multi-stage polishing before being certified and hallmarked for absolute gold purity.',
    },
  ]

  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Artisanal Precision
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-normal text-[#051F34]">
            The Architecture of Beauty
          </h1>
          <p className="text-sm sm:text-base text-[#69727D] max-w-xl mx-auto font-light leading-relaxed font-sans">
            Discover the rigorous four-stage journey from solid gold alloys and certified diamonds to an heirloom masterwork.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          {steps.map((s) => (
            <div key={s.num} className="bg-white p-8 border border-[#E3DBD4] space-y-3 shadow-sm">
              <span className="font-serif text-2xl text-[#CB9274] font-normal block">{s.num}</span>
              <h3 className="font-serif text-xl text-[#051F34] font-normal">{s.title}</h3>
              <p className="text-xs text-[#69727D] leading-relaxed font-light">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#F6F4F2] p-8 sm:p-12 border border-[#E3DBD4] text-center space-y-4">
          <h3 className="font-serif text-2xl text-[#051F34] font-normal">Interested in a custom design?</h3>
          <p className="text-xs text-[#69727D] max-w-md mx-auto font-sans leading-relaxed">
            Our atelier accepts bespoke commissions for engagement rings, custom eternity bands, and signature fine jewellery pieces.
          </p>
          <div className="pt-2">
            <Link
              href="/bespoke"
              className="inline-block px-8 py-3.5 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors"
            >
              Commission Bespoke
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
