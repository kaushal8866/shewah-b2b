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
        className="group flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 min-h-[48px]"
      >
        <MessageCircle className="w-6 h-6 shrink-0 fill-current" />
        <span className="text-xs font-semibold tracking-wide pr-1 hidden sm:inline-block">
          Chat on WhatsApp
        </span>
      </a>
    </aside>
  )
}
