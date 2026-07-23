'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Diamond, Sparkle, ArrowRight, CheckCircle2,
  Loader2, MessageSquare, PhoneCall, Video, User, Mail, MapPin,
  Flame, Microscope, Sparkles, Shield, RefreshCw
} from 'lucide-react'

const TOTAL_FRAMES = 300

const getFrameUrl = (index: number) => {
  const frameNum = String(index + 1).padStart(3, '0')
  return `/frames/ezgif-frame-${frameNum}.jpg`
}

export default function ConsultationPage() {
  // Navigation & Scroll State
  const [showNav, setShowNav] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0) // 0 to 1 within sequence
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)

  // Questionnaire / Consultation State
  const [step, setStep] = useState(1)
  const [recipient, setRecipient] = useState('')
  const [occasion, setOccasion] = useState('')
  const [inspiration, setInspiration] = useState('')
  const [creationScope, setCreationScope] = useState('')
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [budget, setBudget] = useState('')
  const [preferredContact, setPreferredContact] = useState('whatsapp')
  
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Refs for Canvas, Target Frame, & Image Cache
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sequenceContainerRef = useRef<HTMLDivElement | null>(null)
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null))
  const targetFrameRef = useRef(0)
  const requestRef = useRef<number | null>(null)

  // Helper to get nearest loaded image if target frame is still downloading
  const getNearestLoadedImage = useCallback((targetIndex: number) => {
    if (imagesRef.current[targetIndex]?.complete && imagesRef.current[targetIndex]?.naturalWidth! > 0) {
      return imagesRef.current[targetIndex]
    }
    // Search backwards for closest loaded frame
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (imagesRef.current[i]?.complete && imagesRef.current[i]?.naturalWidth! > 0) {
        return imagesRef.current[i]
      }
    }
    // Search forwards for closest loaded frame
    for (let i = targetIndex + 1; i < TOTAL_FRAMES; i++) {
      if (imagesRef.current[i]?.complete && imagesRef.current[i]?.naturalWidth! > 0) {
        return imagesRef.current[i]
      }
    }
    return null
  }, [])

  // Render Frame on Canvas with retina scaling & contain math
  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = getNearestLoadedImage(frameIndex)
    if (!img) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (width === 0 || height === 0) return

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#050505'
    ctx.fillRect(0, 0, width, height)

    // Aspect Ratio Calculations (Full Cover & Center for Portrait & Landscape)
    const imgRatio = img.naturalWidth / img.naturalHeight
    const canvasRatio = width / height

    let drawWidth = width
    let drawHeight = height
    let offsetX = 0
    let offsetY = 0

    if (canvasRatio < imgRatio) {
      // Tall / Portrait Viewport (Mobile): Fill screen height completely, center width
      drawHeight = height
      drawWidth = height * imgRatio
      offsetX = (width - drawWidth) / 2
      offsetY = 0
    } else {
      // Wide / Landscape Viewport (Desktop): Fill screen width completely, center height
      drawWidth = width
      drawHeight = width / imgRatio
      offsetX = 0
      offsetY = (height - drawHeight) / 2
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    ctx.restore()
  }, [getNearestLoadedImage])

  // High-Speed Non-Blocking Preloader Strategy
  useEffect(() => {
    let active = true

    const loadSingleFrame = (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (imagesRef.current[index]) {
          resolve()
          return
        }
        const img = new window.Image()
        img.src = getFrameUrl(index)
        img.onload = () => {
          if (!active) return
          imagesRef.current[index] = img
          setLoadedCount((prev) => prev + 1)
          
          // If this loaded frame is the current target frame, re-render canvas immediately
          if (index === targetFrameRef.current || Math.abs(index - targetFrameRef.current) < 2) {
            renderFrame(targetFrameRef.current)
          }
          resolve()
        }
        img.onerror = () => resolve()
      })
    }

    const loadAllFrames = async () => {
      // Priority 1: Load initial 10 frames sequentially for instant hero paint
      for (let i = 0; i < 10; i++) {
        await loadSingleFrame(i)
      }
      if (active) {
        setIsLoaded(true)
        renderFrame(0)
      }

      // Priority 2: Load the rest asynchronously in a non-blocking parallel queue
      // This lets the browser handle standard HTTP request pipelining without blocking
      for (let i = 10; i < TOTAL_FRAMES; i++) {
        if (!active) break
        loadSingleFrame(i)
      }
    }

    loadAllFrames()

    return () => {
      active = false
    }
  }, [renderFrame])

  // Window Resize Listener
  useEffect(() => {
    const handleResize = () => {
      renderFrame(targetFrameRef.current)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderFrame])

  // Scroll Sync & Canvas Animation Loop
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setShowNav(scrollY > 80)

      const container = sequenceContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const totalScrollable = container.clientHeight - window.innerHeight

      if (totalScrollable <= 0) return

      // Calculate 0 to 1 progress within sequence container
      const currentScroll = -rect.top
      const progress = Math.min(1, Math.max(0, currentScroll / totalScrollable))

      setScrollProgress(progress)

      const targetFrame = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(progress * (TOTAL_FRAMES - 1))))
      
      targetFrameRef.current = targetFrame
      setCurrentFrame(targetFrame)

      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      requestRef.current = requestAnimationFrame(() => {
        renderFrame(targetFrame)
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // initial positioning check

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [renderFrame])

  // Auto-detect ?status=success in URL query on load & persist GCLID
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('status') === 'success') {
      setSuccess(true)
      setStep(5)
    }
    const gclid = params.get('gclid')
    if (gclid) {
      try { sessionStorage.setItem('shewah_gclid', gclid) } catch {}
    }
  }, [])

  // Smooth Scroll Handlers
  const scrollToConsultation = () => {
    const el = document.getElementById('consultation-experience')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const scrollToStory = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToCraftsmanship = () => {
    const container = sequenceContainerRef.current
    if (container) {
      const top = container.offsetTop + window.innerHeight * 0.8
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const scrollToProcess = () => {
    const container = sequenceContainerRef.current
    if (container) {
      const top = container.offsetTop + window.innerHeight * 2.2
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!firstName.trim() || !phone.trim() || !city.trim()) {
      setFormError('Please fill in your name, mobile number, and city.')
      return
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^(0|91)/, '')
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setFormError('Please enter a valid 10-digit Indian WhatsApp number.')
      return
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid email address.')
      return
    }

    let capturedGclid = null
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search)
        capturedGclid = params.get('gclid') || sessionStorage.getItem('shewah_gclid') || null
      } catch {}
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
          occasion: occasion || recipient || 'Custom Commission',
          budget: budget || null,
          jewellery_type: creationScope || 'Custom Ring',
          preferred_contact: preferredContact,
          gclid: capturedGclid,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Failed to reserve consultation. Please try again.')
        return
      }

      setSuccess(true)
      if (typeof window !== 'undefined') {
        window.location.href = '/consultation/thank-you'
      }

      // Fire Pinterest Lead Event on Form Action / Submission Success
      if (typeof window !== 'undefined' && (window as any).pintrk) {
        (window as any).pintrk('track', 'lead', {
          event_id: `lead_${Date.now()}`,
          lead_type: creationScope || 'Custom Ring',
          em: email ? email.trim().toLowerCase() : undefined,
        })
      }

      // Fire Google Ads Conversion Event
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-18068366696/1IaCCIqgn9UcEOjKladD',
          value: 1.0,
          currency: 'INR',
        })
      }
    } catch (err: any) {
      setFormError('Network connection issue. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Dynamic Background Light / Living Interface calculation
  const getAmbientGlowClass = () => {
    if (currentFrame < 40) return 'glow-consultation'
    if (currentFrame < 110) return 'glow-warm' // Craftsmanship gold fire
    if (currentFrame < 180) return 'glow-[#050505]' // Precision platinum blue
    if (currentFrame < 240) return 'glow-[#050505]' // Completion dark velvet
    return 'glow-consultation' // Emotion / Consultation
  }

  return (
    <div className="relative min-h-screen bg-[#050505] text-[rgba(255,255,255,0.90)] font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-white overflow-x-clip">
      
      {/* Apple-Inspired Slim Glassmorphism Header Nav */}
      <header className={`fixed top-0 left-0 right-0 z-50 py-3.5 px-4 sm:px-6 md:px-12 transition-all duration-500 ${showNav ? 'bg-[#050505]/85 backdrop-blur-xl border-b border-white/5 py-3 shadow-2xl' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Left: Brand */}
          <div className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={scrollToStory}>
            <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center">
              <Diamond className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D4AF37]" />
            </div>
            <span className="font-semibold text-[11px] sm:text-xs tracking-[0.22em] sm:tracking-[0.25em] text-white uppercase">SHEWAH</span>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-9 text-[11px] uppercase tracking-[0.2em] font-medium text-white/60">
            <button onClick={scrollToStory} className="hover:text-white transition-colors">Story</button>
            <button onClick={scrollToCraftsmanship} className="hover:text-[#D4AF37] transition-colors">Craftsmanship</button>
            <button onClick={scrollToProcess} className="hover:text-[#D4AF37] transition-colors">Process</button>
            <button onClick={scrollToConsultation} className="hover:text-[#D4AF37] transition-colors">Consultation</button>
          </nav>

          {/* Right CTA */}
          <button 
            onClick={scrollToConsultation}
            className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] sm:tracking-[0.2em] bg-[#D4AF37] text-[#050505] font-semibold hover:bg-[#E8D7A8] active:scale-95 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full transition-all duration-300 shadow-md shadow-[#D4AF37]/10"
          >
            Design Your Ring
          </button>
        </div>
      </header>

      {/* Floating WhatsApp Quick Action */}
      <a
        href="https://wa.me/919662266360?text=Hi%20Shewah,%20I'd%20like%20to%20know%20more%20about%20your%20custom%20jewellery%20design%20consultations."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 bg-[#0B0B0E]/90 backdrop-blur-lg border border-[#D4AF37]/40 p-3 sm:p-3.5 rounded-full text-[#D4AF37] hover:text-white hover:bg-[#D4AF37] active:scale-90 transition-all duration-300 shadow-2xl flex items-center justify-center group"
        aria-label="Contact WhatsApp Concierge"
      >
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-6 transition-transform" />
      </a>

      {/* PINNED HTML5 CANVAS IMAGE SEQUENCE CONTAINER (550vh Scroll Length) */}
      <div ref={sequenceContainerRef} className="scroll-sequence-container">
        
        {/* Sticky Canvas & Text Overlays Wrapper */}
        <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
          
          {/* Dynamic Living Ambient Background Glow */}
          <div className={`absolute inset-0 transition-all duration-1000 ${getAmbientGlowClass()}`} />

          {/* Vertical Mobile Dark Scrim Gradient for 100% Uncompromising Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/35 to-[#050505]/85 pointer-events-none z-[5] sm:hidden" />

          {/* HTML5 Canvas Component */}
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
          />

          {/* Loading Overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-[#050505] z-30 flex flex-col items-center justify-center gap-4 px-4 text-center">
              <Loader2 className="w-7 h-7 text-[#D4AF37] animate-spin" />
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37]">Loading Atelier Film...</p>
            </div>
          )}

          {/* Frame Progress Indicator (Subtle Luxury Badge at Bottom Left) */}
          <div className="absolute bottom-5 left-4 sm:bottom-6 sm:left-6 z-20 flex items-center gap-2 sm:gap-3 bg-[#0B0B0E]/90 backdrop-blur-md px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-white/15 text-[8px] sm:text-[9px] font-mono text-white/60 shadow-lg">
            <span className="text-[#D4AF37]">FRAME {String(currentFrame + 1).padStart(3, '0')}</span>
            <span>/</span>
            <span>300</span>
            <div className="w-8 sm:w-12 h-1 bg-white/15 rounded-full overflow-hidden ml-0.5 sm:ml-1">
              <div 
                className="h-full bg-[#D4AF37] transition-all duration-100" 
                style={{ width: `${((currentFrame + 1) / TOTAL_FRAMES) * 100}%` }}
              />
            </div>
          </div>

          {/* STORY OVERLAY PANELS (Fades dynamically mapped to frame timeline) */}

          {/* HERO OVERLAY: Frames 1 - 40 */}
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 transition-all duration-700 pointer-events-none ${currentFrame <= 40 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
            <div className="max-w-4xl space-y-4 sm:space-y-6 pointer-events-auto bg-[#0B0B0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 shadow-2xl sm:shadow-none">
              <div className="inline-flex items-center gap-2 border border-[#D4AF37]/30 bg-[#050505]/90 backdrop-blur-md px-3 py-1 sm:px-4 sm:py-1.5 rounded-full mb-1 sm:mb-2">
                <Sparkle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D4AF37]" />
                <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#E8D7A8] font-semibold">SHEWAH PRIVATE COMMISSION</span>
              </div>
              
              <h1 className="text-3xl sm:text-6xl md:text-7xl lg:text-8xl font-normal font-serif text-white tracking-apple leading-[1.08] sm:leading-[1.05] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                Designed to be <br />
                <span className="text-shimmer-gold italic">unforgettable.</span>
              </h1>
              
              <p className="text-xs sm:text-base md:text-lg text-white/90 sm:text-white/70 font-light max-w-xl mx-auto tracking-wide px-2 drop-shadow-md">
                Every custom ring begins with a story. Yours.
              </p>

              <div className="pt-2 sm:pt-6">
                <button 
                  onClick={scrollToCraftsmanship}
                  className="bg-[#D4AF37] text-[#050505] font-semibold hover:bg-[#E8D7A8] active:scale-95 px-6 py-3 sm:px-8 sm:py-4 rounded-full text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-all duration-300 inline-flex items-center gap-2.5 sm:gap-3 shadow-xl shadow-[#D4AF37]/20"
                >
                  <span>Begin Your Story</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* Scroll Indicator Prompt */}
            <div className="absolute bottom-8 sm:bottom-10 left-1/2 transform -translate-x-1/2 text-center space-y-1.5 sm:space-y-2 opacity-75 sm:opacity-60">
              <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#E8D7A8] font-mono">Scroll to view craftsmanship</p>
              <div className="w-3.5 h-6 sm:w-4 sm:h-7 border border-white/30 rounded-full mx-auto flex items-start justify-center p-0.5 sm:p-1">
                <div className="w-0.5 h-1.5 sm:w-1 sm:h-2 bg-[#D4AF37] rounded-full animate-bounce" />
              </div>
            </div>
          </div>

          {/* CRAFTSMANSHIP OVERLAY: Frames 41 - 110 */}
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 transition-all duration-700 pointer-events-none ${currentFrame >= 41 && currentFrame <= 110 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="max-w-3xl space-y-4 sm:space-y-6 bg-[#0B0B0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 shadow-2xl sm:shadow-none">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 text-[#D4AF37] font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] bg-[#050505]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/30">
                <Flame className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>01 / GOLDSMITHING & FIRE</span>
              </div>
              <h2 className="text-2.5xl sm:text-5xl md:text-6xl font-serif text-white font-normal leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                Crafted by hand.
              </h2>
              <p className="text-xs sm:text-base text-white/90 sm:text-white/70 font-light max-w-lg mx-auto leading-relaxed px-2 drop-shadow-md">
                Every masterpiece begins long before the diamond shines. Heat, molten gold, and gold artisans shaping precious metal by eye.
              </p>
            </div>
          </div>

          {/* PRECISION OVERLAY: Frames 111 - 180 (Includes Technical Info Badges) */}
          <div className={`absolute inset-0 z-10 transition-all duration-700 pointer-events-none ${currentFrame >= 111 && currentFrame <= 180 ? 'opacity-100' : 'opacity-0'}`}>
            
            {/* Center Story Title */}
            <div className="absolute top-20 sm:top-24 left-1/2 transform -translate-x-1/2 text-center space-y-1.5 sm:space-y-2 w-full px-4">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 text-[#D4AF37] font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] bg-[#050505]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/30">
                <Microscope className="w-3.5 h-3.5" />
                <span>02 / MICRON-LEVEL PRECISION</span>
              </div>
              <h3 className="text-xl sm:text-4xl font-serif text-white font-normal drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                Engineered for lifetime wear.
              </h3>
            </div>

            {/* Mobile HUD Floating Pill Card (Visible on mobile screens) */}
            <div className="sm:hidden absolute bottom-16 left-4 right-4 z-20 pointer-events-auto">
              <div className="tech-badge p-4 rounded-2xl bg-[#0B0B0E]/95 backdrop-blur-2xl border border-[#D4AF37]/40 space-y-1.5 text-center shadow-2xl">
                <div className="flex items-center justify-center gap-2">
                  <div className="radar-dot" />
                  <span className="text-[9.5px] uppercase tracking-[0.2em] font-mono text-[#D4AF37] font-semibold">
                    {currentFrame < 135 ? 'Diamond Setting' : currentFrame < 160 ? 'Micron Accuracy' : 'Hand Finished'}
                  </span>
                </div>
                <p className="text-[11px] text-white/90 font-light leading-snug">
                  {currentFrame < 135 
                    ? 'Hand-adjusted claw angles securing brilliant diamonds under 40x optical magnification.' 
                    : currentFrame < 160 
                    ? 'Sub-millimeter tolerance checks ensuring seamless comfort and structural security.'
                    : 'Hand polished with silk buffs to achieve mirror-like gold finish.'}
                </p>
              </div>
            </div>

            {/* Desktop Floating Info Label 1 (Top Left) */}
            <div className="absolute top-[32%] left-[10%] sm:left-[16%] tech-badge p-4 rounded-xl max-w-[220px] space-y-1.5 hidden sm:block transition-all duration-500">
              <div className="flex items-center gap-2">
                <div className="radar-dot" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#D4AF37] font-semibold">Diamond Setting</span>
              </div>
              <p className="text-[11px] text-white/70 font-light leading-snug">
                Hand-adjusted claw angles securing brilliant diamonds under 40x optical magnification.
              </p>
            </div>

            {/* Desktop Floating Info Label 2 (Bottom Right) */}
            <div className="absolute bottom-[28%] right-[10%] sm:right-[16%] tech-badge p-4 rounded-xl max-w-[220px] space-y-1.5 hidden sm:block transition-all duration-500">
              <div className="flex items-center gap-2">
                <div className="radar-dot" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#D4AF37] font-semibold">Micron Accuracy</span>
              </div>
              <p className="text-[11px] text-white/70 font-light leading-snug">
                Sub-millimeter tolerance checks ensuring seamless comfort and structural security.
              </p>
            </div>

            {/* Desktop Floating Info Label 3 (Bottom Left) */}
            <div className="absolute bottom-[20%] left-[12%] sm:left-[20%] tech-badge p-4 rounded-xl max-w-[200px] space-y-1.5 hidden md:block transition-all duration-500">
              <div className="flex items-center gap-2">
                <div className="radar-dot" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#D4AF37] font-semibold">Hand Finished</span>
              </div>
              <p className="text-[11px] text-white/70 font-light leading-snug">
                Hand polished with silk buffs to achieve mirror-like gold finish.
              </p>
            </div>
          </div>

          {/* COMPLETION OVERLAY: Frames 181 - 240 */}
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 transition-all duration-700 pointer-events-none ${currentFrame >= 181 && currentFrame <= 240 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="max-w-2xl space-y-3 sm:space-y-4 bg-[#0B0B0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 shadow-2xl sm:shadow-none">
              <span className="text-[9px] sm:text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] sm:tracking-[0.25em] bg-[#050505]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/30">03 / PERFECTED SILENCE</span>
              <h2 className="text-2.5xl sm:text-5xl font-serif text-white font-normal leading-relaxed drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                Perfection is not created. <br />
                <span className="text-[#E8D7A8] italic font-serif">It is uncovered.</span>
              </h2>
            </div>
          </div>

          {/* EMOTION OVERLAY: Frames 241 - 300 */}
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 transition-all duration-700 pointer-events-none ${currentFrame >= 241 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="max-w-3xl space-y-4 sm:space-y-6 pointer-events-auto bg-[#0B0B0E]/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 shadow-2xl sm:shadow-none">
              <span className="text-[9px] sm:text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] sm:tracking-[0.25em] bg-[#050505]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/30">04 / THE UNBOXING</span>
              <h2 className="text-3xl sm:text-6xl md:text-7xl font-serif text-white font-normal leading-tight tracking-apple drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                Made for one story. <br />
                <span className="text-shimmer-gold italic">Yours.</span>
              </h2>
              <p className="text-xs sm:text-base text-white/90 sm:text-white/70 font-light max-w-md mx-auto pt-1 sm:pt-2 px-2 drop-shadow-md">
                No mass inventory. No retail displays. Just a singular piece waiting to carry your milestone.
              </p>
              
              <div className="pt-2 sm:pt-6">
                <button 
                  onClick={scrollToConsultation}
                  className="bg-[#D4AF37] text-[#050505] font-semibold hover:bg-[#E8D7A8] active:scale-95 px-6 py-3.5 sm:px-8 sm:py-4 rounded-full text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-all duration-300 inline-flex items-center gap-2.5 sm:gap-3 shadow-2xl shadow-[#D4AF37]/20"
                >
                  <span>Book Your Private Consultation</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* GUIDED LUXURY CONSULTATION EXPERIENCE SECTION */}
      <section id="consultation-experience" className="relative py-16 sm:py-24 md:py-32 px-4 sm:px-6 md:px-12 bg-[#0B0B0E] border-t border-white/5 z-20 overflow-x-clip">
        
        {/* Soft Background Illumination */}
        <div className="absolute inset-0 bg-radial from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-10 sm:space-y-16 relative z-10">
          
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 border border-[#D4AF37]/30 bg-[#050505] px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#E8D7A8] font-semibold">PRIVATE DESIGN CONCIERGE</span>
            </div>
            <h2 className="text-2.5xl sm:text-5xl md:text-6xl font-serif text-white font-normal leading-tight px-2">
              Let's create something <br />
              <span className="text-shimmer-gold italic">that exists nowhere else.</span>
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-md mx-auto font-light leading-relaxed px-4">
              Answer a few guided questions about your vision. Our design director will personally curate a bespoke sketch proposal.
            </p>
          </div>

          {/* Interactive Multi-Step Questionnaire Form Card */}
          <div className="bg-[#050505] p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            
            {/* Step Progress Bar Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 sm:pb-6 mb-6 sm:mb-8 text-[10px] sm:text-xs font-mono">
              <span className="text-[#D4AF37] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-semibold">
                STEP 0{step} OF 05 &middot; {step === 1 ? 'RECIPIENT' : step === 2 ? 'OCCASION' : step === 3 ? 'INSPIRATION' : step === 4 ? 'SCOPE' : 'CONTACT'}
              </span>
              <div className="flex gap-1 sm:gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 sm:w-8 bg-[#D4AF37]' : i < step ? 'w-3 sm:w-4 bg-[#D4AF37]/40' : 'w-3 sm:w-4 bg-white/10'}`} 
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: WHO IS THIS RING FOR? */}
            {step === 1 && (
              <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-lg sm:text-2xl font-serif text-white">Who is this ring for?</h3>
                  <p className="text-xs text-white/60 font-light">Select who will be wearing this custom creation.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { id: 'partner', label: 'My Partner (Proposal / Secret)', desc: 'Surprise engagement or engagement ring' },
                    { id: 'myself', label: 'For Myself', desc: 'Self-reward or statement heirloom' },
                    { id: 'couple', label: 'For Both of Us (Couples)', desc: 'Matching bridal or wedding set' },
                    { id: 'family', label: 'Family Member / Push Gift', desc: 'Gift for milestone or arrival' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setRecipient(opt.label); setStep(2); }}
                      className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left border active:scale-[0.98] transition-all duration-300 ${recipient === opt.label ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.01] text-white/80'}`}
                    >
                      <p className="font-medium text-xs sm:text-sm text-white mb-0.5 sm:mb-1">{opt.label}</p>
                      <p className="text-[11px] sm:text-xs text-white/50 font-light">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: OCCASION */}
            {step === 2 && (
              <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-lg sm:text-2xl font-serif text-white">What occasion are you celebrating?</h3>
                  <p className="text-xs text-white/60 font-light">Helps us understand the symbolism and design context.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { label: 'Engagement / Proposal', desc: 'The beginning of forever' },
                    { label: 'Wedding Ceremony', desc: 'Nesting or matching wedding bands' },
                    { label: 'Milestone Anniversary', desc: 'Celebrating years together' },
                    { label: 'Push Gift / Personal Reward', desc: 'A lasting physical memory' }
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setOccasion(opt.label); setStep(3); }}
                      className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left border active:scale-[0.98] transition-all duration-300 ${occasion === opt.label ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.01] text-white/80'}`}
                    >
                      <p className="font-medium text-xs sm:text-sm text-white mb-0.5 sm:mb-1">{opt.label}</p>
                      <p className="text-[11px] sm:text-xs text-white/50 font-light">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <button 
                  type="button" 
                  onClick={() => setStep(1)} 
                  className="text-xs text-white/40 hover:text-white font-mono uppercase tracking-widest active:scale-95 transition-transform"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {/* STEP 3: INSPIRATION */}
            {step === 3 && (
              <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-lg sm:text-2xl font-serif text-white">Do you already have design inspiration?</h3>
                  <p className="text-xs text-white/60 font-light">Whether you have sketches or start from scratch, we guide you.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { label: 'I have photos / Pinterest moodboard', desc: 'We will refine details into a unique version' },
                    { label: 'I know the stone shape (Oval, Round, Emerald)', desc: 'We will build setting options around your cut' },
                    { label: 'I want to design from clean scratch', desc: 'Our designer will sketch clean concepts' },
                    { label: 'I need guidance on options', desc: 'We will present curated luxury references' }
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setInspiration(opt.label); setStep(4); }}
                      className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left border active:scale-[0.98] transition-all duration-300 ${inspiration === opt.label ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.01] text-white/80'}`}
                    >
                      <p className="font-medium text-xs sm:text-sm text-white mb-0.5 sm:mb-1">{opt.label}</p>
                      <p className="text-[11px] sm:text-xs text-white/50 font-light">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <button 
                  type="button" 
                  onClick={() => setStep(2)} 
                  className="text-xs text-white/40 hover:text-white font-mono uppercase tracking-widest active:scale-95 transition-transform"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {/* STEP 4: CREATION SCOPE */}
            {step === 4 && (
              <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                <div className="space-y-1 sm:space-y-2">
                  <h3 className="text-lg sm:text-2xl font-serif text-white">Select your creation scope</h3>
                  <p className="text-xs text-white/60 font-light">Are we crafting a new piece or transforming existing gold/gems?</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { label: 'Entirely New Custom Piece', desc: 'Crafted from solid gold & certified lab diamonds' },
                    { label: 'Redesign Family Heirloom', desc: 'Reset existing gems into a modern setting' },
                    { label: 'Matching Bridal Set', desc: 'Engagement ring & interlocking wedding band' },
                    { label: 'Other Custom Fine Jewellery', desc: 'Pendant, bracelet, or earrings' }
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setCreationScope(opt.label); setStep(5); }}
                      className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left border active:scale-[0.98] transition-all duration-300 ${creationScope === opt.label ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.01] text-white/80'}`}
                    >
                      <p className="font-medium text-xs sm:text-sm text-white mb-0.5 sm:mb-1">{opt.label}</p>
                      <p className="text-[11px] sm:text-xs text-white/50 font-light">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <button 
                  type="button" 
                  onClick={() => setStep(3)} 
                  className="text-xs text-white/40 hover:text-white font-mono uppercase tracking-widest active:scale-95 transition-transform"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {/* STEP 5: CONTACT DETAILS & FINAL SUBMISSION */}
            {step === 5 && (
              <div className="space-y-6 sm:space-y-8 animate-fadeIn">
                {success ? (
                  <div className="text-center py-8 sm:py-12 space-y-4 sm:space-y-6">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-bounce">
                      <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-serif text-white">Consultation Reserved</h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-md mx-auto font-light px-2">
                      Thank you. Your parameters have been received. A dedicated design director will reach out via <span className="text-[#D4AF37] font-medium capitalize">{preferredContact}</span> within 24 hours to present sketch references.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="space-y-1 sm:space-y-2">
                      <h3 className="text-lg sm:text-2xl font-serif text-white">Where should we share your sketch proposal?</h3>
                      <p className="text-xs text-white/60 font-light">Zero pressure. Confidential consultation with design directors.</p>
                    </div>

                    {formError && (
                      <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl p-3.5 text-xs font-mono">
                        {formError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">First Name *</label>
                        <div className="relative">
                          <input
                            type="text"
                            name="fname"
                            autoComplete="given-name"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            placeholder="Enter your name"
                            className="luxury-input-dark w-full rounded-xl py-3.5 px-4 text-[16px] sm:text-xs"
                            required
                          />
                          <User className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">WhatsApp Number *</label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="10-digit mobile number"
                            className="luxury-input-dark w-full rounded-xl py-3.5 px-4 text-[16px] sm:text-xs"
                            required
                          />
                          <PhoneCall className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">Email Address (Optional)</label>
                        <div className="relative">
                          <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="yourname@domain.com"
                            className="luxury-input-dark w-full rounded-xl py-3.5 px-4 text-[16px] sm:text-xs"
                          />
                          <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
                        </div>
                      </div>

                      {/* City */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">Your City *</label>
                        <div className="relative">
                          <input
                            type="text"
                            name="city"
                            autoComplete="address-level2"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            placeholder="City (e.g. Mumbai, Bangalore)"
                            className="luxury-input-dark w-full rounded-xl py-3.5 px-4 text-[16px] sm:text-xs"
                            required
                          />
                          <MapPin className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
                        </div>
                      </div>
                    </div>

                    {/* Budget */}
                    <div className="space-y-1.5">
                      <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">Estimated Investment Target</label>
                      <select
                        value={budget}
                        onChange={e => setBudget(e.target.value)}
                        className="luxury-input-dark w-full rounded-xl py-3.5 px-4 text-[16px] sm:text-xs appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#050505] text-white">Select budget range</option>
                        <option value="₹75,000 - ₹1,50,000" className="bg-[#050505] text-white">₹75,000 - ₹1,50,000 (Solitaires & Bands)</option>
                        <option value="₹1,50,000 - ₹3,00,000" className="bg-[#050505] text-white">₹1,50,000 - ₹3,00,000 (Custom Engagement)</option>
                        <option value="₹3,00,000 - ₹5,00,000" className="bg-[#050505] text-white">₹3,00,000 - ₹5,00,000 (Bridal Sets)</option>
                        <option value="₹5,00,000+" className="bg-[#050505] text-white">₹5,00,000+ (Grand Heirloom Commissions)</option>
                      </select>
                    </div>

                    {/* Preferred Contact Method */}
                    <div className="space-y-2">
                      <label className="block text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold font-mono">Preferred Communication Channel</label>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                          { id: 'phone', label: 'Phone', icon: PhoneCall },
                          { id: 'video', label: 'Video Call', icon: Video }
                        ].map((m) => (
                          <label 
                            key={m.id}
                            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center cursor-pointer active:scale-95 transition-all duration-300 ${preferredContact === m.id ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-white/10 hover:border-white/20 text-white/50'}`}
                          >
                            <input
                              type="radio"
                              name="contact"
                              value={m.id}
                              checked={preferredContact === m.id}
                              onChange={() => setPreferredContact(m.id)}
                              className="sr-only"
                            />
                            <m.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-1 text-[#D4AF37]" />
                            <span className="text-[9px] sm:text-[10px] font-semibold">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="w-full sm:w-auto text-xs text-white/40 hover:text-white font-mono uppercase tracking-widest px-4 py-2.5 sm:py-3 active:scale-95 transition-transform"
                      >
                        &larr; Back
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:flex-1 bg-[#D4AF37] text-[#050505] font-semibold hover:bg-[#E8D7A8] active:scale-98 py-3.5 sm:py-4 rounded-full text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 shadow-xl shadow-[#D4AF37]/10"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Reserving...</span>
                          </>
                        ) : (
                          <>
                            <span>Complete Reservation</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[9.5px] sm:text-[10px] text-white/40 text-center font-light pt-1 sm:pt-2">
                      Strict privacy. Zero obligation. Crafted only after your complete digital CAD approval.
                    </p>
                  </form>
                )}
              </div>
            )}

          </div>

          {/* Guarantees / Trust Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center text-[8.5px] sm:text-[10px] uppercase font-mono tracking-[0.15em] sm:tracking-[0.18em] text-white/60 pt-2 sm:pt-6">
            <div className="p-3 sm:p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col items-center gap-1.5 sm:gap-2">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37]" />
              <span>IGI & GIA Certified</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col items-center gap-1.5 sm:gap-2">
              <Diamond className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37]" />
              <span>BIS 916 Hallmarked</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col items-center gap-1.5 sm:gap-2">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37]" />
              <span>Unlimited CAD Revisions</span>
            </div>
            <div className="p-3 sm:p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col items-center gap-1.5 sm:gap-2">
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37]" />
              <span>Insured Delivery</span>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050505] py-8 sm:py-12 text-center text-[9px] sm:text-[10px] text-white/40 border-t border-white/5 uppercase tracking-[0.2em] sm:tracking-[0.25em] font-mono px-4">
        <p>&copy; {new Date().getFullYear()} SHEWAH. ALL RIGHTS RESERVED. PRIVATE JEWELLERY ATELIER.</p>
      </footer>

    </div>
  )
}
