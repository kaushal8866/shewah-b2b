import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Hammer, Sparkles, ShieldCheck, Award, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Atelier Craftsmanship | Shewah',
  description: 'Inside the Shewah jewellery atelier: 3D CAD modeling, lost-wax gold casting, micro-pavé setting, and multi-point optical quality audits.',
}

export default function CraftsmanshipPage() {
  const steps = [
    {
      num: '01',
      title: '3D CAD Architectural Modeling',
      desc: 'Every design begins with mathematical precision. Our CAD designers sculpt settings to hold each specific diamond securely, minimizing metal weight while maximizing stone light refraction.',
    },
    {
      num: '02',
      title: 'Lost-Wax Casting in 18K Solid Gold',
      desc: 'We cast in small, individual flasks using solid 18K yellow, white, and rose gold alloys as well as 950 platinum. No hollow shells or plated brass.',
    },
    {
      num: '03',
      title: 'Micro-Pavé & Hand Stone Setting',
      desc: 'Master karigars examine every stone under high-magnification stereomicroscopes, gently rolling beads and prongs over the girdle with surgical accuracy.',
    },
    {
      num: '04',
      title: 'Hand Mirror Polishing & BIS Hallmarking',
      desc: 'The piece undergoes multi-stage polishing with natural rouge and diamond paste before being hallmarked for legal fineness.',
    },
  ]

  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Artisanal Precision
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-light text-[#2A241B]">
            The Architecture of Beauty
          </h1>
          <p className="text-sm sm:text-base text-[#5C5347] max-w-xl mx-auto font-light leading-relaxed">
            Discover the rigorous four-stage journey from molten gold and rough diamonds to an heirloom masterpiece.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-3 shadow-sm">
              <span className="font-serif text-2xl text-[#C9A86A] font-semibold block">{s.num}</span>
              <h3 className="font-serif text-xl text-[#2A241B] font-medium">{s.title}</h3>
              <p className="text-xs text-[#5C5347] leading-relaxed font-light">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#F4ECDD] p-8 rounded-2xl border border-[#E8DFC9] text-center space-y-4">
          <h3 className="font-serif text-2xl text-[#2A241B]">Interested in a custom design?</h3>
          <p className="text-xs text-[#5C5347] max-w-md mx-auto">
            Our atelier accepts bespoke commissions for engagement rings, custom eternity bands, and signature high jewellery pieces.
          </p>
          <div className="pt-2">
            <Link
              href="/bespoke"
              className="inline-block px-8 py-3 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-stone-800 transition-colors"
            >
              Commission Bespoke
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
