import StoreLayout from '@/components/d2c/StoreLayout'
import { Award, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'Lifetime Warranty & Servicing | Shewah',
  description: 'Our lifetime craftsmanship guarantee covering prong tightening, cleaning, and structural maintenance.',
}

export default function WarrantyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Lifetime Guarantee
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            Lifetime Atelier Warranty
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto">
            Fine jewellery is designed to last generations. We stand behind every solder joint and setting.
          </p>
        </div>

        <div className="prose prose-stone text-xs sm:text-sm text-[#5C5347] space-y-6 max-w-none">
          <p>
            Every piece crafted by Shewah includes our comprehensive Lifetime Craftsmanship Guarantee. If your piece ever suffers from a structural manufacturing defect, we will repair or replace it free of charge.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">Complimentary Annual Servicing</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Multi-point prong inspection and stone tightening</li>
            <li>Ultrasonic bath and steam cleaning</li>
            <li>Rhodium plating refresh for 18K white gold pieces</li>
            <li>Minor scratch removal and surface polishing</li>
          </ul>
        </div>
      </div>
    </StoreLayout>
  )
}
