'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Diamond, Check, Send, PhoneCall, MessageSquare, Video, ArrowRight,
  ChevronDown, MapPin, User, Mail, Sparkle, Loader2, CheckCircle2,
  Hammer, Gift, Award, Lock, Eye, RefreshCw, Star
} from 'lucide-react'

// All 18 FAQs preserved with refined warm copy
const FAQS = [
  {
    q: "How does the design consultation work?",
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
    q: "How long does the bespoke process take?",
    a: "Typically, the journey takes 15 to 25 business days from design approval to delivery. For complex heirloom commissions, we recommend starting at least 6 weeks in advance of your occasion."
  },
  {
    q: "What if I don't like the first design concept?",
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
    desc: "A client wanted a ring capturing the architectural essence of the Florence Cathedral, where they got engaged.",
    imageText: "Reference notes, arch photos, and hand-sketched styling cues."
  },
  {
    id: "moodboard",
    title: "Moodboard",
    desc: "We curated geometric details, Gothic arches, and select diamond cuts matching the cathedral's stone carvings.",
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
  
  const [showStickyNav, setShowStickyNav] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isDiamondFlipped, setIsDiamondFlipped] = useState(false)

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

  // Intersection Observer for scroll reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    const revealElements = document.querySelectorAll(
      '.reveal, .reveal-scale, .reveal-left, .reveal-right, .timeline-line-vertical, .timeline-line-horizontal'
    )
    revealElements.forEach((el) => observer.observe(el))

    return () => {
      revealElements.forEach((el) => observer.unobserve(el))
    }
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
    <div className="relative selection:bg-[#C8A46B]/30 selection:text-white pb-20 lg:pb-0 min-h-screen bg-[#0A0A0A] text-[#F8F6F2] font-sans antialiased">
      
      {/* Scroll Progress Bar */}
      <div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#C8A46B] z-50 transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/919662266360?text=Hi%20Shewah,%20I'd%20like%20to%20know%20more%20about%20your%20custom%20jewellery%20design%20consultations."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 bg-[#121212] border border-[#C8A46B]/30 p-3.5 rounded-full text-[#C8A46B] hover:text-white hover:bg-[#C8A46B] transition-all duration-300 shadow-xl shadow-black/50 flex items-center justify-center whatsapp-pulse"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      {/* Sticky Navigation bar */}
      <nav className={`fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center transition-all duration-300 ${showStickyNav ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C8A46B]/15 flex items-center justify-center border border-[#C8A46B]/30">
            <Diamond className="w-3.5 h-3.5 text-[#C8A46B]" />
          </div>
          <span className="font-semibold text-base tracking-widest text-[#F8F6F2]">SHEWAH</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-[10px] uppercase tracking-widest text-[#8E8E8E]">
          <button onClick={() => scrollToSection('about')} className="hover:text-[#C8A46B] transition-colors">About</button>
          <button onClick={() => scrollToSection('process')} className="hover:text-[#C8A46B] transition-colors">Process</button>
          <button onClick={() => scrollToSection('stories')} className="hover:text-[#C8A46B] transition-colors">Design Stories</button>
          <button onClick={() => scrollToSection('faq')} className="hover:text-[#C8A46B] transition-colors">FAQ</button>
        </div>

        <button 
          onClick={scrollToIntake}
          className="text-[10px] uppercase tracking-widest border border-[#C8A46B] text-[#C8A46B] hover:bg-[#C8A46B] hover:text-[#111111] px-5 py-2.5 rounded transition-all duration-300 font-medium"
        >
          Book Consultation
        </button>
      </nav>

      {/* SECTION 1: HERO — "The Invitation" */}
      <section className="relative min-h-screen flex flex-col justify-center py-24 px-6 md:px-12 overflow-hidden border-b border-white/5">
        {/* Background Image with Radial Overlay */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/consultation/hero_preview.jpg" 
            alt="Private jewellery design studio sketches and diamonds" 
            fill 
            sizes="100vw"
            priority 
            className="object-cover opacity-25 select-none pointer-events-none ken-burns"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/30 z-1" />
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10 pt-12">
          
          <div className="inline-flex items-center gap-2 bg-[#121212] border border-white/5 px-4 py-1.5 rounded-full reveal reveal-scale">
            <Sparkle className="w-3.5 h-3.5 text-[#C8A46B]" />
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Private Jewellery Atelier</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-normal leading-[1.1] text-[#F8F6F2] font-serif max-w-3xl mx-auto reveal reveal-delay-1">
            Your Story Deserves <br />
            <span className="text-shimmer italic font-serif">More Than a Showroom.</span>
          </h1>

          <p className="text-[#8E8E8E] text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto font-light reveal reveal-delay-2">
            Commission bespoke solid gold and certified lab-grown diamond jewellery. Collaboratively designed around your life — not a retailer's inventory.
          </p>

          <div className="pt-4 space-y-4 reveal reveal-delay-3 flex flex-col items-center">
            <button 
              onClick={scrollToIntake}
              className="w-full sm:w-auto bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-[#C8A46B]/5 cta-pulse"
            >
              <span>Book My Private Design Consultation</span> 
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <p className="text-[10px] text-[#8E8E8E] tracking-wider uppercase font-light">
              No pressure. Crafted only after your final approval.
            </p>
          </div>

          {/* Trust Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-y-4 gap-x-2 pt-12 text-[9px] uppercase tracking-widest text-[#8E8E8E] font-medium border-t border-white/5 reveal reveal-delay-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-[#C8A46B]" />
              <span>IGI Certified</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-[#C8A46B]" />
              <span>BIS Hallmarked</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-[#C8A46B]" />
              <span>CAD Preview First</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-[#C8A46B]" />
              <span>Private Atelier</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-[#C8A46B]" />
              <span>Lifetime Care</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Star className="w-3 h-3 fill-[#C8A46B] text-[#C8A46B]" />
              <span>4.9★ Reviews</span>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: PROCESS — "The Journey" */}
      <section id="process" className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-20">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">THE EXPERIENCE</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              From Conversation <span className="text-[#C8A46B] italic font-serif">To Forever Piece.</span>
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm max-w-md mx-auto font-light">
              An elegant, transparent co-creation sequence designed to put you at the center of the journey.
            </p>
          </div>

          {/* Desktop horizontal process / Mobile vertical stack */}
          <div className="relative grid grid-cols-1 md:grid-cols-7 gap-8 text-left">
            
            {/* Steps connection line (Desktop only) */}
            <div className="hidden md:block absolute top-[28px] left-[5%] right-[5%] h-[1px] bg-white/5 z-0 timeline-line-horizontal reveal-scale" />

            {[
              { num: "01", title: "Share Your Story", desc: "Tell us the moment this custom jewellery will celebrate." },
              { num: "02", title: "Private Discovery", desc: "Your designer explores your visual vision, style preferences, and budget." },
              { num: "03", title: "Design Together", desc: "Hand sketches and material options take shape around your parameters." },
              { num: "04", title: "Watch It Come Alive", desc: "Review a photorealistic 3D CAD preview before metal is cast." },
              { num: "05", title: "Perfect Every Detail", desc: "Enjoy unlimited design revisions until the preview feels completely yours." },
              { num: "06", title: "Master Craftsmanship", desc: "Our expert karigars hand-forge and set certified gems in solid gold." },
              { num: "07", title: "Receive Your Piece", desc: "Fully insured transit and luxury gift packaging delivered to your door." }
            ].map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col space-y-4 p-6 bg-[#0A0A0A] rounded border border-white/5 hover:border-[#C8A46B]/20 transition-all duration-300 reveal reveal-scale">
                <div className="w-8 h-8 rounded-full bg-[#121212] border border-[#C8A46B]/30 flex items-center justify-center text-[10px] font-mono text-[#C8A46B] font-semibold float-subtle">
                  {step.num}
                </div>
                <h3 className="text-sm font-semibold text-white tracking-wide pt-2">{step.title}</h3>
                <p className="text-[11px] text-[#8E8E8E] leading-relaxed font-light">
                  {step.desc}
                </p>
              </div>
            ))}

          </div>

          <div className="text-center pt-4 reveal">
            <button 
              onClick={scrollToIntake}
              className="bg-transparent border border-[#C8A46B]/40 text-[#C8A46B] hover:bg-[#C8A46B] hover:text-[#111111] px-8 py-4 rounded text-[10px] tracking-widest uppercase transition-all duration-300 font-medium"
            >
              Reserve My Private Consultation
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3: WHY BESPOKE — "The Difference" */}
      <section id="about" className="py-28 px-6 md:px-12 bg-[#0A0A0A] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-20">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">WHY BESPOKE</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              The Difference Between Buying Jewellery <br />
              <span className="text-[#C8A46B] italic font-serif">And Creating It.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
            
            {/* Column 1 - Buying */}
            <div className="bg-[#121212] p-8 rounded border border-white/5 flex flex-col justify-between reveal reveal-left">
              <div>
                <h3 className="text-xs uppercase tracking-widest text-[#8E8E8E] font-semibold border-b border-white/5 pb-4 mb-6">The Showroom Purchase</h3>
                <div className="space-y-6 text-sm text-[#8E8E8E] font-light leading-relaxed">
                  <p>You browse pre-fabricated display inventory. Select the closest approximation of your design idea.</p>
                  <p>You adapt your aesthetic taste or budget to match their stock constraints.</p>
                  <p>The piece remains transactional, carrying the margins of prime retail space and distributors.</p>
                </div>
              </div>
              <div className="pt-8 border-t border-white/5 mt-8 text-[11px] uppercase tracking-wider text-[#8E8E8E] font-mono">
                Mass-produced for the public
              </div>
            </div>

            {/* Column 2 - Creating */}
            <div className="bg-[#121212] p-8 rounded border border-[#C8A46B]/30 flex flex-col justify-between reveal reveal-right shadow-2xl relative">
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-[#C8A46B] text-[#111111] text-[9px] uppercase tracking-widest px-3 py-1 font-semibold rounded-full">
                Atelier standard
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-widest text-[#C8A46B] font-semibold border-b border-[#C8A46B]/20 pb-4 mb-6">The Private Commission</h3>
                <div className="space-y-6 text-sm text-[#F8F6F2] font-light leading-relaxed">
                  <p>You begin from a clean, bespoke canvas. Every curve, setting, and metal profile starts with your input.</p>
                  <p>We source the perfect diamond weight and carat clarity to fit your visual and budget goals.</p>
                  <p>You co-create directly with master craftsmen, bypassing retail markup entirely.</p>
                </div>
              </div>
              <div className="pt-8 border-t border-white/5 mt-8 text-[11px] uppercase tracking-wider text-[#C8A46B] font-mono">
                One Commission. One Owner.
              </div>
            </div>

          </div>

          <div className="text-center pt-4 reveal">
            <p className="text-[#F8F6F2] font-serif text-xl md:text-2xl italic leading-relaxed max-w-2xl mx-auto">
              "The difference isn't the gold or the carat weight. <br className="hidden sm:inline" />
              It's the history you feel every time it touches your skin."
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: MEET YOUR DESIGNER — "The Human" */}
      <section className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          <div className="lg:col-span-5 relative reveal reveal-scale">
            <div className="aspect-[3/4] w-full rounded bg-[#0A0A0A] border border-white/5 relative overflow-hidden shadow-2xl">
              <Image 
                src="/consultation/designer.jpg" 
                alt="Jewellery designer examining diamond at workbench" 
                fill 
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 z-10 space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-mono font-semibold">ATELIER DIRECTORS</p>
                <h3 className="text-xl font-normal text-white font-serif">Atelier Directors</h3>
                <p className="text-[10px] text-stone-400 font-light">SHEWAH Custom Commission Lead</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8 text-left reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">YOUR DESIGN PARTNER</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white leading-tight">
              Behind Every Meaningful Piece <br />
              <span className="text-[#C8A46B] italic font-serif">Is Someone Who Listens.</span>
            </h2>

            <p className="text-xl font-serif text-[#C8A46B] italic leading-relaxed max-w-lg">
              "I don't begin by asking what jewellery you want to purchase. I begin by asking why you're commissioning it."
            </p>

            <div className="space-y-4 text-stone-300 font-light text-sm md:text-base leading-relaxed">
              <p>
                True luxury isn't about assembling standard settings. It is about understanding the emotion, the anniversary, the milestone, or the legacy you want your diamond to carry.
              </p>
              <p>
                Every custom commission begins with an open, private dialogue. We sketch concepts, review hand drawings, and examine diamond dimensions long before a single gemstone is placed in metal.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/5 max-w-md">
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">12+</p>
                <p className="text-[9px] text-[#8E8E8E] uppercase tracking-widest mt-1">Years Experience</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">1,000+</p>
                <p className="text-[9px] text-[#8E8E8E] uppercase tracking-widest mt-1">Commissions</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-normal text-[#C8A46B] font-serif">Bespoke</p>
                <p className="text-[9px] text-[#8E8E8E] uppercase tracking-widest mt-1">Philosophy</p>
              </div>
            </div>

            <div className="pt-6">
              <button 
                onClick={scrollToIntake}
                className="bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300"
              >
                Start My Design Journey
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 5: LAB DIAMOND EDUCATION — "The Intelligence" */}
      <section className="py-28 px-6 md:px-12 bg-[#0A0A0A] border-b border-white/5">
        <div className="max-w-5xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">MODERN LUXURY</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              Same Diamond. <span className="text-[#C8A46B] italic font-serif font-normal">Smarter Origin.</span>
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm max-w-md mx-auto font-light">
              Acquire superior-grade diamonds with identical physical structure, certified by IGI or GIA.
            </p>
          </div>

          {/* Interactive flip card comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Card 1: Mined Diamond */}
            <div className="card-flip-container group">
              <div className="card-flip-inner">
                {/* Front */}
                <div className="card-front bg-[#121212] p-8 border border-white/5 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <span className="text-[10px] tracking-widest text-stone-500 font-mono uppercase font-bold">STRUCTURE COMPARISON</span>
                    <h3 className="text-2xl font-serif text-white font-normal">Mined Diamond</h3>
                    <p className="text-xs text-[#8E8E8E] leading-relaxed">
                      Carbon crystallized under deep geological heat and pressure over billions of years.
                    </p>
                  </div>
                  <div className="space-y-3 pt-6 border-t border-white/5 text-[11px] font-mono text-stone-400">
                    <div className="flex justify-between"><span>Mohs Hardness:</span> <span className="text-white">10</span></div>
                    <div className="flex justify-between"><span>Refractive Index:</span> <span className="text-white">2.42</span></div>
                    <div className="flex justify-between"><span>Ethics Profile:</span> <span className="text-red-400">High mining footprint</span></div>
                    <div className="flex justify-between"><span>Pricing Basis:</span> <span className="text-red-400">High retail premiums</span></div>
                  </div>
                  <div className="text-[10px] text-[#C8A46B] uppercase font-mono tracking-widest pt-4">Hover to compare values</div>
                </div>
                {/* Back */}
                <div className="card-back bg-[#181818] p-8 border border-white/10 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <span className="text-[10px] tracking-widest text-[#C8A46B] font-mono uppercase">ANALYSIS</span>
                    <h3 className="text-lg font-serif text-white">Geological Origin</h3>
                    <p className="text-xs text-[#8E8E8E] leading-relaxed">
                      Traditional earth extraction involves heavy landscape modification, global shipping channels, and multi-tier intermediary markup that inflates the cost to the consumer.
                    </p>
                  </div>
                  <div className="text-xs text-stone-400 italic">
                    Physically identical carbon, but bound to historical supply structures.
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Lab Grown Diamond */}
            <div className="card-flip-container group">
              <div className="card-flip-inner">
                {/* Front */}
                <div className="card-front bg-[#121212] p-8 border border-[#C8A46B]/30 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <span className="text-[10px] tracking-widest text-[#C8A46B] font-mono uppercase font-bold">ATELIER SELECTION</span>
                    <h3 className="text-2xl font-serif text-white font-normal">Lab-Grown Diamond</h3>
                    <p className="text-xs text-[#8E8E8E] leading-relaxed">
                      Carbon crystallized in controlled clean-energy conditions replicating natural parameters.
                    </p>
                  </div>
                  <div className="space-y-3 pt-6 border-t border-white/5 text-[11px] font-mono text-[#F8F6F2]">
                    <div className="flex justify-between"><span>Mohs Hardness:</span> <span className="text-white">10</span></div>
                    <div className="flex justify-between"><span>Refractive Index:</span> <span className="text-white">2.42</span></div>
                    <div className="flex justify-between"><span>Ethics Profile:</span> <span className="text-emerald-400">Zero land displacement</span></div>
                    <div className="flex justify-between"><span>Pricing Basis:</span> <span className="text-emerald-400">Atelier direct value</span></div>
                  </div>
                  <div className="text-[10px] text-[#C8A46B] uppercase font-mono tracking-widest pt-4">Hover to compare values</div>
                </div>
                {/* Back */}
                <div className="card-back bg-[#1A1815] p-8 border border-[#C8A46B]/40 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <span className="text-[10px] tracking-widest text-[#C8A46B] font-mono uppercase">ANALYSIS</span>
                    <h3 className="text-lg font-serif text-[#C8A46B]">Technical Identity</h3>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Gemological grading institutes evaluate lab diamonds using the exact same four criteria (Color, Clarity, Cut, Carat). They are physically indistinguishable from mined stones.
                    </p>
                  </div>
                  <div className="text-xs text-[#C8A46B] italic font-serif">
                    "Identical in every way a gemologist can measure. Different only in origin."
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="text-center space-y-4 max-w-xl mx-auto pt-6 reveal">
            <p className="text-xs text-[#8E8E8E] leading-relaxed font-light">
              Every SHEWAH custom design centers on hand-selected diamonds featuring independent certification from the IGI or GIA.
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 6: BUDGET — "The Permission" */}
      <section className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="max-w-2xl mx-auto text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">YOUR INVESTMENT</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              We Design Around Your Budget — <br />
              <span className="text-[#C8A46B] italic font-serif">Not the Other Way Around.</span>
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm font-light">
              Every commission is estimated with absolute transparent pricing. No retail premiums.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { price: "₹75,000+", label: "Elegant Beginnings", desc: "Fine stackable rings, delicate pendants, and everyday solitaire earrings in solid gold and certified diamonds." },
              { price: "₹1.5 Lakh+", label: "Signature Solitaires", desc: "Custom-designed engagement rings, anniversary bands, and tailored settings highlighting certified center stones." },
              { price: "₹3 Lakh+", label: "Wedding Collections", desc: "Complete bespoke bridal sets, matching groom bands, and coordinating accents crafted as a singular aesthetic." },
              { price: "₹5 Lakh+", label: "Heirloom Commissions", desc: "Bespoke diamond tennis bracelets, statement gold collars, and multi-stone legacy pieces built to transcend generations." }
            ].map((tier, idx) => (
              <div key={idx} className="bg-[#0A0A0A] p-8 rounded border border-white/5 flex flex-col justify-between hover:border-[#C8A46B]/30 transition-all duration-300 reveal reveal-scale">
                <div className="space-y-4">
                  <p className="text-3xl font-normal text-[#C8A46B] font-serif">{tier.price}</p>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{tier.label}</h3>
                  <p className="text-[11px] text-[#8E8E8E] leading-relaxed font-light">
                    {tier.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center reveal">
            <button 
              onClick={scrollToIntake}
              className="bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] px-8 py-4 rounded font-medium text-xs tracking-widest uppercase transition-all duration-300"
            >
              Discuss My Commission Scope
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 7: OCCASIONS — "The Imagination" */}
      <section className="py-28 px-6 md:px-12 bg-[#0A0A0A] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">OCCASIONS WE CELEBRATE</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              Every Custom Piece Marks a Moment.
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm max-w-md mx-auto font-light">
              We do not sell categories. We co-create milestones designed to carry your memories.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Engagement", sub: "The Ring You'll Remember Long After The Proposal.", text: "Custom settings designed to frame your choice of central oval, round, or emerald cut stones." },
              { title: "Wedding", sub: "The Jewellery In Every Wedding Photograph.", text: "Coordinated sets and nested bands hand-finished to sit completely flush against your engagement ring." },
              { title: "Anniversary", sub: "Celebrate Every Chapter.", text: "Eternity bands and diamond drop earrings crafted to symbolize the years and milestones you've built." },
              { title: "Push Gift", sub: "A Memory They'll Wear Forever.", text: "Delicate diamond bracelets or customized initial settings marking the arrival of a new family chapter." },
              { title: "Daily Luxury", sub: "Confidence For Every Day.", text: "Clean solitaire studs, solid gold initial chains, and stackable bands designed for lifetime daily wear." },
              { title: "Legacy", sub: "Designed To Outlive Us.", text: "Heavy gold signet rings, detailed collars, and statement pendants crafted to be passed down as family history." }
            ].map((occ, idx) => (
              <div key={idx} className="p-8 bg-[#121212] rounded border border-white/5 space-y-4 hover:border-[#C8A46B]/20 transition-all duration-300 reveal">
                <span className="text-[9px] font-mono text-[#C8A46B] uppercase tracking-widest font-semibold">MEMORIAL OBJECT</span>
                <h3 className="text-xl font-serif text-white font-normal">{occ.title}</h3>
                <p className="text-xs font-semibold text-stone-300 tracking-wide">{occ.sub}</p>
                <p className="text-[11px] text-[#8E8E8E] leading-relaxed font-light">
                  {occ.text}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 8: CLIENT STORY — "The Proof" */}
      <section id="stories" className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">BESPOKE STORYTELLING</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              The Journey of a Commission
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm max-w-md mx-auto font-light">
              Follow how an abstract design inspiration was translated step-by-step into a family heirloom.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Timeline selector (vertical list) */}
            <div className="lg:col-span-4 space-y-2 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 reveal reveal-left">
              {JOURNEY_STAGES.map((stg, idx) => (
                <button
                  key={stg.id}
                  onClick={() => setSelectedJourneyStage(idx)}
                  className={`w-full text-left p-4 rounded transition-all duration-300 border ${selectedJourneyStage === idx ? 'bg-[#0A0A0A] border-[#C8A46B] text-white shadow-lg' : 'border-transparent text-[#8E8E8E] hover:text-[#F8F6F2]'}`}
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest mb-1">STAGE 0{idx + 1}</div>
                  <div className="font-serif text-sm font-medium">{stg.title}</div>
                </button>
              ))}
            </div>

            {/* Display stage detail */}
            <div className="lg:col-span-8 bg-[#0A0A0A] p-8 md:p-12 rounded border border-white/5 min-h-[340px] flex flex-col justify-between reveal reveal-right shadow-2xl">
              
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono text-[#C8A46B] uppercase tracking-widest font-semibold">
                    STAGE 0{selectedJourneyStage + 1} &middot; {JOURNEY_STAGES[selectedJourneyStage].title}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-[#C8A46B] animate-ping" />
                </div>
                <h3 className="text-xl sm:text-2xl font-serif text-white leading-relaxed font-light">
                  "{JOURNEY_STAGES[selectedJourneyStage].desc}"
                </h3>
              </div>

              <div className="border-t border-white/5 pt-6 mt-8 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] text-[#8E8E8E] gap-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest block text-stone-500 font-mono">STUDIO ARTIFACT</span>
                  <span className="text-stone-300 font-mono">{JOURNEY_STAGES[selectedJourneyStage].imageText}</span>
                </div>
                <span className="text-[9px] uppercase font-mono tracking-widest text-[#C8A46B] border border-[#C8A46B]/20 px-2 py-0.5 rounded">Atelier CAD active</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 9: COMPARISON — "The Logic" */}
      <section className="py-28 px-6 md:px-12 bg-[#0A0A0A] border-b border-white/5">
        <div className="max-w-4xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">THE LOGIC</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              Private Atelier vs. Traditional Retail
            </h2>
          </div>

          <div className="overflow-x-auto border border-white/5 rounded reveal reveal-scale">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-[#121212] border-b border-white/5 font-serif text-white">
                  <th className="p-5 uppercase tracking-widest font-normal text-[10px]">Comparative Feature</th>
                  <th className="p-5 uppercase tracking-widest font-normal text-[10px] text-stone-500">Traditional Showroom</th>
                  <th className="p-5 uppercase tracking-widest font-normal text-[10px] text-[#C8A46B]">SHEWAH Private Atelier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#8E8E8E] font-light">
                {[
                  { feature: "Selection Scope", retail: "Limited to current display case inventory", shewah: "Unlimited. Sourced and designed around your vision" },
                  { feature: "Pricing Structure", retail: "Multi-tier distributor and high retail space margins", shewah: "Transparent direct-to-atelier calculations" },
                  { feature: "Personalization", retail: "Pre-fabricated sizing templates and setting forms", shewah: "Bespoke dimensions, settings, and hidden details" },
                  { feature: "Design Revisions", retail: "Sold as-is. Post-sale resizing is the only option", shewah: "Unlimited CAD adjustments before gold is cast" },
                  { feature: "Manufacturing", retail: "Mass-production assembly line batches", shewah: "Single commission handled by individual gold artisans" },
                  { feature: "Client Experience", retail: "Transactional retail purchase at a counter", shewah: "Collaborative design consultation with creative leads" }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-5 font-medium text-white">{row.feature}</td>
                    <td className="p-5">{row.retail}</td>
                    <td className="p-5 text-[#F8F6F2] font-medium">{row.shewah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* SECTION 10: TRUST — "The Assurance" */}
      <section className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">ATELIER ASSURANCE</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              Bespoke Integrity: Our Commitments
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: Award, label: "IGI Certified", desc: "Independently graded and certified central diamonds." },
              { icon: Check, label: "BIS Hallmarked", desc: "Assured solid gold purity verified by national standards." },
              { icon: Lock, label: "Insured Delivery", desc: "Complimentary fully insured signature-required courier." },
              { icon: Eye, label: "CAD Approval", desc: "Examine photorealistic digital model before gold is cast." },
              { icon: Gift, label: "Luxury Box", desc: "Premium gift presentation box with documentation slots." },
              { icon: RefreshCw, label: "Lifetime Maintenance", desc: "Complimentary yearly cleaning and prong inspection." },
              { icon: Diamond, label: "Direct Sourcing", desc: "Atelier direct diamond curation eliminating intermediaries." },
              { icon: Star, label: "4.9★ Social Proof", desc: "Over 200+ clients have commissioned their custom design." },
              { icon: Hammer, label: "Single-Run Craft", desc: "Each design template is retired immediately after completion." },
              { icon: PhoneCall, label: "Concierge Care", desc: "Direct client advisor support throughout the journey." }
            ].map((badge, idx) => (
              <div key={idx} className="p-6 bg-[#0A0A0A] rounded border border-white/5 space-y-3 hover:border-[#C8A46B]/25 transition-all duration-300 reveal flex flex-col justify-between">
                <badge.icon className="w-5 h-5 text-[#C8A46B] float-subtle" />
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-white uppercase tracking-wider">{badge.label}</h4>
                  <p className="text-[10px] text-[#8E8E8E] leading-relaxed font-light">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 11: FAQ — "The Concerns" */}
      <section id="faq" className="py-28 px-6 md:px-12 bg-[#0A0A0A] border-b border-white/5">
        <div className="max-w-3xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">FAQ</span>
            <h2 className="text-3xl font-normal font-serif text-white">
              Bespoke Design: Common Questions
            </h2>
          </div>

          <div className="space-y-4 reveal reveal-scale">
            {FAQS.map((faq, idx) => {
              const isOpen = expandedFaq === idx
              return (
                <div key={idx} className="border-b border-white/5 pb-4">
                  <button
                    onClick={() => handleFaqToggle(idx)}
                    className="w-full flex justify-between items-center text-left py-4 text-stone-200 hover:text-[#C8A46B] transition-colors focus:outline-none"
                  >
                    <span className="font-medium text-sm md:text-base font-serif">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#C8A46B] transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`faq-accordion-content ${isOpen ? 'open' : ''}`}>
                    <p className="text-xs md:text-sm text-[#8E8E8E] leading-relaxed font-light pt-2 pb-4 pl-1 border-l border-[#C8A46B]/30 ml-1">
                      {faq.a}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SECTION 12: CONSULTATION FORM — "The Step" */}
      <section id="intake-form" className="py-28 px-6 md:px-12 bg-[#121212] border-b border-white/5 scroll-mt-24">
        <div className="max-w-5xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 reveal">
            <span className="text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold font-mono">START YOUR STORY</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal font-serif text-white">
              Begin Your Custom Commission
            </h2>
            <p className="text-[#8E8E8E] text-xs sm:text-sm max-w-md mx-auto font-light">
              Every commission begins with a private conversation. Share your ideas below to schedule your design session.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch max-w-4xl mx-auto">
            
            {/* Left: What happens next timeline */}
            <div className="lg:col-span-5 bg-[#0A0A0A] p-8 rounded border border-white/5 flex flex-col justify-between reveal reveal-left">
              <div className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest text-white font-semibold font-mono border-b border-white/5 pb-4">
                  What Happens After Submission
                </h3>
                <div className="space-y-6 text-xs text-[#8E8E8E]">
                  <div className="relative pl-6 border-l border-[#C8A46B]/30">
                    <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#C8A46B]" />
                    <p className="font-semibold text-white">Within 24 Hours</p>
                    <p className="font-light">Your assigned advisor reviews your notes and reaches out via {preferredContact}.</p>
                  </div>
                  <div className="relative pl-6 border-l border-[#C8A46B]/15">
                    <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#C8A46B]/30" />
                    <p className="font-semibold text-white">Design Call</p>
                    <p className="font-light">A private session exploring gem parameters, custom shapes, and dimensions details.</p>
                  </div>
                  <div className="relative pl-6 border-l border-[#C8A46B]/15">
                    <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#C8A46B]/30" />
                    <p className="font-semibold text-white">Hand Sketch & CAD</p>
                    <p className="font-light">Receive detailed sketch layouts and a hyper-realistic 3D CAD model for your signoff.</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#121212] border border-[#C8A46B]/30" />
                    <p className="font-semibold text-white">Luxury Crafting</p>
                    <p className="font-light">Our karigars bring the piece to life in 15-25 days, shipped fully insured.</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 mt-8 text-[10px] text-stone-500 font-mono">
                Active Client Support: 4.9★ reviews from 200+ clients
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:col-span-7 bg-[#0A0A0A] p-8 md:p-10 rounded border border-white/5 shadow-2xl reveal reveal-right">
              {success ? (
                <div className="text-center py-12 space-y-6">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-normal font-serif text-white">Consultation Reserved</h3>
                  <p className="text-[#8E8E8E] text-xs leading-relaxed max-w-sm mx-auto font-light">
                    Your parameters have been logged. A custom commission advisor will personally reach out via <span className="text-[#C8A46B] font-semibold capitalize">{preferredContact}</span> within 24 hours to schedule your digital preview session.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {error && (
                    <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded p-3.5 text-xs">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">First Name *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                          required
                        />
                        <User className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">WhatsApp Number *</label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                          required
                        />
                        <PhoneCall className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Email Address (Optional)</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="yourname@domain.com"
                          className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                        />
                        <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                      </div>
                    </div>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Your City *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={city}
                          onChange={e => setCity(e.target.value)}
                          placeholder="Location (e.g. Bangalore)"
                          className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white placeholder-stone-700 focus:outline-none focus:border-[#C8A46B] transition-colors"
                          required
                        />
                        <MapPin className="absolute right-3.5 top-3.5 w-4 h-4 text-stone-700" />
                      </div>
                    </div>

                    {/* Occasion */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Occasion</label>
                      <select
                        value={occasion}
                        onChange={e => setOccasion(e.target.value)}
                        className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
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
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Jewellery Type</label>
                      <select
                        value={jewelleryType}
                        onChange={e => setJewelleryType(e.target.value)}
                        className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
                      >
                        <option value="">Select type</option>
                        <option value="Ring">Ring</option>
                        <option value="Bracelet">Bracelet</option>
                        <option value="Pendant/Necklace">Pendant/Necklace</option>
                        <option value="Earrings">Earrings</option>
                        <option value="Full Set">Full Set</option>
                      </select>
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Estimated Budget Range</label>
                    <select
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      className="w-full bg-[#121212] border border-white/10 rounded py-3.5 px-4 text-xs text-white focus:outline-none focus:border-[#C8A46B] transition-colors appearance-none"
                    >
                      <option value="">Select budget range</option>
                      <option value="₹50,000 - ₹1,00,000">₹50,000 - ₹1,00,000</option>
                      <option value="₹1,00,000 - ₹2,00,000">₹1,00,000 - ₹2,00,000</option>
                      <option value="₹2,00,000 - ₹5,00,000">₹2,00,000 - ₹5,00,000</option>
                      <option value="₹5,00,000+">₹5,00,000+</option>
                    </select>
                  </div>

                  {/* Contact Method */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase tracking-widest text-[#C8A46B] font-semibold">Preferred Consultation Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      
                      <label className={`flex flex-col items-center justify-center p-3.5 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'whatsapp' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
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

                      <label className={`flex flex-col items-center justify-center p-3.5 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'phone' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
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

                      <label className={`flex flex-col items-center justify-center p-3.5 rounded border text-center cursor-pointer transition-all duration-300 ${preferredContact === 'video' ? 'border-[#C8A46B] bg-[#C8A46B]/5 text-white' : 'border-white/10 hover:border-white/20 text-stone-400'}`}>
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

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] py-4 rounded font-medium text-xs uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reserving...</span>
                      </>
                    ) : (
                      <>
                        <span>Reserve My Private Consultation</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-stone-500 text-center leading-relaxed">
                    No pressure. No obligation. Everything you share remains completely confidential.
                  </p>

                </form>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 13: FINAL CTA — "The Close" */}
      <section className="relative py-36 px-6 md:px-12 text-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <Image 
            src="/consultation/final_cta.jpg" 
            alt="Bespoke luxury diamond ring presentation box" 
            fill 
            sizes="100vw"
            className="object-cover opacity-25 select-none pointer-events-none ken-burns"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-[#0A0A0A]/40 z-1" />
        </div>

        <div className="max-w-2xl mx-auto space-y-8 relative z-10 reveal reveal-scale">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-normal font-serif text-[#F8F6F2] leading-tight">
            The Most Beautiful Jewellery <br />
            Doesn't Begin With Gold. <br />
            <span className="text-shimmer italic font-serif">It Begins With Meaning.</span>
          </h2>
          <div className="space-y-4 text-stone-400 text-sm md:text-base font-light max-w-lg mx-auto leading-relaxed">
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
      <footer className="bg-[#0A0A0A] py-12 text-center text-[9px] text-[#8E8E8E] border-t border-white/5 uppercase tracking-widest">
        <p>&copy; {new Date().getFullYear()} SHEWAH. ALL RIGHTS RESERVED. PRIVATE ATELIER BY CONCIERGE.</p>
      </footer>

      {/* Sticky Mobile Action Bar */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 border-t border-white/5 p-3 flex justify-center items-center safe-area-pb transition-all duration-300 ${showStickyNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <button
          onClick={scrollToIntake}
          className="w-full bg-[#C8A46B] text-[#111111] hover:bg-[#b5925a] py-3.5 rounded font-medium text-xs tracking-wider uppercase text-center transition-colors duration-300 flex items-center justify-center gap-2 shadow-lg"
        >
          <span>Book Private Design Consultation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  )
}
