import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, Diamond, ShieldCheck, MapPin, Truck, Phone, MessageCircle } from 'lucide-react';

const BRAND = {
  name: 'Shewah',
  whatsappE164: '919876543210',
  contactEmail: 'partners@shewah.com',
};

export default function OutcomeFirstVariant() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const stats = [
    { value: '12,000+', label: 'Pieces shipped' },
    { value: '180+', label: 'Karigars' },
    { value: '64', label: 'Cities served' },
    { value: '< 1 day', label: 'Lead-to-call' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-[#1E3A5F] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#1E3A5F] flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Shewah</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#catalog" className="hover:text-[#1E3A5F] transition-colors">Catalog</a>
            <a href="#pricing" className="hover:text-[#1E3A5F] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#1E3A5F] transition-colors">FAQ</a>
            <a href="https://wa.me/919876543210" className="flex items-center gap-2 text-[#1E3A5F] bg-[#1E3A5F]/10 px-4 py-2 rounded-full hover:bg-[#1E3A5F]/20 transition-colors">
              <MessageCircle className="w-4 h-4" />
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Hero: Outcome First, Quantified Proof, 3-field form */}
      <section className="pt-20 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-white to-white -z-10" />
        
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_400px] gap-16 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#1E3A5F] text-xs font-semibold uppercase tracking-widest mb-8">
              <ShieldCheck className="w-4 h-4" />
              For independent jewellers
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-[64px] font-serif leading-[1.1] text-slate-900 mb-6 tracking-tight">
              Stock the diamond pieces your customers ask for — with <span className="text-[#1E3A5F]">one transparent quote</span> per order.
            </h1>
            
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
              See gold + labour + diamond + margin on every quote. No hidden multipliers, no billing-weight games.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y border-slate-200 py-8 mb-10">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-3xl font-serif text-[#1E3A5F] mb-1">{s.value}</span>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {String.fromCharCode(64+i)}
                  </div>
                ))}
              </div>
              <span>Trusted by 100+ retail partners across India</span>
            </div>
          </div>

          {/* Minimal 3-field form */}
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#1E3A5F] rounded-t-2xl" />
            <h2 className="text-2xl font-serif font-medium mb-2">Get trade access</h2>
            <p className="text-slate-500 text-sm mb-6">Enter your details to view the live catalog and trade pricing.</p>
            
            <form className="space-y-4" onSubmit={e => e.preventDefault()}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Your Name</label>
                <input type="text" className="w-full px-4 py-3 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition-all outline-none" placeholder="Rahul Sharma" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">WhatsApp Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-medium">+91</span>
                  <input type="tel" className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition-all outline-none" placeholder="98765 43210" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">City</label>
                <input type="text" className="w-full px-4 py-3 rounded-lg bg-slate-50 border-transparent focus:bg-white focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition-all outline-none" placeholder="e.g. Surat, Indore" />
              </div>
              
              <button className="w-full bg-[#1E3A5F] text-white font-medium text-lg py-4 rounded-lg mt-4 hover:bg-[#152943] transition-colors flex items-center justify-center gap-2">
                Talk to a partner manager <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-slate-400 mt-4">
                No joining fee • No exclusivity
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* What You Get - Data Forward */}
      <section id="catalog" className="py-24 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-serif mb-4">A complete back-office for the diamond side of your store.</h2>
            <p className="text-lg text-slate-600">Browse hundreds of diamond and gold designs with photos, weights, and a price quoted at TODAY's 24K rate.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Honest pricing, line by line',
                desc: 'Every quote shows the gold cost (at 24kt-pure rate), karigar labour, diamond cost, and our margin.',
                metric: 'Zero hidden fees'
              },
              {
                title: 'Custom CAD in 48 hours',
                desc: 'Send a brief or reference photo. Our team turns around renders fast so you can close the sale.',
                metric: '48h turnaround'
              },
              {
                title: 'Ready-to-Ship inventory',
                desc: 'When a customer wants a piece tomorrow, browse finished inventory and bid for the ones that fit.',
                metric: 'Next day dispatch'
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                <div className="text-xs font-bold text-[#1E3A5F] uppercase tracking-widest mb-4 pb-4 border-b border-slate-100">{feature.metric}</div>
                <h3 className="text-xl font-serif font-medium mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed flex-grow">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-center mb-16">From hello to your first order in a week.</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Submit details', desc: 'Share your basic info. Your assigned partner manager will WhatsApp you within 1 business day.' },
              { step: '02', title: '20-min onboarding', desc: 'We set your trade pricing and unlock catalog + Ready-to-Ship access on your phone.' },
              { step: '03', title: 'Place order', desc: 'Pick from the catalog, request a custom CAD, or bid on a Ready-to-Ship piece.' },
              { step: '04', title: 'Track on WhatsApp', desc: 'Production updates, photos at QC, and a tracking link the moment we hand it to the courier.' }
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="text-4xl font-serif text-slate-200 mb-4">{step.step}</div>
                <h3 className="text-lg font-medium mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
                {i < 3 && <ArrowRight className="hidden md:block absolute top-2 right-0 w-6 h-6 text-slate-200 -translate-x-1/2" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 px-6 bg-[#1E3A5F] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif mb-12 text-center text-white">Trusted by independent jewellers</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/10 p-8 rounded-xl backdrop-blur-sm border border-white/20">
              <p className="text-xl font-serif italic mb-6 text-white/90">"The 24kt-pure pricing is the first time someone in this trade has been straight with me about gold costs. I quote the customer with confidence now."</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">AS</div>
                <div>
                  <div className="font-medium">A Shewah partner</div>
                  <div className="text-sm text-white/60">Surat, Gujarat</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 p-8 rounded-xl backdrop-blur-sm border border-white/20">
              <p className="text-xl font-serif italic mb-6 text-white/90">"Ready-to-Ship saved a wedding-season order for me. Customer wanted a pair of earrings the next day — I bid, paid, and they shipped that evening."</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">SP</div>
                <div>
                  <div className="font-medium">A Shewah partner</div>
                  <div className="text-sm text-white/60">Indore, Madhya Pradesh</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif mb-12 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Is there a joining fee or a monthly subscription?', a: 'No. There is no joining fee, no annual fee, no subscription. You pay only for the orders you place, at the trade price quoted upfront.' },
              { q: 'How long do orders take?', a: 'Catalog orders typically dispatch in 7–10 working days. Custom CAD orders take 14–21 working days end-to-end (CAD approval + production + QC). Ready-to-Ship inventory dispatches the next working day after payment.' },
              { q: 'What payment terms do you offer?', a: 'Standard terms are a 25% advance to start production, balance on dispatch (we share the tracking number). For Ready-to-Ship pieces, payment is on confirmation.' },
            ].map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <button 
                  className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-lg">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 bg-white text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Diamond className="w-5 h-5 text-white" />
              <span className="text-xl font-bold text-white tracking-tight">Shewah</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed">
              B2B diamond jewellery wholesale and manufacturing partner for independent Indian retailers.
            </p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>{BRAND.contactEmail}</li>
              <li>WhatsApp: +91 98765 43210</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Certifications</h4>
            <ul className="space-y-2 text-sm">
              <li>BIS Hallmark HUID</li>
              <li>Verify on IGI</li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-800 text-xs flex justify-between items-center">
          <p>© {new Date().getFullYear()} Shewah. All rights reserved.</p>
        </div>
      </footer>

      {/* Sticky Mobile CTA & Floating WhatsApp */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 md:hidden z-50 flex gap-4 shadow-[0_-4px_20px_rgb(0,0,0,0.05)]">
        <button 
          onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
          className="flex-1 bg-[#1E3A5F] text-white py-3.5 rounded-lg font-medium text-center"
        >
          Become a partner
        </button>
        <a 
          href="https://wa.me/919876543210"
          className="w-14 flex-shrink-0 bg-[#25D366] text-white rounded-lg flex items-center justify-center shadow-sm"
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      </div>

      {/* Desktop Floating WhatsApp */}
      <a 
        href="https://wa.me/919876543210"
        className="hidden md:flex fixed bottom-8 right-8 bg-[#25D366] text-white px-6 py-4 rounded-full shadow-lg items-center gap-3 font-medium hover:-translate-y-1 transition-transform z-50 hover:shadow-xl"
      >
        <MessageCircle className="w-5 h-5" />
        Chat on WhatsApp
      </a>
    </div>
  );
}
