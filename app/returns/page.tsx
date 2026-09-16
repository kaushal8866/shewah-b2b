import StoreLayout from '@/components/d2c/StoreLayout'
import { ShieldCheck, RotateCcw, AlertCircle } from 'lucide-react'

export const metadata = {
  title: 'Returns & Resizing Policy | Shewah',
  description: 'Our policy regarding made-to-order jewellery, complimentary ring resizing, and return conditions.',
}

export default function ReturnsPolicyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Client Assurance
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            Returns & Resizing Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto">
            Honest, transparent guidance for made-to-order and bespoke fine jewellery.
          </p>
        </div>

        <div className="prose prose-stone text-xs sm:text-sm text-[#5C5347] space-y-6 max-w-none">
          <h3 className="font-serif text-xl text-[#2A241B]">1. Complimentary 30-Day Ring Resizing</h3>
          <p>
            We understand that getting ring sizing exact can be challenging. Shewah provides one complimentary ring resizing within 30 days of delivery for standard solitaire and band designs (within ±1.5 US sizes).
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">2. Made-to-Order Conditions</h3>
          <p>
            Because each piece is individually cast and handset to your chosen metal tone, karat, diamond specification, and ring size, items are classified as bespoke made-to-order creations. If you are not satisfied with your piece upon arrival, please contact our concierge within 14 days of receipt to arrange an inspection and return authorization.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">3. Non-Returnable Items</h3>
          <p>
            Custom engraved pieces, bespoke one-of-a-kind commissions developed through private CAD consultations, and items that have been altered or resized by a third-party jeweller are not eligible for return.
          </p>
        </div>
      </div>
    </StoreLayout>
  )
}
