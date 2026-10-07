import StoreLayout from '@/components/d2c/StoreLayout'
import { Truck, ShieldCheck, Globe, Clock, CheckCircle } from 'lucide-react'

export const metadata = {
  title: 'Shipping & Delivery Policy | Shewah High Jewellery Atelier',
  description: 'Comprehensive international shipping policies, unified crafting lead times, carrier partners, and customs clearance procedures for Shewah fine jewellery.',
  alternates: { canonical: '/shipping' },
}

export default function ShippingPolicyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12 font-sans">
        {/* Header */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#CB9274] font-medium">
            Global Logistics & Insured Transit
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#051F34]">
            Shipping & Insured Delivery
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-lg mx-auto font-light leading-relaxed">
            Direct door-to-door insured air courier with signature strictly required upon handover.
          </p>
        </div>

        {/* Policy Body */}
        <div className="prose prose-stone text-xs sm:text-sm text-[#69727D] space-y-8 max-w-none leading-relaxed">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              1. Unified Crafting Lead Times
            </h2>
            <p>
              Because every Shewah creation is individually crafted to order in our atelier, each piece requires rigorous goldsmithing, stone setting, hallmarking, and multi-point gemological inspection prior to dispatch:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Made-to-Order Catalogue Pieces:</strong> Approximately <strong>14–16 business days</strong> for casting, precision stone setting, hand finishing, and laboratory assay certification.</li>
              <li><strong>Bespoke Atelier Commissions:</strong> Approximately <strong>14–18 business days</strong> following final client approval of 3D CAD models.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              2. International Transit Timelines & Specialist Couriers
            </h2>
            <p>
              We partner with specialist insured express logistics carriers—principally FedEx International Priority and DHL Express—ensuring expedited customs clearance and direct tracked air transit:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>United States & Canada:</strong> 3–5 business days transit</li>
              <li><strong>United Kingdom:</strong> 3–5 business days transit</li>
              <li><strong>European Union (Germany, France, Italy):</strong> 3–5 business days transit</li>
              <li><strong>Australia & New Zealand:</strong> 4–6 business days transit</li>
              <li><strong>India:</strong> 2–3 business days transit</li>
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              3. Customs Clearance, Duties & Taxes
            </h2>
            <p>
              For international clients in the UK, European Union, and Australia, regional taxes (VAT/GST) and applicable import clearance charges are calculated directly at checkout. For United States clients, applicable state sales taxes are calculated at checkout. Every parcel is dispatched with complete formal customs documentation to ensure seamless clearance with no unexpected release fees upon arrival.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              4. Mandatory In-Person Adult Signature
            </h2>
            <p>
              Due to the high-value nature of solid gold and certified diamond jewellery, all parcels require an in-person physical signature by an adult upon delivery. Couriers are strictly prohibited from leaving shipments unattended on doorsteps, in common areas, or redirecting to unverified parcel lockers.
            </p>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-[#051F34] font-normal mb-3">
              5. Dispatch Notification & Live Real-Time Tracking
            </h2>
            <p>
              The moment your creation completes final quality control and leaves our atelier, you will receive an automated dispatch notification via email and WhatsApp containing your direct courier tracking number and estimated delivery date.
            </p>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
