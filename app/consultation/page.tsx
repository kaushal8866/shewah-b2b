'use client'

import { useState, useEffect } from 'react'
import {
  Diamond, Check, Sparkles, Clock, ShieldCheck,
  Send, PhoneCall, MessageSquare, Video, ArrowRight,
  ChevronDown, MapPin, User, Mail, Sparkle, Loader2,
  CheckCircle2, Compass, PenTool, Layout, Hammer, Gift,
  Calendar, Award, Lock, Eye, RefreshCw, Star
} from 'lucide-react'

// FAQ list with premium answers
const FAQS = [
  {
    q: "How does the consultation work?",
    a: "It is a private, relaxed conversation. We begin by learning about your story, aesthetic preferences, and occasion. Together, we explore design shapes, metal choices, and stone sizes to outline a concept that matches your vision."
  },
  {
    q: "Is the consultation complimentary?",
    a: "Yes. Our initial discovery calls, style consults, and custom sketches are fully complimentary. We believe you should explore the possibilities of custom design with zero friction."
  },
  {
    q: "What happens after I submit the form?",
    a: "A dedicated design consultant will reach out via your preferred method (WhatsApp, phone, or video) within 24 hours. We will introduce ourselves, ask a few clarifying questions, and begin planning your design sketch."
  },
  {
    q: "Can I create a completely unique design?",
    a: "Absolutely. Every commission we accept starts as a completely clean canvas. We design from scratch specifically around your input, ensuring your piece exists for no one else."
  },
  {
    q: "Can you recreate a design I've seen elsewhere?",
    a: "We can use reference photos of designs you admire as inspiration. However, we do not copy other designers' work directly. Instead, we refine and adapt the details to craft a unique version tailored specifically to you."
  },
  {
    q: "How long does the process take?",
    a: "Typically, the journey takes 15 to 25 business days from design approval to delivery. For complex heirloom commissions, we recommend starting at least 6 weeks in advance of your occasion."
  },
  {
    q: "What if I don't like the first design?",
    a: "That is completely normal. The design phase is collaborative. We present sketches and digital models specifically to get your feedback. We will alter the details until it is exactly what you want."
  },
  {
    q: "Are revisions included?",
    a: "Yes. We offer unlimited digital design modifications during the CAD phase. We do not place the gold into the crucible or set any diamonds until you have given your final, written approval."
  },
  {
    q: "Are lab-grown diamonds real?",
    a: "Yes. They are physically, chemically, and optically identical to mined diamonds. They are made of pure carbon crystallized under high heat and pressure, carrying the same hardness (10 on Mohs scale) and refractive brilliance."
  },
  {
    q: "Are your diamonds certified?",
    a: "Yes. Every center gem we source is independently graded and certified by leading gemological institutions like the International Gemological Institute (IGI) or the Gemological Institute of America (GIA)."
  },
  {
    q: "Do you also work with natural diamonds?",
    a: "We specialize in certified lab-grown diamonds due to their superior value and conflict-free origins. However, upon special request, we can source ethically mined natural diamonds for your commission."
  },
  {
    q: "Is my budget respected?",
    a: "Always. Designing custom jewelry allows us to control the materials. We can adjust the gold weight, karat purity, and diamond specifications to align with your investment targets without compromising the visual beauty."
  },
  {
    q: "Can you work remotely?",
    a: "Yes, the majority of our clients co-create their pieces remotely. We hold consultations over video call, send digital sketch files, and share high-definition 3D CAD renders that show every angle of the piece."
  },
  {
    q: "Is my consultation confidential?",
    a: "Yes. All commissions, design ideas, and personal details shared during our calls remain strictly private and confidential. We respect the personal nature of bespoke jewelry."
  },
  {
    q: "How is the jewellery delivered?",
    a: "We use fully insured, signature-required luxury courier services. Your bespoke piece is shipped in secure, unbranded packaging to guarantee safe transit and preserve any surprise."
  },
  {
    q: "Do you provide aftercare?",
    a: "Yes. Every commission includes our lifetime commitment. This includes complimentary deep cleaning, yearly stone tightening checks, and one free ring resizing within 30 days of receipt."
  },
  {
    q: "Can I commission jewellery as a gift?",
    a: "Yes. A custom piece is the ultimate gift. We can work secretly with you, keeping the design hidden, and package it beautifully with custom initials or engraving."
  },
  {
    q: "Can I redesign inherited jewellery?",
    a: "We evaluate heirloom redesigns on a case-by-case basis. During your discovery call, we can discuss resetting existing family gems into a modern, custom gold setting."
  }
]

