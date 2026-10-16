'use client'

import React from 'react'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_URL = 'https://wa.me/919662266360?text=Hi%2C%20I%20want%20a%20custom%20jewellery%20quote'

export function trackWhatsAppClick(label: string = 'floating_bubble') {
  if (typeof window !== 'undefined') {
    try {
      if ((window as any).dataLayer) {
        ;(window as any).dataLayer.push({
          event: 'whatsapp_click',
          event_category: 'engagement',
          event_label: label,
        })
      }
      if ((window as any).gtag) {
        ;(window as any).gtag('event', 'whatsapp_click', {
          event_category: 'engagement',
          event_label: label,
        })
      }
    } catch {
      // Best-effort tracking
    }
  }
}

export default function FloatingWhatsApp() {
  return (
    <aside aria-label="WhatsApp Concierge" className="fixed bottom-5 right-5 z-50">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsAppClick('floating_bubble')}
        aria-label="Chat on WhatsApp with Shewah Atelier"
        className="group flex items-center gap-2.5 bg-[#0E2233] hover:bg-[#132B40] text-[#F7F3EA] border border-[#C6A15B] px-4 py-3 rounded-none transition-all duration-200 active:scale-95 min-h-[48px]"
      >
        <MessageCircle className="w-5 h-5 text-[#25D366] fill-current shrink-0" />
        <span className="font-jakarta text-xs uppercase tracking-widest text-[#F7F3EA] font-semibold pr-1 hidden sm:inline-block">
          WhatsApp Concierge
        </span>
      </a>
    </aside>
  )
}
