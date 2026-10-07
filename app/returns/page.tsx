import StoreLayout from '@/components/d2c/StoreLayout'
import { ShieldCheck, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'

export const metadata = {
  title: 'Returns & Resizing Policy | Shewah High Jewellery Atelier',
  description: 'Our transparent 14-day inspection window, made-to-order return guidelines, and complimentary ring resizing policy.',
  alternates: { canonical: '/returns' },
}

export default function ReturnsPolicyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12 font-sans">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium">
            Client Assurance & Guarantee
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#051F34]">
            Returns & Resizing Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-lg mx-auto font-light leading-relaxed">
            Clear, transparent guidance for made-to-order fine jewellery and bespoke atelier commissions.
          </p>
        </div>

        {/* Policy Body */}
        <div className="prose prose-stone text-xs sm:text-sm text-[#69727D] space-y-8 max-w-none leading-relaxed">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              1. 14-Day Return Window for Catalogue Pieces
            </h2>
            <p>
              We want you to be completely confident in your purchase. Standard creations ordered directly from our catalogue (including necklaces, pendants, earrings, and signature suites) are eligible for return within <strong>14 calendar days</strong> of confirmed delivery:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>The piece must remain in unworn, brand-new condition with no scratches or alterations.</li>
              <li>The tamper-evident security tag attached to the piece must remain unbroken and unremoved.</li>
              <li>All original laboratory grading certificates (IGI / GIA dossiers), presentation boxes, and authenticity travel cases must be returned in full.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              2. Bespoke Commissions & Custom Personalization Exemptions
            </h2>
            <p>
              Due to their individualized nature, certain pieces are classified as final sale once production begins:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Bespoke One-of-a-Kind Pieces:</strong> Unique pieces designed from client briefs and approved 3D CAD renders cannot be returned once gold casting has begun.</li>
              <li><strong>Custom Inscriptions & Engravings:</strong> Pieces engraved with personal monograms, dates, or custom symbols cannot be returned.</li>
              <li><strong>Third-Party Alterations:</strong> Any creation resized or altered by an outside jeweller is strictly ineligible for return or warranty coverage.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              3. Complimentary 30-Day Ring Resizing
            </h2>
            <p>
              Getting an exact ring size can occasionally be tricky. For all standard solitaire and band designs in our catalogue, Shewah offers <strong>one complimentary ring resize within 30 days</strong> of delivery (within ±1.5 standard US sizes). Simply contact our concierge to receive insured return instructions.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              4. Return Authorization & Insured Shipping Procedure
            </h2>
            <p>
              To initiate a return or resizing request:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 mt-2">
              <li>Contact our concierge team at <a href="mailto:concierge@shewah.co" className="text-[#051F34] underline font-medium hover:text-[#CB9274]">concierge@shewah.co</a> or WhatsApp at <a href="https://wa.me/919662266360" target="_blank" rel="noopener noreferrer" className="text-[#051F34] underline font-medium hover:text-[#CB9274]">+91 96622 66360</a> within 14 days of delivery.</li>
              <li>We will issue a formal Return Merchandise Authorization (RMA) along with a prepaid, fully insured courier label.</li>
              <li>Once our gemological inspection team confirms the condition of the piece and certification, your refund will be processed to the original payment method within 5–7 business days.</li>
            </ol>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