// Interactive Client Journey Stages
const JOURNEY_STAGES = [
  {
    id: "dream",
    title: "Dream",
    desc: "A client from Bangalore wanted a ring that captured the architecture of the Florence Cathedral, where they got engaged.",
    imageText: "Reference notes, arch photos, and hand-sketched styling cues."
  },
  {
    id: "moodboard",
    title: "Moodboard",
    desc: "We curated geometric details, Gothic arches, and select diamond cuts that matched the cathedral's stone carvings.",
    imageText: "Curation of design details, metal textures, and raw gem placement."
  },
  {
    id: "sketch",
    title: "Hand Sketch",
    desc: "Our designer created three hand-drawn variations showing different band profiles and diamond orientation options.",
    imageText: "Finished pencil sketches with dimensional guides."
  },
  {
    id: "cad",
    title: "CAD Preview",
    desc: "A hyper-realistic 3D digital render was generated. The client adjusted the height of the center claw for a lower profile.",
    imageText: "Wireframe models and textured rendering previews."
  },
  {
    id: "craft",
    title: "Craft",
    desc: "Our master goldsmiths cast the band in 18k yellow gold, hand-setting the 2.5-carat oval lab-grown center stone.",
    imageText: "Artisan placing diamonds under magnifying loupes."
  },
  {
    id: "proposal",
    title: "Proposal",
    desc: "The ring was delivered in a custom leather case, ready for a surprise sunset anniversary dinner.",
    imageText: "Unboxing moments and emotional client feedback."
  },
  {
    id: "wedding",
    title: "Wedding",
    desc: "We later crafted a nested wedding band designed to slide flush against the cathedral prongs.",
    imageText: "Matching bridal set resting on textured linen."
  },
  {
    id: "lifetime",
    title: "Lifetime",
    desc: "Annual cleaning and prong checks ensure this custom heirloom maintains its cathedral brilliance forever.",
    imageText: "Polishing wheel reflections and certification cards."
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
  
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [selectedJourneyStage, setSelectedJourneyStage] = useState(0)
  
  // Navigation active indicators
  const [showStickyNav, setShowStickyNav] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  // Track scroll for sticky nav and progress bar
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100)
      }
      
      if (window.scrollY > 400) {
        setShowStickyNav(true)
      } else {
        setShowStickyNav(false)
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleFaqToggle = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  const scrollToIntake = () => {
    const el = document.getElementById('intake-form')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
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
    <div className="relative selection:bg-[#C8A46B]/30 selection:text-white pb-20 lg:pb-0 min-h-screen bg-[#111111] text-[#F8F6F2] font-sans antialiased">
      
      {/* Scroll Progress Bar */}
      <div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#C8A46B] z-50 transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/918866579547?text=Hi%20Shewah,%20I'd%20like%20to%20know%20more%20about%20your%20custom%20jewellery%20design%20consultations."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 bg-[#1A1A1A] border border-[#C8A46B]/30 p-3.5 rounded-full text-[#C8A46B] hover:text-white hover:bg-[#C8A46B] transition-all duration-300 shadow-xl shadow-black/50 flex items-center justify-center"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      {/* Sticky Navigation bar */}
      <nav className={`fixed top-0 left-0 right-0 z-40 bg-[#111111]/90 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center transition-all duration-300 ${showStickyNav ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C8A46B]/15 flex items-center justify-center border border-[#C8A46B]/30">
            <Diamond className="w-3.5 h-3.5 text-[#C8A46B]" />
          </div>
          <span className="font-semibold text-base tracking-widest text-[#F8F6F2]">SHEWAH</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest text-[#7A7A7A]">
          <button onClick={() => scrollToSection('about')} className="hover:text-[#C8A46B] transition-colors">About</button>
          <button onClick={() => scrollToSection('process')} className="hover:text-[#C8A46B] transition-colors">Process</button>
          <button onClick={() => scrollToSection('stories')} className="hover:text-[#C8A46B] transition-colors">Design Stories</button>
          <button onClick={() => scrollToSection('faq')} className="hover:text-[#C8A46B] transition-colors">FAQ</button>
        </div>

        <button 
          onClick={scrollToIntake}
          className="text-xs uppercase tracking-widest border border-[#C8A46B] text-[#C8A46B] hover:bg-[#C8A46B] hover:text-[#111111] px-5 py-2.5 rounded transition-all duration-300 font-medium"
        >
          Book Consultation
        </button>
      </nav>

      {/* SECTION 1: Hero (The Invitation) */}
      <section className="relative min-h-[90vh] flex flex-col justify-center py-20 px-6 md:px-12 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1E1E1E] via-[#111111] to-[#111111]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="inline-flex items-center gap-2.5 bg-[#1A1A1A] border border-white/5 px-4 py-1.5 rounded-full">
              <Sparkle className="w-3.5 h-3.5 text-[#C8A46B]" />
              <span className="text-[10px] uppercase tracking-widest text-[#C8A46B] font-semibold">Bespoke Design Studio</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.1] text-[#F8F6F2] font-serif">
              Every Extraordinary Piece <br className="hidden md:inline" />
              Begins With a <span className="text-[#C8A46B] italic">Conversation.</span>
            </h1>

            <p className="text-[#7A7A7A] text-base md:text-lg leading-relaxed max-w-xl font-light">
              The most meaningful jewellery is never selected from a display. It begins with your story. At SHEWAH, every commission starts with a private design consultation where we understand your vision, refine every detail together, and create a piece that exists for no one else.
            </p>

            {/* Trust bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2 text-[10px] uppercase tracking-widest text-[#F8F6F2] font-mono border-t border-b border-white/5 pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#C8A46B]" />
                <span>IGI Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#C8A46B]" />
                <span>BIS Hallmarked</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#C8A46B]" />
                <span>CAD Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#C8A46B]" />
                <span>Secure Delivery</span>
              </div>
            </div>

            <div className="pt-2 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <button 
                  onClick={scrollToIntake}
                  className="bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-[#C8A46B]/5"
                >
                  Book Your Complimentary Design Consultation <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#7A7A7A] italic">
                No obligation. Crafted only after your complete approval.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="aspect-[4/5] w-full rounded-xl border border-white/5 bg-[#1A1A1A] p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              
              <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]"></div>
              
              <div className="flex justify-between items-start text-[10px] tracking-widest text-[#C8A46B] uppercase font-mono">
                <span>STUDIO SKETCH SHEET</span>
                <span>COMMISSION #099</span>
              </div>

              {/* Hand Drawn Design Concept Render */}
              <div className="flex-1 flex flex-col items-center justify-center py-6 relative">
                <div className="w-52 h-52 border border-[#C8A46B]/15 rounded-full flex items-center justify-center">
                  <div className="w-40 h-40 border border-[#C8A46B]/10 border-dashed rounded-full flex items-center justify-center relative">
                    <Diamond className="w-20 h-20 text-[#C8A46B]/40" />
                  </div>
                </div>
                <p className="absolute bottom-6 text-[10px] text-[#7A7A7A] uppercase tracking-widest font-mono">CAD GEOMETRY ACTIVE</p>
              </div>

              <div className="flex justify-between items-end border-t border-white/5 pt-4 text-xs font-mono text-[#F8F6F2]">
                <div>
                  <p className="text-[10px] text-[#7A7A7A] uppercase tracking-widest">DESIGN FOCUS</p>
                  <p className="font-semibold text-stone-300">Custom Setting</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#7A7A7A] uppercase tracking-widest">GEM SPEC</p>
                  <p className="text-[#C8A46B] font-semibold">Exquisite Fire</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: What Happens After You Book? */}
      <section id="process" className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              From Your First Conversation <br />
              <span className="text-[#C8A46B] italic">To Your Forever Piece.</span>
            </h2>
            <p className="text-[#7A7A7A] text-sm max-w-md mx-auto font-light">
              An elegant co-creation sequence designed to put you at the center of the journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-6 text-left">
            
            {/* Step 1 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">01 / Booking</div>
              <h3 className="text-base font-semibold text-white">Book Consultation</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Submit a few initial details to coordinate your session.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">02 / Discovery</div>
              <h3 className="text-base font-semibold text-white">Private Discovery</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                We learn your story, preferences, and design ideas.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">03 / Consultation</div>
              <h3 className="text-base font-semibold text-white">Design Consult</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Discuss gemstone shapes, color values, and gold karat weights.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">04 / Preview</div>
              <h3 className="text-base font-semibold text-white">CAD Preview</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Visualize every detail with realistic 3D renderings before crafting.
              </p>
            </div>

            {/* Step 5 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">05 / Refinement</div>
              <h3 className="text-base font-semibold text-white">Refine Together</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Enjoy unlimited tweaks to the design until it matches perfectly.
              </p>
            </div>

            {/* Step 6 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">06 / Crafting</div>
              <h3 className="text-base font-semibold text-white">Crafting</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Master karigars cast, assemble, and hand-finish your piece.
              </p>
            </div>

            {/* Step 7 */}
            <div className="space-y-4 p-6 bg-[#111111] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all">
              <div className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">07 / Arrival</div>
              <h3 className="text-base font-semibold text-white">Luxury Delivery</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Securely shipped directly to your hands in premium boxes.
              </p>
            </div>

          </div>

          <div className="text-center pt-4">
            <button 
              onClick={scrollToIntake}
              className="bg-transparent border border-[#C8A46B] text-[#C8A46B] hover:bg-[#C8A46B] hover:text-[#111111] px-8 py-4 rounded text-xs tracking-widest uppercase transition-all duration-300 font-medium"
            >
              Reserve My Consultation
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3: Why Custom? */}
      <section id="about" className="py-24 px-6 md:px-12 bg-[#111111] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              The Difference Between Buying Jewellery <br />
              <span className="text-[#C8A46B] italic">And Creating It.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Column 1 - Buying */}
            <div className="bg-[#1A1A1A] p-8 rounded border border-white/5 space-y-6">
              <h3 className="text-lg font-serif text-[#7A7A7A] uppercase tracking-widest border-b border-white/5 pb-3">Buying Jewellery</h3>
              <ul className="space-y-4 text-sm text-[#7A7A7A] font-light">
                <li className="flex items-start gap-3">
                  <span className="text-red-500/60 mt-0.5">✕</span>
                  <span>Choose only from what is currently available on display.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500/60 mt-0.5">✕</span>
                  <span>Adjust your personal taste to match the retail design.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500/60 mt-0.5">✕</span>
                  <span>Hope the piece carries a deeper emotional significance.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500/60 mt-0.5">✕</span>
                  <span>Own a mass-produced product that hundreds of others may also own.</span>
                </li>
              </ul>
            </div>

            {/* Column 2 - Creating */}
            <div className="bg-[#1A1A1A] p-8 rounded border border-[#C8A46B]/30 space-y-6 shadow-xl shadow-black/10">
              <h3 className="text-lg font-serif text-[#C8A46B] uppercase tracking-widest border-b border-[#C8A46B]/20 pb-3">Creating with SHEWAH</h3>
              <ul className="space-y-4 text-sm text-[#F8F6F2] font-light">
                <li className="flex items-start gap-3">
                  <span className="text-[#C8A46B] mt-0.5">✓</span>
                  <span>Begin from scratch, anchored entirely around your story.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#C8A46B] mt-0.5">✓</span>
                  <span>Ensure every setting and dimensions detail reflects your vision.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#C8A46B] mt-0.5">✓</span>
                  <span>Optionally scale gold and diamond specs to match your budget.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#C8A46B] mt-0.5">✓</span>
                  <span>Commission a singular, unique creation that belongs only to you.</span>
                </li>
              </ul>
            </div>

          </div>

          <div className="text-center space-y-2">
            <p className="text-[#F8F6F2] font-serif text-lg md:text-xl italic">
              "The difference isn’t the jewellery. It’s how it makes you feel every time you wear it."
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: Meet Your Designer */}
      <section className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-5 relative">
            <div className="aspect-[3/4] w-full rounded-xl bg-[#111111] border border-white/5 flex flex-col justify-end p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              
              {/* Designer Details Card */}
              <div className="z-10 space-y-2">
                <p className="text-xs uppercase tracking-widest text-[#C8A46B] font-mono">ATELIER DIRECTORS</p>
                <h3 className="text-2xl font-normal text-white font-serif">The Craftsmanship Lead</h3>
                <p className="text-xs text-stone-400 font-light">SHEWAH Private Commissions Team</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8 text-left">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white leading-tight">
              Behind Every Meaningful Piece <br />
              <span className="text-[#C8A46B] italic">Is Someone Who Listens.</span>
            </h2>

            <div className="space-y-4 text-stone-300 font-light text-sm md:text-base leading-relaxed">
              <p>
                Luxury jewellery isn’t about transient trends. It is about translating deep emotions, promises, and milestones into timeless physical forms.
              </p>
              <p>
                We believe that the design is only as good as the understanding behind it. Every consultation begins with co-creating the moodboard and understanding the client before discussing the specific diamond cuts or metal bands.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-white/5">
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">12+</p>
                <p className="text-[10px] text-[#7A7A7A] uppercase tracking-widest mt-1">Years Experience</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">1000+</p>
                <p className="text-[10px] text-[#7A7A7A] uppercase tracking-widest mt-1">Commissions Created</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">Bespoke</p>
                <p className="text-[10px] text-[#7A7A7A] uppercase tracking-widest mt-1">Design Philosophy</p>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={scrollToIntake}
                className="bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300"
              >
                Start Your Design Journey
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 5: Luxury Without Mining */}
      <section className="py-24 px-6 md:px-12 bg-[#111111] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Modern Luxury <span className="text-[#C8A46B] italic">Has Evolved.</span>
            </h2>
            <p className="text-[#7A7A7A] text-sm max-w-md mx-auto font-light">
              Acquire superior-grade diamonds crafted ethically, chemically identical to mined stones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#1A1A1A] p-8 rounded border border-white/5 space-y-2">
              <h3 className="text-base font-semibold text-white">Identical Brilliance</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Our diamonds possess the exact same crystalline carbon structure, fire, scintillation, and refractive index as natural mined diamonds.
              </p>
            </div>
            <div className="bg-[#1A1A1A] p-8 rounded border border-white/5 space-y-2">
              <h3 className="text-base font-semibold text-white">IGI / GIA Certification</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Every centerpiece gem is individually evaluated by independent international diamond labs and inscribed with its distinct grading number.
              </p>
            </div>
            <div className="bg-[#1A1A1A] p-8 rounded border border-white/5 space-y-2">
              <h3 className="text-base font-semibold text-white">Ethically Created</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                By growing diamond crystals in high-tech laboratories, we bypass the heavy environmental and social costs of deep mining.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs tracking-widest text-[#7A7A7A] uppercase font-mono">
              "Luxury should reflect your values as beautifully as your style."
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 6: Designed Around Your Budget */}
      <section className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Every Story Is Different. <br />
              <span className="text-[#C8A46B] italic">So Is Every Commission.</span>
            </h2>
            <p className="text-stone-300 text-sm md:text-base font-light leading-relaxed">
              Rather than asking you to fit into predefined collections, we begin by understanding your investment range and designing accordingly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="bg-[#111111] p-8 rounded border border-white/5 space-y-4 hover:border-[#C8A46B]/30 transition-colors">
              <p className="text-2xl font-normal text-[#C8A46B] font-serif">₹75,000+</p>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Elegant Everyday Luxury</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Delicate diamond bands, custom initials pendants, and initial stackable gold pieces.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#111111] p-8 rounded border border-white/5 space-y-4 hover:border-[#C8A46B]/30 transition-colors">
              <p className="text-2xl font-normal text-[#C8A46B] font-serif">₹1.5 Lakh+</p>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Signature Solitaires</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Bespoke engagement rings, oval solitaire rings, and custom bezel gold bands.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#111111] p-8 rounded border border-white/5 space-y-4 hover:border-[#C8A46B]/30 transition-colors">
              <p className="text-2xl font-normal text-[#C8A46B] font-serif">₹3.0 Lakh+</p>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Wedding Sets</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Coordinated matching wedding bands, multi-stone bracelets, and bridal accents.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-[#111111] p-8 rounded border border-white/5 space-y-4 hover:border-[#C8A46B]/30 transition-colors">
              <p className="text-2xl font-normal text-[#C8A46B] font-serif">₹5.0 Lakh+</p>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Heirloom Commissions</h3>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Multi-carat diamond tennis bracelets, luxury chokers, and detailed bespoke collars.
              </p>
            </div>

          </div>

          <div className="text-center">
            <button 
              onClick={scrollToIntake}
              className="bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300"
            >
              Discuss Your Vision
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 7: Popular Commissions */}
      <section className="py-24 px-6 md:px-12 bg-[#111111] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Bespoke Categories: <span className="text-[#C8A46B] italic">Popular Commissions</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Engagement Rings</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Two People. One Promise.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Tailored claw settings, hidden halos, and custom band profiles built around your diamond choice.
              </p>
            </div>

            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Wedding Bands</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Designed for the beginning of forever.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Classic high-polish bands, hand-textured finishes, and nesting rings crafted to slide together.
              </p>
            </div>

            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Anniversary Gifts</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Celebrate every year beautifully.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Custom diamond eternity bands or drop earrings that reflect the milestones you've built.
              </p>
            </div>

            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Push Gifts</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">A memory that lasts longer than flowers.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Elegant diamond studs or initial bracelets marking the arrival of a new chapter.
              </p>
            </div>

            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Daily Luxury</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Crafted for everyday confidence.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Simple solitaire studs, stackable rings, and bezel pendant chains built for daily wear.
              </p>
            </div>

            <div className="p-8 bg-[#1A1A1A] rounded border border-white/5 space-y-3">
              <h3 className="text-lg font-serif text-[#C8A46B]">Family Heirlooms</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">Designed to be treasured across generations.</p>
              <p className="text-xs text-[#7A7A7A] leading-relaxed font-light">
                Detailed statement necklaces, grand pendants, and heavy gold rings that preserve legacy.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 8: Real Client Journey */}
      <section id="stories" className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Bespoke Storytelling: <span className="text-[#C8A46B] italic">The Client Journey</span>
            </h2>
            <p className="text-[#7A7A7A] text-sm max-w-md mx-auto font-light">
              Follow how an abstract cathedral inspiration became a physical legacy. Click the stages below to explore.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Timeline selector */}
            <div className="lg:col-span-4 space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {JOURNEY_STAGES.map((stg, idx) => (
                <button
                  key={stg.id}
                  onClick={() => setSelectedJourneyStage(idx)}
                  className={`w-full text-left p-4 rounded transition-all duration-300 border ${selectedJourneyStage === idx ? 'bg-[#111111] border-[#C8A46B] text-white' : 'border-transparent text-[#7A7A7A] hover:text-[#F8F6F2]'}`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-widest mb-1">STAGE 0{idx + 1}</div>
                  <div className="font-serif text-base font-medium">{stg.title}</div>
                </button>
              ))}
            </div>

            {/* Display stage detail */}
            <div className="lg:col-span-8 bg-[#111111] p-8 md:p-10 rounded border border-white/5 space-y-6 shadow-xl relative min-h-[320px] flex flex-col justify-between">
              
              <div className="space-y-4">
                <span className="text-[10px] font-mono text-[#C8A46B] uppercase tracking-widest">
                  STAGE 0{selectedJourneyStage + 1} · {JOURNEY_STAGES[selectedJourneyStage].title}
                </span>
                <h3 className="text-2xl font-normal text-white font-serif leading-relaxed">
                  {JOURNEY_STAGES[selectedJourneyStage].desc}
                </h3>
              </div>

              <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-[#7A7A7A] gap-2">
                <span>Visual output: <span className="text-[#F8F6F2] font-mono">{JOURNEY_STAGES[selectedJourneyStage].imageText}</span></span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#C8A46B]">Interactive preview</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 9: Why SHEWAH (The Comparison) */}
      <section className="py-24 px-6 md:px-12 bg-[#111111] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Bespoke Curation <span className="text-[#C8A46B] italic">vs Traditional Retail</span>
            </h2>
          </div>

          <div className="overflow-x-auto border border-white/5 rounded">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-white/5 font-serif text-white">
                  <th className="p-4 uppercase tracking-widest font-normal">Feature</th>
                  <th className="p-4 uppercase tracking-widest font-normal text-[#7A7A7A]">Traditional Retail</th>
                  <th className="p-4 uppercase tracking-widest font-normal text-[#C8A46B]">SHEWAH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#7A7A7A]">
                <tr>
                  <td className="p-4 font-medium text-white">Product Sourcing</td>
                  <td className="p-4">Display Case limitations</td>
                  <td className="p-4 text-[#F8F6F2]">Designed Around You</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Personalization</td>
                  <td className="p-4">Pre-defined sizing template</td>
                  <td className="p-4 text-[#F8F6F2]">Unlimited Bespoke Details</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Pricing Model</td>
                  <td className="p-4">Heavy distributor margins</td>
                  <td className="p-4 text-[#F8F6F2]">Transparent direct-to-atelier rates</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Design Revisions</td>
                  <td className="p-4">Sold as-is, no changes allowed</td>
                  <td className="p-4 text-[#F8F6F2]">Unlimited CAD adjustments</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Manufacturing</td>
                  <td className="p-4">Mass production lines</td>
                  <td className="p-4 text-[#F8F6F2]">One Client. One Creation.</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-white">Purchase Type</td>
                  <td className="p-4">Transactional checkout</td>
                  <td className="p-4 text-[#F8F6F2]">Personal co-creation experience</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* SECTION 10: Trust */}
      <section className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">
              Bespoke Integrity: <span className="text-[#C8A46B] italic">Our Commitments</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            
            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Award className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">IGI Certified</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Independently graded diamonds.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <ShieldCheck className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">BIS Hallmarked</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Assured gold karat purity.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Clock className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Private Atelier</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Master karigars only.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Lock className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Secure Delivery</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Fully insured transit.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Gift className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Luxury Box</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Beautiful presentation.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <RefreshCw className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Lifetime Care</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Cleaning and prong adjustments.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Award className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Transparent</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Cost breakdown guaranteed.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Eye className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">CAD Approval</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">Check design before crafting.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Star className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Single-Run</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">We never repeat templates.</p>
            </div>

            <div className="p-6 bg-[#111111] rounded border border-white/5 space-y-2">
              <Hammer className="w-5 h-5 text-[#C8A46B]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Fine Handcraft</h4>
              <p className="text-[10px] text-[#7A7A7A] leading-relaxed font-light">No mass manufacturing.</p>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 11: Frequently Asked Questions */}
      <section id="faq" className="py-24 px-6 md:px-12 bg-[#111111] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-normal font-serif text-white">
              Bespoke Design: <span className="text-[#C8A46B] italic">Common Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = expandedFaq === idx
              return (
                <div key={idx} className="border-b border-white/5 pb-4">
                  <button
                    onClick={() => handleFaqToggle(idx)}
                    className="w-full flex justify-between items-center text-left py-3 text-stone-200 hover:text-white transition-colors focus:outline-none"
                  >
                    <span className="font-medium text-sm md:text-base font-serif">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#C8A46B] transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-xs md:text-sm text-stone-400 leading-relaxed font-light pt-2 pl-1 transition-all duration-300">
                      {faq.a}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SECTION 12: Lead Form */}
      <section id="intake-form" className="py-24 px-6 md:px-12 bg-[#1A1A1A] border-b border-white/5 scroll-mt-24">
        <div className="max-w-xl mx-auto space-y-8">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-normal font-serif text-white">Let’s Begin With Your Story.</h2>
            <p className="text-[#7A7A7A] text-sm font-light">
              Every commission begins with a private conversation. Share a few details below, and one of our design consultants will personally reach out within 24 hours.
            </p>
          </div>

          <div className="bg-[#111111] p-8 md:p-10 rounded border border-white/5 shadow-2xl relative">
            
            {success ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-normal font-serif text-white">Consultation Reserved</h3>
                <p className="text-[#7A7A7A] text-xs leading-relaxed max-w-sm mx-auto font-light">
                  Thank you. Your details have been securely logged. A dedicated SHEWAH design consultant will reach out via <span className="text-[#C8A46B] font-semibold capitalize">{preferredContact}</span> within 24 hours to schedule your digital sketch preview.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {error && (
                  <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded p-3 text-xs">
                    {error}
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-4">
                  
                  {/* Name */}
                  <div className="relative">
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">First Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                        required
                      />
                      <User className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">WhatsApp Mobile Number *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="10-digit Indian mobile"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                        required
                      />
                      <PhoneCall className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">Email Address (Optional)</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                      />
                      <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">City *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Your location"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                        required
                      />
                      <MapPin className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                    </div>
                  </div>

                  {/* Occasion */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">Occasion</label>
                    <select
                      value={occasion}
                      onChange={e => setOccasion(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
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
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">Jewellery Type</label>
                    <select
                      value={jewelleryType}
                      onChange={e => setJewelleryType(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
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
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-1.5 font-semibold">Estimated Budget Range</label>
                    <select
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded py-3 px-4 text-sm text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
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
                    <label className="block text-[10px] uppercase tracking-widest text-[#C8A46B] mb-2 font-semibold">Preferred Consultation Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      
                      <label className={`flex flex-col items-center justify-center p-3 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'whatsapp' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
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

                      <label className={`flex flex-col items-center justify-center p-3 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'phone' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
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

                      <label className={`flex flex-col items-center justify-center p-3 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'video' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
                        <input
                          type="radio"
                          name="contact"
                          value="video"
                          checked={preferredContact === 'video'}
                          onChange={() => setPreferredContact('video')}
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
                  className="w-full bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] py-4 rounded font-medium text-xs uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <span>Reserve My Private Consultation</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-stone-500 text-center leading-none">
                  No pressure. No obligation. Everything you share remains completely confidential.
                </p>

              </form>
            )}

          </div>

        </div>
      </section>

      {/* SECTION 13: Final Close */}
      <section className="py-32 px-6 md:px-12 bg-[#111111] text-center border-b border-white/5">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-normal font-serif text-[#F8F6F2] leading-tight">
            The Most Beautiful Jewellery <br />
            Doesn't Begin With Gold. <br />
            <span className="text-[#C8A46B] italic">It Begins With Meaning.</span>
          </h2>
          <div className="space-y-4 text-stone-400 text-sm md:text-base font-light max-w-lg mx-auto">
            <p>
              Years from now, the brilliance of a diamond may catch the light. But it will be the memory behind it that catches your heart.
            </p>
            <p>
              Some pieces become possessions. Others become family history. Let’s create the latter.
            </p>
          </div>
          <div className="pt-6">
            <button
              onClick={scrollToIntake}
              className="bg-transparent border border-[#C8A46B] hover:bg-[#C8A46B] text-[#C8A46B] hover:text-[#111111] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300 inline-flex items-center gap-2"
            >
              <span>Begin Your Private Consultation</span>
              <Sparkle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111111] py-8 text-center text-[10px] text-[#7A7A7A] uppercase tracking-widest">
        <p>&copy; {new Date().getFullYear()} SHEWAH. ALL RIGHTS RESERVED. PRIVATE ATELIER BY CONCIERGE.</p>
      </footer>

      {/* Sticky Mobile Action Bar */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111111]/95 border-t border-white/5 p-3 flex justify-center items-center safe-area-pb transition-all duration-300 ${showStickyNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <button
          onClick={scrollToIntake}
          className="w-full bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] py-3 rounded font-medium text-xs tracking-wider uppercase text-center transition-colors duration-300 flex items-center justify-center gap-2"
        >
          <span>Book Free Design Consultation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  )
}
