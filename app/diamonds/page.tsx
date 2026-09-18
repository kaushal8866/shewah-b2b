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
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Stone Provenance
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-normal text-[#051F34]">
            Exceptional Cut, <br />
            Absolute Clarity.
          </h1>
          <p className="text-sm sm:text-base text-[#69727D] max-w-xl mx-auto font-light leading-relaxed font-sans">
            Every diamond selected by Shewah undergoes rigorous optical inspection. We prioritize cut quality above all else, ensuring maximum light performance and scintillating fire.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          <div className="bg-white p-8 border border-[#E3DBD4] space-y-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-medium">Option A</span>
            <h3 className="font-serif text-2xl text-[#051F34] font-normal">Lab-Grown Diamonds</h3>
            <p className="text-xs text-[#69727D] leading-relaxed">
              Optically, chemically, and physically identical to mined diamonds. Created using advanced CVD and HPHT technology mimicking Earth’s mantle pressure. Certified by IGI (International Gemological Institute) with laser inscription.
            </p>
            <ul className="text-xs text-[#69727D] space-y-1.5 pt-2">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> D–F Color (Colorless)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> VVS–VS Clarity (Eye Clean)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Ideal / Excellent Cut</li>
            </ul>
          </div>

          <div className="bg-white p-8 border border-[#E3DBD4] space-y-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#CB9274] font-medium">Option B</span>
            <h3 className="font-serif text-2xl text-[#051F34] font-normal">Natural Mined Diamonds</h3>
            <p className="text-xs text-[#69727D] leading-relaxed">
              Formed over billions of years in the earth’s crust. Ethically sourced and certified by accredited gemological laboratories with official grading reports.
            </p>
            <ul className="text-xs text-[#69727D] space-y-1.5 pt-2">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Ethically Sourced</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> GIA / IGI Grading Report</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#5C7F5F]" /> Rare Geological Heirlooms</li>
            </ul>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
