import React, { useState } from 'react';
import { MessageCircle, Diamond, X, Check, ArrowRight, ChevronDown } from 'lucide-react';

const FAQS = [
  { q: 'Is there a joining fee or monthly subscription?', a: 'No. Zero joining fee, zero monthly. You pay only for the orders you place, at the trade price quoted upfront. That is the whole pitch.' },
  { q: 'Do I have to commit to exclusivity or volume?', a: 'No. Keep your existing vendors. Order one piece a month or fifty — we do not set a floor or a ceiling.' },
  { q: 'What payment terms do you offer?', a: '25% advance to start production, balance on dispatch with the tracking number. Ready-to-Ship pieces are paid on confirmation. Custom terms after a few orders together.' },
  { q: 'How long do orders actually take?', a: 'Catalog orders dispatch in 7–10 working days. Custom CAD takes 14–21 working days end-to-end. Ready-to-Ship dispatches the next working day after payment. No "we will try".' },
  { q: 'What if my customer wants a return or rework?', a: 'Manufacturing defects are reworked or replaced free. Customer-driven changes are quoted at our karigar\'s labour rate — no surprise markups.' },
];

export default function ProblemFirstVariant() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  return (
    <div className="min-h-screen bg-[#FDFDFC] text-[#0A0A0A] font-sans selection:bg-[#1E3A5F] selection:text-white">
      {/* Header */}
      <header className="px-6 py-5 border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#1E3A5F] font-bold text-xl tracking-tight">
            <Diamond className="w-5 h-5" fill="currentColor" />
            SHEWAH
          </div>
          <a href="https://wa.me/919876543210" className="hidden md:flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-[#1DA851] transition-colors">
            <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
          </a>
        </div>
      </header>

      {/* Problem-First Hero */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#0A0A0A] mb-8 leading-[1.1]">
            Stop guessing what your supplier is really charging you.
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            No more "billing weight" games. No more opaque pricing. We are the diamond manufacturing partner for independent Indian jewellers who want straight answers and fast execution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://wa.me/919876543210" className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-md font-bold text-lg hover:bg-[#1DA851] transition-colors shadow-lg shadow-green-500/20">
              <MessageCircle className="w-6 h-6" /> Talk on WhatsApp
            </a>
            <a href="#compare" className="flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-800 px-8 py-4 rounded-md font-bold text-lg hover:border-gray-300 transition-colors">
              See the difference
            </a>
          </div>
        </div>
      </section>

      {/* Trust band — directly under hero */}
      <section className="bg-[#1E3A5F] text-white py-8 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
          <div className="md:border-r border-white/15 md:pr-6">
            <p className="text-2xl font-bold leading-none">12,000+</p>
            <p className="text-xs uppercase tracking-wider text-white/60 mt-1">Pieces shipped</p>
          </div>
          <div className="md:border-r border-white/15 md:pr-6">
            <p className="text-2xl font-bold leading-none">180+</p>
            <p className="text-xs uppercase tracking-wider text-white/60 mt-1">Karigars on network</p>
          </div>
          <div className="md:border-r border-white/15 md:pr-6">
            <p className="text-2xl font-bold leading-none">64</p>
            <p className="text-xs uppercase tracking-wider text-white/60 mt-1">Cities served</p>
          </div>
          <div className="md:border-r border-white/15 md:pr-6">
            <p className="text-sm font-bold leading-tight">BIS Hallmark</p>
            <a href="#" className="text-[11px] uppercase tracking-wider text-white/60 mt-1 hover:text-white">HUID on every piece →</a>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">IGI Graded</p>
            <a href="#" className="text-[11px] uppercase tracking-wider text-white/60 mt-1 hover:text-white">Verify on igi.org →</a>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="compare" className="py-20 px-6 bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">The standard way vs The Shewah way</h2>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-100 border-b border-gray-200">
              <div className="p-6 font-semibold text-gray-500">Feature</div>
              <div className="p-6 font-bold text-gray-800 border-l border-gray-200">Typical Supplier</div>
              <div className="p-6 font-bold text-[#1E3A5F] border-l border-gray-200 bg-[#1E3A5F]/5">Shewah</div>
            </div>
            
            {[
              { label: 'Gold Pricing', old: '"Billing weight" markups', new: 'Pure 24kt rate + transparent labour' },
              { label: 'Diamond Costs', old: 'Hidden in total price', new: 'Line-item broken down' },
              { label: 'CAD Turnaround', old: '1-2 weeks if they bother', new: '48 hours guaranteed' },
              { label: 'Order Tracking', old: 'Calling to check status', new: 'Real-time WhatsApp updates' },
              { label: 'Urgent Orders', old: '"We will try"', new: 'Live Ready-to-Ship marketplace' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-3 border-b border-gray-100 last:border-0">
                <div className="p-6 text-sm font-medium text-gray-600 flex items-center">{row.label}</div>
                <div className="p-6 text-sm text-gray-500 border-l border-gray-100 flex items-start gap-3">
                  <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  {row.old}
                </div>
                <div className="p-6 text-sm font-semibold text-[#1E3A5F] border-l border-gray-100 bg-[#1E3A5F]/[0.02] flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  {row.new}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full Bleed Navy Section - Value Props */}
      <section className="bg-[#1E3A5F] py-24 px-6 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <h3 className="text-xl font-bold mb-3">Live Catalog</h3>
              <p className="text-white/70 text-sm leading-relaxed">Browse hundreds of designs on your phone, with pricing quoted at today's 24K rate. Shortlist and share directly with your customer.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3">Custom CAD</h3>
              <p className="text-white/70 text-sm leading-relaxed">Don't lose a sale because of slow suppliers. Send us a brief, we turn around renders in 48 hours for your customer to approve.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3">Ready-to-Ship</h3>
              <p className="text-white/70 text-sm leading-relaxed">When they need it tomorrow, browse our cancelled-but-finished inventory. Bid, pay, and we ship the same day.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-3">WhatsApp Native</h3>
              <p className="text-white/70 text-sm leading-relaxed">No clunky portals. Get order updates, CAD approvals, and dispatch alerts right on the WhatsApp number you already use.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-bold mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From a WhatsApp ping to your first dispatched order — under two weeks.</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8 md:gap-6">
            {[
              { n: '01', t: 'Tell us about your store', b: 'One quick form, or just message us. A partner manager replies on WhatsApp inside one business day.' },
              { n: '02', t: '20-minute onboarding call', b: 'We set your trade pricing, unlock the catalog and Ready-to-Ship feed on your phone, and answer everything.' },
              { n: '03', t: 'Place the first order', b: 'Catalog, custom CAD, or a Ready-to-Ship bid. 25% advance starts production. The rest on dispatch.' },
              { n: '04', t: 'Track it on WhatsApp', b: 'Production updates, photos at QC, and a courier tracking link — all on the number you signed up with.' },
            ].map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-3xl font-bold text-[#1E3A5F]">{s.n}</span>
                  {i < 3 && <ArrowRight className="hidden md:block w-4 h-4 text-gray-300 ml-auto" />}
                </div>
                <h3 className="font-bold text-base mb-2">{s.t}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-24 px-6 bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-bold mb-3">Partners speak plainly</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Not "5-star reviews". Real jewellers, real cities, real problems we fixed.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: 'The 24kt-pure pricing is the first time someone in this trade has been straight with me about gold costs. I quote the customer with confidence now.', n: 'Owner, retail jeweller', c: 'Surat, Gujarat' },
              { q: 'Ready-to-Ship saved a wedding-season order for me. Customer wanted a pair of earrings the next day — I bid, paid, and they shipped that evening.', n: 'Owner, retail jeweller', c: 'Indore, Madhya Pradesh' },
              { q: 'My old supplier disappeared for a week mid-order. Shewah\'s WhatsApp updates mean I never have to chase. I just forward the dispatch link to my customer.', n: 'Owner, retail jeweller', c: 'Coimbatore, Tamil Nadu' },
            ].map((t) => (
              <figure key={t.q} className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
                <blockquote className="text-[15px] leading-relaxed text-gray-800 flex-1">&ldquo;{t.q}&rdquo;</blockquote>
                <figcaption className="mt-5 pt-5 border-t border-gray-100 text-xs">
                  <p className="font-bold text-[#1E3A5F]">{t.n}</p>
                  <p className="text-gray-500 mt-0.5">{t.c}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.18em] text-[#1E3A5F] font-bold mb-3">Straight answers</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">The questions you were going to ask anyway.</h2>
          </div>
          <div className="border-t border-gray-200">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="border-b border-gray-200">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="w-full text-left py-5 flex items-start justify-between gap-4">
                    <span className="font-bold text-gray-900">{f.q}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="pb-6 text-[15px] text-gray-600 leading-relaxed">{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-24 px-6 bg-white" id="form">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Let's fix your supply chain.</h2>
            <p className="text-gray-600">Enter your details or just ping us on WhatsApp. We'll set you up with trade pricing in 20 minutes.</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-[0_0_40px_rgb(0,0,0,0.05)] border border-gray-200">
            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Name</label>
                <input type="text" className="w-full p-3 rounded-md bg-gray-50 border border-gray-200 focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp Number</label>
                <div className="flex">
                  <span className="bg-gray-100 border border-r-0 border-gray-200 px-4 py-3 rounded-l-md text-gray-500 font-medium">+91</span>
                  <input type="tel" className="w-full p-3 rounded-r-md bg-gray-50 border border-gray-200 focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">City</label>
                <input type="text" className="w-full p-3 rounded-md bg-gray-50 border border-gray-200 focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] outline-none" />
              </div>
              <button className="w-full bg-[#1E3A5F] text-white font-bold py-4 rounded-md mt-6 hover:bg-[#152943] transition-colors flex items-center justify-center gap-2">
                Request Access <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-4">Prefer to skip the form?</p>
              <a href="https://wa.me/919876543210" className="inline-flex items-center justify-center gap-2 text-[#25D366] font-bold hover:underline">
                <MessageCircle className="w-5 h-5" /> Chat directly on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white font-bold tracking-tight">
            <Diamond className="w-5 h-5" fill="currentColor" />
            SHEWAH
          </div>
          <div className="text-sm text-center md:text-left">
            No joining fee. No exclusivity. BIS Hallmarked. IGI Graded.
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} Shewah. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-gray-200 md:hidden z-50">
        <a 
          href="https://wa.me/919876543210"
          className="w-full bg-[#25D366] text-white font-bold py-4 rounded-md flex items-center justify-center gap-2 shadow-lg"
        >
          <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
