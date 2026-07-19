'use client'

import { useState } from 'react'
import {
  Diamond, Check, Sparkles, Clock, ShieldCheck,
  Send, PhoneCall, MessageSquare, Video, ArrowRight,
  ChevronDown, MapPin, User, Mail, Sparkle, Loader2,
  CheckCircle2, Menu, X
} from 'lucide-react'

// FAQs Array matching copy deck
const FAQS = [
  {
    q: "What is a lab-grown diamond?",
    a: "A lab-grown diamond is a real diamond. It has the exact same optical, chemical, and physical qualities as a mined diamond. The only difference is that it is grown in a high-tech laboratory rather than pulled from the ground."
  },
  {
    q: "Are your diamonds certified?",
    a: "Yes. All our diamonds of significant size are certified by independent grading authorities such as the International Gemological Institute (IGI) or the Gemological Institute of America (GIA)."
  },
  {
    q: "How does the custom design process work?",
    a: "It begins with a free consultation. Once we map out your vision, we create a 3D digital model (CAD preview). You review this model, suggest changes, and approve the design before we start hand-crafting the physical piece."
  },
  {
    q: "How long does it take to make a custom piece?",
    a: "Typically, the process takes 15 to 25 business days from design approval to delivery. If you have an urgent date (like a proposal or anniversary), let us know during your consultation and we will try to accommodate it."
  },
  {
    q: "Can you work within my budget?",
    a: "Absolutely. Because we customize everything, we can adjust the gold weight, karat purity, and diamond specs to meet your budget targets while maintaining the premium look."
  },
  {
    q: "Do you use real gold?",
    a: "Yes. We exclusively use government-regulated BIS Hallmarked gold in 14-karat and 18-karat purities. You can choose yellow gold, rose gold, or white gold."
  },
  {
    q: "What if the size is wrong?",
    a: "We offer one complimentary resizing within 30 days of delivery for all rings where resizing is technically possible."
  },
  {
    q: "Do you offer a warranty?",
    a: "Every SHEWAH piece comes with a lifetime manufacturing warranty covering structural defects. We also provide free annual cleaning and stone tightening."
  },
  {
    q: "How is my jewellery shipped?",
    a: "We use fully insured, signature-required luxury courier services. Your package is tracked from our atelier straight to your doorstep in secure, unbranded shipping boxes."
  },
  {
    q: "Can I use my own stones or redesign old gold?",
    a: "We specialize in sourcing custom certified lab diamonds. During the consultation, we can evaluate options for integrating heirloom stones on a case-by-case basis."
  },
  {
    q: "Do you accept returns on custom orders?",
    a: "Because each piece is designed, sized, and handcrafted exclusively for a single client, custom orders are final. However, we walk you through digital 3D models and approvals before crafting to ensure you love it."
  },
  {
    q: "Is the consultation really free?",
    a: "Yes. The initial call, sketching phase, and project budget guidance are completely complimentary. There is no obligation to purchase."
  }
]

