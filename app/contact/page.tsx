import StoreLayout from '@/components/d2c/StoreLayout'
import { Mail, MessageCircle, Phone, Clock, MapPin } from 'lucide-react'

export const metadata = {
  title: 'Contact & Concierge | Shewah High Jewellery',
  description: 'Get in touch with Shewah Client Concierge for custom diamond sourcing, bespoke consultations, or order inquiries.',
}

export default function ContactPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 space-y-12">
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Private Client Care
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-light text-[#2A241B]">
            Atelier Concierge
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-lg mx-auto">
            Our diamond specialists and gemologists are at your service for personal inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-3">
            <MessageCircle className="w-8 h-8 text-[#A88A4F] mx-auto" />
            <h3 className="font-serif text-lg text-[#2A241B]">WhatsApp Concierge</h3>
            <p className="text-xs text-[#5C5347]">Direct real-time chat with our client specialists.</p>
            <div className="pt-2">
              <a
                href="https://wa.me/919662266360"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#A88A4F] underline"
              >
                Start WhatsApp Chat
              </a>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-3">
            <Mail className="w-8 h-8 text-[#A88A4F] mx-auto" />
            <h3 className="font-serif text-lg text-[#2A241B]">Email Enquiries</h3>
            <p className="text-xs text-[#5C5347]">Inquire regarding bespoke commissions or orders.</p>
            <div className="pt-2">
              <a
                href="mailto:concierge@shewah.co"
                className="text-xs font-semibold text-[#A88A4F] underline"
              >
                concierge@shewah.co
              </a>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-[#E8DFC9] space-y-3">
            <Clock className="w-8 h-8 text-[#A88A4F] mx-auto" />
            <h3 className="font-serif text-lg text-[#2A241B]">Operating Hours</h3>
            <p className="text-xs text-[#5C5347]">Monday – Saturday</p>
            <p className="text-[11px] text-[#8C8275]">9:00 AM – 8:00 PM (GMT+5:30)</p>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
