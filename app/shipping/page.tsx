import StoreLayout from '@/components/d2c/StoreLayout'
import { Truck, ShieldCheck, Globe, Clock } from 'lucide-react'

export const metadata = {
  title: 'Shipping & Delivery Policy | Shewah',
  description: 'Comprehensive international shipping policies, lead times, carrier partners, and customs clearance procedures for Shewah jewellery.',
}

export default function ShippingPolicyPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Global Logistics
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            Shipping & Insured Delivery
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto">
            Direct door-to-door insured air courier with signature required upon delivery.
          </p>
        </div>

        <div className="prose prose-stone text-xs sm:text-sm text-[#5C5347] space-y-6 max-w-none">
          <h3 className="font-serif text-xl text-[#2A241B]">1. Production Lead Time</h3>
          <p>
            Because Shewah creations are handcrafted to order in our atelier, each piece requires approximately 10–14 business days for casting, stone setting, hallmarking, and multi-point optical quality inspection before dispatch.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">2. International Transit & Carriers</h3>
          <p>
            We partner with specialist insured high-value couriers including FedEx International Priority, DHL Express, and armored logistics carriers (Ferrari Logistics / Malca-Amit for high-value orders).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>United States:</strong> 3–5 business days transit</li>
            <li><strong>United Kingdom:</strong> 3–5 business days transit</li>
            <li><strong>European Union (Germany, France):</strong> 3–5 business days transit</li>
            <li><strong>Australia & New Zealand:</strong> 4–6 business days transit</li>
          </ul>

          <h3 className="font-serif text-xl text-[#2A241B]">3. Customs, Taxes & Duties</h3>
          <p>
            For UK, Germany, France, and Australia, local taxes (VAT/GST) and import clearance procedures are calculated and handled directly at checkout. For the United States, applicable state sales taxes are calculated at checkout. There are no surprise customs release fees upon delivery.
          </p>

          <h3 className="font-serif text-xl text-[#2A241B]">4. Mandatory Adult Signature</h3>
          <p>
            To guarantee security, all parcels require an in-person signature by an adult upon delivery. Packages cannot be left unattended on doorsteps or redirected to pickup lockers without prior identity verification.
          </p>
        </div>
      </div>
    </StoreLayout>
  )
}
