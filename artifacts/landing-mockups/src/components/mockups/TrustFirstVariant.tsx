import React, { useState } from 'react';
import { Diamond, CheckCircle2, MessageCircle, Star, Award, Building2, ChevronDown, ArrowRight, MapPin, Search } from 'lucide-react';

const BRAND = {
  name: 'Shewah',
  whatsappE164: '919876543210',
};

export default function TrustFirstVariant() {
  const [step, setStep] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#2D2A26] font-sans selection:bg-[#1E3A5F]/20">
      {/* Header */}
      <header className="bg-white border-b border-[#EAE8E4] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Diamond className="w-6 h-6 text-[#1E3A5F]" />
            <span className="font-serif font-medium text-2xl tracking-tight text-[#1E3A5F]">Shewah</span>
          </div>
          <a href="https://wa.me/919876543210" className="text-sm font-medium text-[#1E3A5F] hover:underline flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Partner Support
          </a>
        </div>
      </header>

      {/* Hero: Trust First, Founder Led */}
      <section className="py-16 md:py-24 px-6 bg-[#F5F4F0]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-[#E8E6DF] border-2 border-white flex items-center justify-center text-[#1E3A5F] font-serif text-xl shadow-sm">
                AK
              </div>
              <div>
                <p className="font-serif font-medium text-lg">Aman K.</p>
                <p className="text-sm text-[#73706A]">Founder, Shewah</p>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif text-[#1E3A5F] leading-tight mb-6">
              "We built the manufacturing partner I wished I had."
            </h1>
            
            <p className="text-lg text-[#5C5955] mb-8 leading-relaxed">
              Transparent 24kt gold pricing. Real karigars. WhatsApp native. We partner with independent jewellers who want to grow their diamond category without the headaches of traditional supply chains.
            </p>

            <div className="flex items-center gap-6 pt-8 border-t border-[#EAE8E4]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#1E3A5F]" />
                <span className="text-sm font-medium">BIS Hallmark HUID</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#1E3A5F]" />
                <span className="text-sm font-medium">IGI Graded</span>
              </div>
            </div>
          </div>

          {/* Multi-step form */}
          <div className="bg-white p-8 rounded-xl shadow-lg border border-[#EAE8E4]">
            <div className="flex items-center gap-2 mb-8">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-[#1E3A5F]' : 'bg-[#EAE8E4]'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-[#1E3A5F]' : 'bg-[#EAE8E4]'}`} />
            </div>

            <h2 className="text-2xl font-serif text-[#1E3A5F] mb-6">
              {step === 1 ? "Let's start a conversation" : "Almost there"}
            </h2>

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#5C5955] mb-2">Your Name</label>
                  <input type="text" className="w-full px-4 py-3 rounded-md bg-[#F9F8F6] border border-[#EAE8E4] focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] outline-none" placeholder="e.g. Sanjay Sharma" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5C5955] mb-2">WhatsApp Number</label>
                  <div className="flex gap-3">
                    <span className="inline-flex items-center px-4 rounded-md bg-[#F9F8F6] border border-[#EAE8E4] text-[#5C5955]">+91</span>
                    <input type="tel" className="w-full px-4 py-3 rounded-md bg-[#F9F8F6] border border-[#EAE8E4] focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] outline-none" placeholder="10-digit number" />
                  </div>
                </div>
                <button 
                  onClick={() => setStep(2)}
                  className="w-full bg-[#1E3A5F] text-white py-3.5 rounded-md font-medium mt-4 hover:bg-[#152842] transition-colors"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#5C5955] mb-2">Store Name</label>
                  <input type="text" className="w-full px-4 py-3 rounded-md bg-[#F9F8F6] border border-[#EAE8E4] focus:border-[#1E3A5F] outline-none" placeholder="e.g. Sharma & Sons Jewellers" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5C5955] mb-2">City</label>
                  <input type="text" className="w-full px-4 py-3 rounded-md bg-[#F9F8F6] border border-[#EAE8E4] focus:border-[#1E3A5F] outline-none" placeholder="e.g. Indore" />
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-3.5 rounded-md font-medium text-[#5C5955] hover:bg-[#F9F8F6]"
                  >
                    Back
                  </button>
                  <button 
                    className="flex-1 bg-[#1E3A5F] text-white py-3.5 rounded-md font-medium hover:bg-[#152842] transition-colors flex items-center justify-center gap-2"
                  >
                    Request Partner Call <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y border-[#EAE8E4] bg-white py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-8">
          <div className="text-center flex-1 min-w-[120px]">
            <div className="text-2xl font-serif text-[#1E3A5F] mb-1">12,000+</div>
            <div className="text-xs font-medium text-[#73706A] uppercase tracking-wider">Pieces Shipped</div>
          </div>
          <div className="text-center flex-1 min-w-[120px] border-l border-[#EAE8E4]">
            <div className="text-2xl font-serif text-[#1E3A5F] mb-1">180+</div>
            <div className="text-xs font-medium text-[#73706A] uppercase tracking-wider">Karigars</div>
          </div>
          <div className="text-center flex-1 min-w-[120px] border-l border-[#EAE8E4]">
            <div className="text-2xl font-serif text-[#1E3A5F] mb-1">64</div>
            <div className="text-xs font-medium text-[#73706A] uppercase tracking-wider">Cities</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-3xl font-serif text-[#1E3A5F] mb-16">Trusted by retailers across India</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-[#F9F8F6] rounded-xl border border-[#EAE8E4]">
              <div className="flex items-center gap-2 mb-6">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-[#D4AF37] text-[#D4AF37]" />)}
              </div>
              <p className="text-lg font-serif italic text-[#2D2A26] mb-8">
                "The transparency in billing is refreshing. I can see exactly what the gold cost is vs the diamond cost. It helps me price confidently for my end consumer."
              </p>
              <div className="flex items-center gap-4 border-t border-[#EAE8E4] pt-6">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-serif text-[#1E3A5F] border border-[#EAE8E4] font-medium text-lg shadow-sm">
                  VK
                </div>
                <div>
                  <div className="font-medium text-[#1E3A5F]">Verma Jewellers</div>
                  <div className="text-sm text-[#73706A] flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Jaipur
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-[#F9F8F6] rounded-xl border border-[#EAE8E4]">
              <div className="flex items-center gap-2 mb-6">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-[#D4AF37] text-[#D4AF37]" />)}
              </div>
              <p className="text-lg font-serif italic text-[#2D2A26] mb-8">
                "Their Ready-to-Ship collection has saved me during wedding season rushes. I can show the catalog on my phone and secure a piece for delivery the next day."
              </p>
              <div className="flex items-center gap-4 border-t border-[#EAE8E4] pt-6">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-serif text-[#1E3A5F] border border-[#EAE8E4] font-medium text-lg shadow-sm">
                  RS
                </div>
                <div>
                  <div className="font-medium text-[#1E3A5F]">Rao & Sons</div>
                  <div className="text-sm text-[#73706A] flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Lucknow
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="py-20 px-6 bg-[#1E3A5F] text-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-serif mb-12">The Shewah Partnership</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif mb-3">Live Catalog</h3>
              <p className="text-white/80 leading-relaxed">Browse hundreds of designs on your phone, with pricing tied to today's 24kt rate. Share easily with customers.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif mb-3">Honest Sourcing</h3>
              <p className="text-white/80 leading-relaxed">Every piece is BIS Hallmarked. Diamonds are graded by IGI. We don't cut corners on quality or compliance.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif mb-3">Custom Manufacturing</h3>
              <p className="text-white/80 leading-relaxed">Send a brief, get CAD renders in 48 hours. Approve on WhatsApp, and we manage production through to QC and delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-serif text-[#1E3A5F] mb-10 text-center">Questions?</h2>
          <div className="space-y-3">
            {[
              { q: 'Is there a joining fee?', a: 'No joining fee, no annual subscriptions. You only pay for the pieces you order.' },
              { q: 'What is the payment structure?', a: 'We ask for a 25% advance to begin production, with the balance due on dispatch when we share the tracking details.' },
              { q: 'How long does custom CAD take?', a: 'CAD renders are provided within 48 hours. Full production (from approval to shipping) takes 14-21 working days.' },
            ].map((faq, i) => (
              <div key={i} className="border border-[#EAE8E4] rounded-lg">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between font-medium text-[#1E3A5F]"
                >
                  {faq.q}
                  <ChevronDown className={`w-5 h-5 text-[#73706A] transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-[#5C5955] leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E3A5F] pt-20 pb-10 px-6 text-white border-t border-[#152842]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-12 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Diamond className="w-5 h-5 text-white" />
              <span className="font-serif font-medium text-xl">Shewah</span>
            </div>
            <p className="text-white/70 max-w-xs leading-relaxed text-sm">
              Building long-term manufacturing partnerships with India's best independent retail jewellers.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-6">Certifications</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> BIS Hallmark HUID</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Verify on IGI</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> ISO 9001</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-6">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li>partners@shewah.com</li>
              <li>WhatsApp: +91 98765 43210</li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto pt-8 border-t border-white/10 text-center text-white/50 text-xs">
          © {new Date().getFullYear()} Shewah. All rights reserved.
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-white p-4 border-t border-[#EAE8E4] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:hidden z-50 flex gap-3">
        <button 
          onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
          className="flex-1 bg-[#1E3A5F] text-white font-medium py-3.5 rounded-md"
        >
          Become a partner
        </button>
        <a 
          href="https://wa.me/919876543210"
          className="w-14 bg-[#25D366] text-white flex items-center justify-center rounded-md"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      </div>

    </div>
  );
}
