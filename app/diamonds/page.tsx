import StoreLayout from '@/components/d2c/StoreLayout'
import Link from 'next/link'
import { Diamond, Check, Award, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'Diamond Education & Certification | Shewah',
  description: 'Understand the 4Cs, cut standards, and certification. Shewah offers both conflict-free Natural diamonds and IGI certified Lab-Grown diamonds.',
}

export default function DiamondsPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-16">
        <div className="text-center space-y-4">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Stone Provenance
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-light text-[#2A241B]">
            Exceptional Cut, <br />
            Absolute Clarity.
          </h1>
          <p className="text-sm sm:text-base text-[#5C5347] max-w-xl mx-auto font-light leading-relaxed">
            Every diamond selected by Shewah undergoes rigorous optical inspection. We prioritize cut quality above all else, ensuring maximum light performance and scintillating fire.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-4">
            <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">Option A</span>
            <h3 className="font-serif text-2xl text-[#2A241B]">Lab-Grown Diamonds</h3>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              Optically, chemically, and physically identical to mined diamonds. Created using advanced CVD and HPHT technology mimicking Earth’s mantle pressure. Certified by IGI (International Gemological Institute) with laser inscription.
            </p>
            <ul className="text-xs text-[#5C5347] space-y-1.5 pt-2">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> D–F Color (Colorless)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> VVS–VS Clarity (Eye Clean)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Ideal / Excellent Cut</li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-4">
            <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">Option B</span>
            <h3 className="font-serif text-2xl text-[#2A241B]">Natural Mined Diamonds</h3>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              Formed billions of years ago in the earth’s crust. 100% ethically sourced and certified by the Kimberley Process. Accompanied by official GIA (Gemological Institute of America) grading reports.
            </p>
            <ul className="text-xs text-[#5C5347] space-y-1.5 pt-2">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Kimberley Process Certified</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> GIA Dossier & Inscription</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Rare Geological Heirlooms</li>
            </ul>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