export default function ConsultationPage() {
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [occasion, setOccasion] = useState('')
  const [budget, setBudget] = useState('')
  const [jewelleryType, setJewelleryType] = useState('')
  const [preferredContact, setPreferredContact] = useState('whatsapp')
  
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Accordion state for FAQs
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const handleFaqToggle = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  const scrollToIntake = () => {
    const el = document.getElementById('intake-form')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !phone.trim() || !city.trim()) {
      setError('Please fill in your name, mobile number, and city.')
      return
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^(0|91)/, '')
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian WhatsApp number.')
      return
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          whatsapp: cleanPhone,
          email: email || null,
          city,
          occasion: occasion || null,
          budget: budget || null,
          jewellery_type: jewelleryType || null,
          preferred_contact: preferredContact,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit. Please try again.')
        return
      }

      setSuccess(true)
    } catch (err: any) {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative selection:bg-[#C5A880]/30 selection:text-white pb-16 lg:pb-0">
      
      {/* Sticky Top Branding Header */}
      <header className="sticky top-0 z-50 bg-[#070A11]/80 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30">
            <Diamond className="w-4 h-4 text-[#C5A880]" />
          </div>
          <span className="font-semibold text-lg tracking-widest text-[#F8FAFC]">SHEWAH</span>
        </div>
        <button 
          onClick={scrollToIntake}
          className="text-xs uppercase tracking-widest border border-[#C5A880]/40 text-[#C5A880] hover:bg-[#C5A880] hover:text-[#070A11] px-4 py-2 rounded-md transition-all duration-300 font-medium"
        >
          Book Consultation
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 md:py-32 px-6 md:px-12 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131B2E] via-[#070A11] to-[#070A11]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#C5A880]/10 border border-[#C5A880]/20 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A880]" />
              <span className="text-[10px] uppercase tracking-widest text-[#C5A880] font-semibold">Exclusively Made-to-Order</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal leading-tight text-white font-serif">
              We Do Not Sell Ready-Made Jewellery. <br />
              <span className="text-[#C5A880] italic">We Craft Your Story.</span>
            </h1>
            
            <p className="text-stone-300 text-base md:text-lg leading-relaxed max-w-xl font-light">
              Mass-produced jewellery carries no history. At SHEWAH, your most meaningful moments deserve an exclusive creation. Work hand-in-hand with our master designers to co-create a singular piece of art—crafted in solid hallmarked gold and brilliant, certified lab-grown diamonds. Tailored to your taste. Made entirely for you.
            </p>
            
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button 
                onClick={scrollToIntake}
                className="bg-[#C5A880] text-[#070A11] hover:bg-[#b0936e] px-8 py-4 rounded-lg font-medium text-sm tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#C5A880]/10"
              >
                Book Your Free Design Session <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500 italic mt-2">
              Zero pressure. Fully bespoke design preview before we begin crafting.
            </p>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="aspect-[4/5] w-full rounded-2xl border border-white/10 bg-[#0F1422] p-4 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              
              {/* Decorative design lines */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
              
              <div className="z-10 flex justify-between items-start">
                <span className="text-[10px] tracking-widest text-[#C5A880] uppercase font-mono">SPECIFICATION SHEETS</span>
                <span className="text-[10px] text-stone-500 font-mono">SHEWAH STUDIO v2.1</span>
              </div>

              {/* Central Diamond Illustration Placeholder */}
              <div className="flex-1 flex flex-col items-center justify-center relative py-6">
                <div className="w-48 h-48 border border-[#C5A880]/30 rounded-full flex items-center justify-center animate-[spin_60s_linear_infinite]">
                  <div className="w-40 h-40 border border-[#C5A880]/20 border-dashed rounded-full flex items-center justify-center">
                    <Diamond className="w-16 h-16 text-[#C5A880]/60" />
                  </div>
                </div>
                <div className="absolute bottom-4 text-center">
                  <p className="text-xs text-[#C5A880] font-mono">3D CAD MODEL GENERATION</p>
                  <p className="text-[10px] text-stone-500">PRECISION CLAW PLACEMENT</p>
                </div>
              </div>

              <div className="z-10 flex justify-between items-end border-t border-white/5 pt-3">
                <div>
                  <p className="text-[10px] text-stone-500">SETTING TYPE</p>
                  <p className="text-xs text-stone-300 font-medium">Bespoke Prong</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-500">GOLD WEIGHT</p>
                  <p className="text-xs text-[#C5A880] font-medium font-mono">Tailored to spec</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 px-6 md:px-12 bg-[#070A11] border-b border-white/5 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
            A Legacy Created, <span className="text-[#C5A880] italic">Not Merely Bought</span>
          </h2>
          <p className="text-stone-300 text-base md:text-lg leading-relaxed font-light">
            The finest piece of jewellery is not one that sits in a display case waiting for any passerby. It is the one that begins as a whisper of an idea in your mind, translates into an artist's sketch, and comes to life under the patient hands of a master karigar. 
          </p>
          <p className="text-stone-400 text-sm md:text-base leading-relaxed font-light">
            Ready-made jewellery forces you to compromise on scale, metal weight, or diamond purity. Custom design honors your personal narrative. When you choose custom, you choose to buy exactly what you want, built precisely how you want it, ensuring that the final heirloom holds a soul that matches the moment it celebrates.
          </p>
        </div>
      </section>

      {/* Lab Grown Diamonds Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0C111D] border-b border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Brilliance Reimagined: <br />
              <span className="text-[#C5A880] italic">Luxury Without Compromise</span>
            </h2>
            <p className="text-stone-300 text-base leading-relaxed font-light">
              We believe that luxury should be intelligent, transparent, and kind. Our certified lab-grown diamonds represent the future of fine jewellery. 
            </p>
            <p className="text-stone-400 text-sm leading-relaxed font-light">
              They are chemically, physically, and optically identical to mined diamonds. They possess the exact same hardness, refractive index, and fire. Yet, because they are grown in controlled environments using advanced technology, they are completely free from the environmental and ethical toll of traditional mining.
            </p>
            <p className="text-stone-400 text-sm leading-relaxed font-light">
              By choosing lab-grown diamonds, you redirect your investment away from expensive mining markups and toward superior diamond size, exceptional clarity, and meticulous custom craftsmanship. It is luxury refined.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#070A11] p-6 rounded-xl border border-white/5 space-y-2">
              <span className="text-[#C5A880] font-serif text-2xl font-semibold">100%</span>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Identical Beauty</p>
              <p className="text-xs text-stone-500">Same carbon structure, crystal grid, and brilliance as mined gems.</p>
            </div>
            <div className="bg-[#070A11] p-6 rounded-xl border border-white/5 space-y-2">
              <span className="text-[#C5A880] font-serif text-2xl font-semibold">IGI / GIA</span>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Fully Certified</p>
              <p className="text-xs text-stone-500">Every centerpiece diamond is independently certified and laser inscribed.</p>
            </div>
            <div className="bg-[#070A11] p-6 rounded-xl border border-white/5 space-y-2">
              <span className="text-[#C5A880] font-serif text-2xl font-semibold">Ethical</span>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Zero Mining</p>
              <p className="text-xs text-stone-500">Conflict-free origins that protect both human labor and the planet.</p>
            </div>
            <div className="bg-[#070A11] p-6 rounded-xl border border-white/5 space-y-2">
              <span className="text-[#C5A880] font-serif text-2xl font-semibold">3.5x</span>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Greater Value</p>
              <p className="text-xs text-stone-500">Acquire larger size and higher quality grade stones for the same pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The 5-Step Process */}
      <section className="py-24 px-6 md:px-12 bg-[#070A11] border-b border-white/5">
        <div className="max-w-6xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              The Journey of <span className="text-[#C5A880] italic">Creation</span>
            </h2>
            <p className="text-stone-400 text-sm max-w-lg mx-auto font-light">
              From an absolute blank sketch page to a custom solid gold masterpiece, mapped to your budget.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 text-left relative">
            
            {/* Step 1 */}
            <div className="space-y-4 bg-[#0F1422]/50 p-6 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30 text-[#C5A880] font-mono text-sm font-bold">
                01
              </div>
              <h3 className="text-lg font-medium text-white font-serif">Discover</h3>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                Begin with a private conversation. Share your ideas, reference photos, budget preferences, and stories with your dedicated design consultant.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 bg-[#0F1422]/50 p-6 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30 text-[#C5A880] font-mono text-sm font-bold">
                02
              </div>
              <h3 className="text-lg font-medium text-white font-serif">Design</h3>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                Our artists sketch your concept, helping you select the perfect diamond shape, karat weight, and metal color to balance beauty and budget.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 bg-[#0F1422]/50 p-6 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30 text-[#C5A880] font-mono text-sm font-bold">
                03
              </div>
              <h3 className="text-lg font-medium text-white font-serif">CAD Preview</h3>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                Examine a hyper-realistic 3D digital model of your jewellery. Adjust every angle until it matches your vision perfectly. We do not craft until you approve.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4 bg-[#0F1422]/50 p-6 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30 text-[#C5A880] font-mono text-sm font-bold">
                04
              </div>
              <h3 className="text-lg font-medium text-white font-serif">Craft</h3>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                Our experienced artisans hand-carve, set, and polish your piece using certified lab-grown diamonds and hallmarked gold in our private atelier.
              </p>
            </div>

            {/* Step 5 */}
            <div className="space-y-4 bg-[#0F1422]/50 p-6 rounded-xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#C5A880]/15 flex items-center justify-center border border-[#C5A880]/30 text-[#C5A880] font-mono text-sm font-bold">
                05
              </div>
              <h3 className="text-lg font-medium text-white font-serif">Deliver</h3>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                Your bespoke creation is hand-delivered to your door in custom premium packaging, accompanied by its independent certification and lifetime warranty.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Craftsmanship Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0C111D] border-b border-white/5">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
            Honoring the Hand of the <span className="text-[#C5A880] italic">Artisan</span>
          </h2>
          <p className="text-stone-300 text-base md:text-lg leading-relaxed font-light max-w-3xl mx-auto">
            In an age of instant gratification and high-speed machinery, SHEWAH preserves the slow, deliberate art of fine jewellery. Every setting is hand-carved. Every diamond prong is individually pushed. 
          </p>
          <p className="text-stone-400 text-sm leading-relaxed font-light max-w-2xl mx-auto">
            Our gems are hand-selected by GIA-trained gemologists who inspect each stone for fire, scintillation, and brilliance. Our gold is refined to exact standards and carries government-regulated hallmarking. We limit the number of commissions we accept each month to guarantee our master artisans have the time required to treat your piece as a masterpiece.
          </p>
          <div className="pt-6">
            <div className="inline-flex gap-8 justify-center items-center text-left text-xs uppercase tracking-widest text-stone-400 font-mono">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#C5A880]" />
                <span>Hand-Selected Diamonds</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#C5A880]" />
                <span>BIS Hallmarked Gold</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#C5A880]" />
                <span>Private Atelier Finishing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Custom Pieces */}
      <section className="py-24 px-6 md:px-12 bg-[#070A11] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Bespoke Inspiration: <span className="text-[#C5A880] italic">Popular Commissions</span>
            </h2>
            <p className="text-stone-400 text-sm max-w-md mx-auto font-light">
              Explore classic designs frequently commissioned by our clients and customized to their budgets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Engagement Rings</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  Designed to capture the promise of a lifetime. From timeless solitaire bands to elaborate halo and cluster settings, built around your chosen diamond shape.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>Oval, Round, Emerald cut</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Wedding Bands</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  Coordinated pairs or individual bands that nestle flush against your engagement ring, detailed with hidden gems, hand-engraving, or custom satin textures.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>Textured, Pave, Matching Pairs</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Tennis Bracelets</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  An uninterrupted line of matching, brilliant-cut lab diamonds chosen for identical color and clarity. Hand-linked for exceptional drape and weight.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>2.0ct to 10.0ct Total Weight</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Pendants & Necklaces</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  From delicate initials and halo lockets to statement drop collars. Crafted to sit perfectly against the collarbone.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>Solitaire or cluster settings</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 5 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Bridal Collars</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  Intricate, multi-carat designs curated for life’s most grand milestones. Flowing geometry that conforms beautifully to your movement.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>Custom Anniversary Collars</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 6 */}
            <div className="bg-[#0F1422] rounded-2xl overflow-hidden border border-white/5 flex flex-col justify-between group hover:border-[#C5A880]/30 transition-all duration-300">
              <div className="p-8 space-y-4">
                <h3 className="text-xl font-normal text-white font-serif">Earrings & Studs</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-light">
                  Classical drop earrings, modern hoops, or minimal studs. Designed with comfortable, secure backings for daily luxury or evening wear.
                </p>
              </div>
              <div className="p-8 pt-0 flex justify-between items-center text-xs tracking-wider uppercase text-[#C5A880]">
                <span>Claw set studs & drop styles</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0C111D] border-b border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">Authenticated Brilliance</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Every diamond above 0.5 carats is independently graded by international laboratories like IGI or GIA.
            </p>
          </div>

          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">BIS Hallmarked Purity</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              We work exclusively with certified 18k and 14k gold, ensuring your investment retains its lifetime value.
            </p>
          </div>

          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">Value-Driven Design</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              We select diamond carat size and metal weight combinations to match your target budget without compromising beauty.
            </p>
          </div>

          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">Single-Run Commissions</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Your piece will never be replicated or sold to another customer. The design template is yours alone.
            </p>
          </div>

          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">Transparent Pricing</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Receive a line-item breakdown of gold weight, diamond value, and labor. No hidden fees or inflated retail markups.
            </p>
          </div>

          <div className="space-y-2 border-l border-[#C5A880]/30 pl-6">
            <h4 className="text-[#F8FAFC] font-medium font-serif">Lifetime Care</h4>
            <p className="text-xs text-stone-400 leading-relaxed font-light">
              Complimentary yearly prong checks, professional deep cleaning, and minor resizing to keep your piece pristine.
            </p>
          </div>

        </div>
      </section>

      {/* Social Proof Stats & Reviews */}
      <section className="py-24 px-6 md:px-12 bg-[#070A11] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center border-y border-white/5 py-12">
            <div>
              <p className="text-4xl md:text-5xl font-normal text-[#C5A880] font-serif">500+</p>
              <p className="text-xs text-stone-400 uppercase tracking-widest mt-2">Custom Pieces Crafted</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-normal text-[#C5A880] font-serif">98%</p>
              <p className="text-xs text-stone-400 uppercase tracking-widest mt-2">Client Satisfaction Rating</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-normal text-[#C5A880] font-serif">100%</p>
              <p className="text-xs text-stone-400 uppercase tracking-widest mt-2">Ethical, Certified Diamonds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#0F1422] p-8 rounded-xl border border-white/5 space-y-4">
              <p className="text-stone-300 text-xs italic leading-relaxed font-light">
                "I was hesitant about ordering a custom ring online, but the CAD preview changed everything. Seeing the exact dimensions before production gave me total confidence. The final ring exceeded every expectation. It is breathtaking."
              </p>
              <div>
                <p className="text-xs font-semibold text-white">Rohan S.</p>
                <p className="text-[10px] text-[#C5A880]">Mumbai</p>
              </div>
            </div>
            <div className="bg-[#0F1422] p-8 rounded-xl border border-white/5 space-y-4">
              <p className="text-stone-300 text-xs italic leading-relaxed font-light">
                "SHEWAH helped me design a custom diamond bracelet for my wife. They worked with my budget and sourced the most beautiful matching emerald-cut diamonds. The transparency of costs was refreshing."
              </p>
              <div>
                <p className="text-xs font-semibold text-white">Priya M.</p>
                <p className="text-[10px] text-[#C5A880]">Bangalore</p>
              </div>
            </div>
            <div className="bg-[#0F1422] p-8 rounded-xl border border-white/5 space-y-4">
              <p className="text-stone-300 text-xs italic leading-relaxed font-light">
                "The craftsmanship is evident in the weight of the gold and the fire of the diamonds. It feels like a true luxury experience, personal and highly professional."
              </p>
              <div>
                <p className="text-xs font-semibold text-white">Anjali K.</p>
                <p className="text-[10px] text-[#C5A880]">Delhi</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0C111D] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-normal font-serif text-white">
              Bespoke Design: <span className="text-[#C5A880] italic">Common Questions</span>
            </h2>
            <p className="text-stone-400 text-sm font-light">
              Everything you need to know about commissioning custom lab-grown diamond jewellery.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = expandedFaq === idx
              return (
                <div key={idx} className="border-b border-white/5 pb-4">
                  <button
                    onClick={() => handleFaqToggle(idx)}
                    className="w-full flex justify-between items-center text-left py-3 text-stone-200 hover:text-white transition-colors"
                  >
                    <span className="font-medium text-sm md:text-base font-serif">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#C5A880] transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-xs md:text-sm text-stone-400 leading-relaxed font-light pt-2 pl-1 transition-opacity duration-300">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Lead Generation Intake Section */}
      <section id="intake-form" className="py-24 px-6 md:px-12 bg-[#070A11] border-b border-white/5 scroll-mt-16">
        <div className="max-w-xl mx-auto space-y-8">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">Begin Your Bespoke Commission</h2>
            <p className="text-stone-400 text-sm font-light">
              Reserve your complimentary private consultation with a SHEWAH design expert. Let us bring your ideas to life.
            </p>
          </div>

          <div className="bg-[#0F1422] p-8 md:p-10 rounded-2xl border border-white/5 shadow-2xl relative">
            
            {success ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-normal font-serif text-white">Consultation Reserved</h3>
                <p className="text-stone-300 text-xs leading-relaxed max-w-sm mx-auto font-light">
                  Thank you. Your details have been securely logged. A dedicated SHEWAH design consultant will reach out via <span className="text-[#C5A880] font-semibold capitalize">{preferredContact}</span> within 24 hours to schedule your digital sketch preview.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {error && (
                  <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-3 text-xs">
                    {error}
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-4">
                  
                  {/* Name */}
                  <div className="relative">
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">First Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-[#C5A880] transition-colors"
                        required
                      />
                      <User className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-600" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">WhatsApp Mobile Number *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="10-digit Indian mobile"
                        className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-[#C5A880] transition-colors"
                        required
                      />
                      <PhoneCall className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-600" />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">Email Address (Optional)</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-[#C5A880] transition-colors"
                      />
                      <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-600" />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">City *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Your location"
                        className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-[#C5A880] transition-colors"
                        required
                      />
                      <MapPin className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-600" />
                    </div>
                  </div>

                  {/* Occasion */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">Occasion</label>
                    <select
                      value={occasion}
                      onChange={e => setOccasion(e.target.value)}
                      className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C5A880] transition-colors appearance-none"
                    >
                      <option value="">Select occasion</option>
                      <option value="Engagement">Engagement</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Anniversary">Anniversary</option>
                      <option value="Self-Reward">Self-Reward</option>
                      <option value="Gift">Gift</option>
                    </select>
                  </div>

                  {/* Jewellery Type */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">Jewellery Type</label>
                    <select
                      value={jewelleryType}
                      onChange={e => setJewelleryType(e.target.value)}
                      className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C5A880] transition-colors appearance-none"
                    >
                      <option value="">Select type</option>
                      <option value="Ring">Ring</option>
                      <option value="Bracelet">Bracelet</option>
                      <option value="Pendant/Necklace">Pendant/Necklace</option>
                      <option value="Earrings">Earrings</option>
                      <option value="Full Set">Full Set</option>
                    </select>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-1.5 font-semibold">Target Budget Range</label>
                    <select
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className="w-full bg-[#070A11] border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C5A880] transition-colors appearance-none"
                    >
                      <option value="">Select budget range</option>
                      <option value="₹50,000 - ₹1,00,000">₹50,000 - ₹1,00,000</option>
                      <option value="₹1,00,000 - ₹2,00,000">₹1,00,000 - ₹2,00,000</option>
                      <option value="₹2,00,000 - ₹5,00,000">₹2,00,000 - ₹5,00,000</option>
                      <option value="₹5,00,000+">₹5,00,000+</option>
                    </select>
                  </div>

                  {/* Contact Method */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C5A880] mb-2 font-semibold">Preferred Consultation Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      
                      <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'whatsapp' ? 'border-[#C5A880] bg-[#C5A880]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
                        <input
                          type="radio"
                          name="contact"
                          value="whatsapp"
                          checked={preferredContact === 'whatsapp'}
                          onChange={() => setPreferredContact('whatsapp')}
                          className="sr-only"
                        />
                        <MessageSquare className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">WhatsApp</span>
                      </label>

                      <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'phone' ? 'border-[#C5A880] bg-[#C5A880]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
                        <input
                          type="radio"
                          name="contact"
                          value="phone"
                          checked={preferredContact === 'phone'}
                          onChange={() => setPreferredContact('phone')}
                          className="sr-only"
                        />
                        <PhoneCall className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">Phone Call</span>
                      </label>

                      <label className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'email' ? 'border-[#C5A880] bg-[#C5A880]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
                        <input
                          type="radio"
                          name="contact"
                          value="email"
                          checked={preferredContact === 'email'}
                          onChange={() => setPreferredContact('email')}
                          className="sr-only"
                        />
                        <Video className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">Video Call</span>
                      </label>

                    </div>
                  </div>

                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#C5A880] text-[#070A11] hover:bg-[#b0936e] py-4 rounded-lg font-medium text-xs uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <span>Book My Free Consultation</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-stone-500 text-center leading-none">
                  We respect your privacy. No spam. No obligation.
                </p>

              </form>
            )}

          </div>

        </div>
      </section>

      {/* Final Close */}
      <section className="py-24 px-6 md:px-12 bg-[#0C111D] text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
            Do Not Just Buy Jewellery. <span className="text-[#C5A880] italic">Create an Heirloom.</span>
          </h2>
          <p className="text-stone-300 text-sm md:text-base leading-relaxed font-light max-w-xl mx-auto">
            A beautiful design catches the eye. A custom masterpiece holds your history. Whether it is a promise of forever or a milestone of personal success, let it be told in gold and diamonds that reflect your values. Step into the studio and design a piece that will live on for generations.
          </p>
          <div className="pt-4">
            <button
              onClick={scrollToIntake}
              className="bg-transparent border border-[#C5A880] hover:bg-[#C5A880] text-[#C5A880] hover:text-[#070A11] px-8 py-4 rounded-lg font-medium text-xs tracking-widest uppercase transition-all duration-300 inline-flex items-center gap-2"
            >
              <span>Reserve Your Design Session</span>
              <Sparkle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#070A11] py-8 text-center text-[10px] text-stone-600 border-t border-white/5 uppercase tracking-widest">
        <p>&copy; {new Date().getFullYear()} SHEWAH. ALL RIGHTS RESERVED. PRIVATE ATELIER BY CONCIERGE.</p>
      </footer>

      {/* Sticky Mobile Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070A11]/90 backdrop-blur-md border-t border-white/5 p-3 flex justify-center items-center safe-area-pb">
        <button
          onClick={scrollToIntake}
          className="w-full bg-[#C5A880] text-[#070A11] hover:bg-[#b0936e] py-3 rounded-lg font-medium text-xs tracking-wider uppercase text-center transition-colors duration-300 flex items-center justify-center gap-2"
        >
          <span>Book Free Design Consultation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  )
}
