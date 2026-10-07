import StoreLayout from '@/components/d2c/StoreLayout'
import { Scale, ShieldCheck, Truck, RefreshCw, FileText } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | Shewah High Jewellery Atelier',
  description: 'Terms and conditions governing fine jewellery purchases, bespoke commissions, made-to-order casting, and global delivery.',
  alternates: { canonical: '/terms' },
}

export default function TermsOfServicePage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Client Agreement & Terms
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#051F34]">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-lg mx-auto font-light leading-relaxed font-sans">
            Last Updated: September 2026. Please review the terms governing orders placed with Shewah High Jewellery Atelier.
          </p>
        </div>

        {/* Terms Body */}
        <div className="prose prose-stone text-xs sm:text-sm text-[#69727D] space-y-8 max-w-none font-sans leading-relaxed">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              1. Atelier Overview & Acceptance of Terms
            </h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of shewah.co and any purchase or bespoke commission entered into with Shewah High Jewellery (&ldquo;Shewah&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By accessing our storefront, booking a design consultation, or confirming an order, you agree to be bound by these Terms.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              2. Made-to-Order & Bespoke Creation Protocol
            </h2>
            <p>
              Every Shewah piece is an individual craft commission:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Made-to-Order Catalogue Pieces:</strong> Following order confirmation, your creation is individually cast in solid 18K gold (or 950 platinum) and handset with certified diamonds. Production typically requires approximately 14–16 business days prior to insured dispatch.</li>
              <li><strong>Bespoke Commissions:</strong> One-of-a-kind designs developed through private consultations require client approval of 3D CAD models. Once CAD renders are approved by the client and precious metal casting begins, bespoke orders cannot be cancelled or modified. Crafting lead times are typically 14–18 business days from CAD confirmation.</li>
              <li><strong>Natural & Artisanal Variations:</strong> Fine jewellery crafted by hand may display minute variations in finish, prong curvature, and exact metal weight (typically within ±5%), celebrating individual provenance.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              3. Pricing, Taxes & Currency Display
            </h2>
            <p>
              All prices displayed on shewah.co reflect active precious metal market rates. We support multi-currency billing in USD, GBP, EUR, AUD, and INR. Applicable regional duties and taxes are calculated during checkout according to your destination country. Full payment is required prior to atelier production initiation.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              4. Insured Global Delivery & Mandatory Signature
            </h2>
            <p>
              We provide complimentary door-to-door insured air express courier dispatch via FedEx International Priority or DHL Express. For security of high-value jewellery:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>An adult signature is strictly mandatory upon delivery. Packages cannot be left unattended on doorsteps or redirected to unverified parcel lockers.</li>
              <li>Risk of loss transfers to the client upon physical signature and delivery confirmation by the courier.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              5. 14-Day Return Window & Exclusions
            </h2>
            <p>
              We want you to treasure your Shewah creation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Standard Catalogue Pieces:</strong> Eligible for return within 14 calendar days of delivery. Items must be returned in original, unworn, unaltered condition with intact tamper-evident security tags and accompanying gemological grading reports.</li>
              <li><strong>Non-Returnable Items:</strong> Custom-engraved jewellery, one-of-a-kind bespoke CAD commissions, and any piece altered or resized by a third-party jeweller are final sale.</li>
              <li><strong>Return Shipping:</strong> Returns must be arranged through our concierge using our designated insured courier service.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              6. Lifetime Craftsmanship Guarantee & Servicing
            </h2>
            <p>
              Shewah stands behind every solder joint and stone setting. We warrant all creations against structural manufacturing defects. This warranty does not cover accidental damage, improper storage, contact with chlorine/harsh abrasives, or unauthorized third-party alterations.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              7. Intellectual Property
            </h2>
            <p>
              All designs, CAD renders, photography, brandmarks, texts, and editorial graphics on shewah.co are the exclusive intellectual property of Shewah High Jewellery and are protected by international copyright laws.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              8. Governing Law & Dispute Resolution
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any dispute arising out of or in connection with these Terms or the purchase of goods shall be subject to the exclusive jurisdiction of the competent courts in Surat, Gujarat, India.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              9. Contact Information
            </h2>
            <div className="p-4 bg-white border border-[#E3DBD4] space-y-1 text-xs">
              <p><strong>Shewah High Jewellery Atelier</strong></p>
              <p>Surat Diamond Bourse / Katargam, Surat, Gujarat 395004, India</p>
              <p>Inquiries: <a href="mailto:concierge@shewah.co" className="underline">concierge@shewah.co</a> | WhatsApp: +91 96622 66360</p>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
