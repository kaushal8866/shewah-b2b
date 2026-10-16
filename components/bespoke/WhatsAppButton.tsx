'use client'

import React from 'react'
import { MessageCircle } from 'lucide-react'
import { trackWhatsAppClick } from './FloatingWhatsApp'

interface WhatsAppButtonProps {
  href: string
  label: string
  trackingLabel?: string
  variant?: 'primary' | 'outline' | 'card'
  className?: string
  children?: React.ReactNode
}

export default function WhatsAppButton({
  href,
  label,
  trackingLabel = 'bespoke_whatsapp_click',
  variant = 'outline',
  className = '',
  children,
}: WhatsAppButtonProps) {
  const baseClass =
    'inline-flex items-center justify-center gap-2 min-h-[44px] font-jakarta text-xs uppercase tracking-[0.16em] font-semibold rounded-none transition-colors duration-200 active:scale-[0.98]'

  let variantClass = ''
  if (variant === 'primary') {
    variantClass = 'bg-[#C6A15B] text-[#0E2233] hover:bg-[#E9C178]'
  } else if (variant === 'card') {
    variantClass =
      'w-full bg-transparent border border-[#C6A15B] text-[#C6A15B] hover:bg-[#C6A15B] hover:text-[#0E2233] py-3.5 px-4 text-center'
  } else {
    variantClass =
      'bg-transparent border border-[#C6A15B] text-[#F7F3EA] hover:bg-[#C6A15B]/15 hover:border-[#E9C178]'
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick(trackingLabel)}
      className={`${baseClass} ${variantClass} ${className}`}
    >
      <MessageCircle className="w-4 h-4 fill-current shrink-0" />
      <span>{children || label}</span>
    </a>
  )
}
