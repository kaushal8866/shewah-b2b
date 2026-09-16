import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Diamond, ShieldCheck, Hammer, Award } from 'lucide-react'

export const metadata = {
  title: 'Our Story & Heritage | Shewah Atelier',
  description: 'Learn about Shewah Atelier, our diamond cutting roots in Antwerp and Surat, and our commitment to modern, ethically crafted fine jewellery.',
}

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            The Shewah Heritage
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-light text-[#2A241B]">
            Born from Diamonds, <br />
            Forged in Gold.
          </h1>
          <p className="text-sm sm:text-base text-[#5C5347] max-w-xl mx-auto font-light leading-relaxed">
            Shewah was founded on a singular principle: that genuine luxury requires zero compromises between ancient artisan mastery and transparent modern ethics.
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden aspect-[16/9] shadow-xl border border-[#E8DFC9]">
          <img
            src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1600&q=80"
            alt="Master artisan at Shewah Atelier"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="prose prose-stone max-w-none text-sm leading-relaxed text-[#5C5347] space-y-6">
          <h2 className="font-serif text-2xl text-[#2A241B] font-medium">Antwerp & Surat Provenance</h2>
          <p>
            For generations, the global diamond trade has revolved around the historic cutting centres of Antwerp, Belgium and Surat, India. Our founders grew up inside these legendary workshops—learning the geometry of light, the critical balance of fire and brilliance, and the precise touch required to set stones securely into solid gold.
          </p>
          <p>
            Traditional luxury houses often hide their supply chains behind multi-tiered distributors and steep markups. Shewah operates differently. By owning our atelier and working directly with master cutters, we deliver genuine high jewellery directly to international collectors.
          </p>

          <h2 className="font-serif text-2xl text-[#2A241B] font-medium pt-6">Individual Made-to-Order Philosophy</h2>
          <p>
            Mass production creates waste and diminishes individuality. At Shewah, every ring, pendant, and tennis bracelet is cast in small batches from certified alloys only after an order is placed. This allows us to personalize sizing, hand-match every diamond for color and clarity, and preserve the emotional significance of every piece.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-[#E8DFC9] text-center">
          <div className="p-6 bg-white rounded-2xl border border-[#E8DFC9] space-y-2">
            <Diamond className="w-6 h-6 text-[#A88A4F] mx-auto" />
            <h4 className="font-serif text-base text-[#2A241B]">Certified Diamonds</h4>
            <p className="text-xs text-[#5C5347]">IGI & GIA certified stones cut to ideal proportions.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-[#E8DFC9] space-y-2">
            <Hammer className="w-6 h-6 text-[#A88A4F] mx-auto" />
            <h4 className="font-serif text-base text-[#2A241B]">Master Karigars</h4>
            <p className="text-xs text-[#5C5347]">Decades of hereditary craftsmanship in precious metals.</p>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-[#E8DFC9] space-y-2">
            <ShieldCheck className="w-6 h-6 text-[#A88A4F] mx-auto" />
            <h4 className="font-serif text-base text-[#2A241B]">Insured Worldwide</h4>
            <p className="text-xs text-[#5C5347]">Direct door-to-door courier delivery to our global clients.</p>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
