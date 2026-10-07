import StoreLayout from '@/components/d2c/StoreLayout'
import { ShieldCheck, Lock, Eye, FileText, Globe } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | Shewah High Jewellery Atelier',
  description: 'Our comprehensive privacy policy regarding personal data protection, secure payment processing, and confidential client care.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPolicyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Client Confidentiality & Governance
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#051F34]">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-lg mx-auto font-light leading-relaxed font-sans">
            Last Updated: September 2026. How Shewah safeguards your personal data, bespoke specifications, and payment security.
          </p>
        </div>

        {/* Policy Body */}
        <div className="prose prose-stone text-xs sm:text-sm text-[#69727D] space-y-8 max-w-none font-sans leading-relaxed">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              1. Our Commitment to Client Confidentiality
            </h2>
            <p>
              Shewah (&ldquo;Maison Shewah&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates an exclusive fine jewellery atelier crafting made-to-order and bespoke creations. We treat your personal data with the same uncompromising discretion and care that guides our diamond setting. We never sell, rent, or trade your personal information to third-party data brokers.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              2. Information We Collect
            </h2>
            <p>
              To process your orders, provide private consultations, and orchestrate secure international delivery, we collect:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Contact Identification:</strong> Full legal name, delivery address, billing address, email address, and telephone/WhatsApp number.</li>
              <li><strong>Bespoke Specifications:</strong> Ring sizing, metal preferences, engraving inscriptions, custom CAD design files, and private consultation notes.</li>
              <li><strong>Transaction Information:</strong> Order reference, purchased creations, currency, and payment timestamps. Full payment card details are encrypted and tokenized directly by our certified Level 1 PCI-DSS payment gateways (Stripe / Razorpay); Shewah never stores raw payment card numbers on our servers.</li>
              <li><strong>Technical Browsing Data:</strong> IP address, browser type, regional location for currency display, and anonymized traffic metrics to optimize site performance.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              3. Purpose & Legal Basis of Processing
            </h2>
            <p>
              We process your personal information strictly for legitimate commercial and legal purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Fulfilling and dispatching your made-to-order jewellery and managing insured international customs clearance.</li>
              <li>Conducting private digital CAD consultations and communicating production milestone updates.</li>
              <li>Validating high-value transactions against fraud to ensure buyer and merchant protection.</li>
              <li>Complying with statutory anti-money laundering (AML), assay hallmarking, and tax reporting regulations.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              4. Payment Security & Data Encryption
            </h2>
            <p>
              All digital communications and checkout sessions on shewah.co are secured with industry-standard 256-bit TLS encryption. Transaction processing is handled by tier-one international payment processors equipped with 3D Secure 2 (3DS2) authentication.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              5. International Transfers & Third-Party Partners
            </h2>
            <p>
              To deliver fine jewellery globally, personal contact details are shared strictly with essential partners:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Insured Logistics Couriers:</strong> FedEx International Priority, DHL Express, and armored logistics carriers solely for parcel handover and mandatory adult signature delivery.</li>
              <li><strong>Assay & Gemological Laboratories:</strong> IGI / GIA for grading dossier issuance where required.</li>
              <li><strong>Customs Authorities:</strong> Declared shipment manifests for import duty clearance at your destination country.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              6. Your Statutory Rights
            </h2>
            <p>
              Depending on your jurisdiction (including the EU GDPR, UK GDPR, and India Digital Personal Data Protection Act), you have the right to request access to, rectification of, or erasure of your personal data, or to restrict its processing. To exercise these rights, please contact our Data Protection Liaison at <a href="mailto:concierge@shewah.co" className="text-[#051F34] underline font-medium hover:text-[#CB9274]">concierge@shewah.co</a>.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              7. Contact Our Concierge
            </h2>
            <p>
              If you have any questions or concerns regarding our privacy governance, please reach us directly at:
            </p>
            <div className="p-4 bg-white border border-[#E3DBD4] mt-2 space-y-1 text-xs">
              <p><strong>Shewah High Jewellery Atelier</strong></p>
              <p>Surat Diamond Bourse / Katargam, Surat, Gujarat 395004, India</p>
              <p>Client Concierge: <a href="mailto:concierge@shewah.co" className="underline">concierge@shewah.co</a> | WhatsApp: +91 96622 66360</p>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
