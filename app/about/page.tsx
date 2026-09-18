import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Diamond, ShieldCheck, Hammer, Award } from 'lucide-react'

export const metadata = {
  title: 'Our Story & Heritage | Shewah Atelier',
  description: 'Learn about Shewah Atelier, our fine jewellery heritage, and our commitment to modern, ethically crafted diamond creations.',
}

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            The Shewah Heritage
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-normal text-[#051F34]">
            Born from Diamonds, <br />
            Forged in Gold.
          </h1>
          <p className="text-sm sm:text-base text-[#69727D] max-w-xl mx-auto font-light leading-relaxed font-sans">
            Shewah was founded on a singular principle: that genuine luxury requires zero compromises between artisan mastery and transparent modern ethics.
          </p>
        </div>

        <div className="relative overflow-hidden aspect-[16/9] shadow-md border border-[#E3DBD4]">
          <img
            src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1600&q=80"
            alt="Master artisan at Shewah Atelier"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="prose prose-stone max-w-none text-sm leading-relaxed text-[#69727D] space-y-6 font-sans">
          <h2 className="font-serif text-2xl text-[#051F34] font-normal">Artisanal Diamond Provenance</h2>
          <p>
            For generations, fine diamond jewellery has demanded rigorous precision and dedicated discipline. Our atelier artisans hone the geometry of light, the critical balance of fire and brilliance, and the delicate touch required to set stones securely into solid gold.
          </p>
          <p>
            Traditional luxury houses often hide their supply chains behind multi-tiered distributors and steep markups. Shewah operates differently. By crafting in our own atelier and setting certified diamonds, we deliver genuine fine jewellery directly to international clients.
          </p>

          <h2 className="font-serif text-2xl text-[#051F34] font-normal pt-6">Individual Made-to-Order Philosophy</h2>
          <p>
            Mass production creates waste and diminishes individuality. At Shewah, every ring, pendant, and tennis bracelet is crafted only after an order is placed. This allows us to personalize sizing, hand-match diamonds for color and clarity, and preserve the emotional significance of every piece.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-[#E3DBD4] text-center font-sans">
          <div className="p-6 bg-white border border-[#E3DBD4] space-y-2">
            <Diamond className="w-6 h-6 text-[#CB9274] mx-auto" />
            <h4 className="font-serif text-base text-[#051F34] font-normal">Certified Diamonds</h4>
            <p className="text-xs text-[#69727D]">IGI & GIA certified stones cut to ideal proportions.</p>
          </div>
          <div className="p-6 bg-white border border-[#E3DBD4] space-y-2">
            <Hammer className="w-6 h-6 text-[#CB9274] mx-auto" />
            <h4 className="font-serif text-base text-[#051F34] font-normal">Artisanal Setting</h4>
            <p className="text-xs text-[#69727D]">Decades of dedicated craftsmanship in precious metals.</p>
          </div>
          <div className="p-6 bg-white border border-[#E3DBD4] space-y-2">
            <ShieldCheck className="w-6 h-6 text-[#CB9274] mx-auto" />
            <h4 className="font-serif text-base text-[#051F34] font-normal">Insured Delivery</h4>
            <p className="text-xs text-[#69727D]">Direct door-to-door courier delivery to our global clients.</p>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
