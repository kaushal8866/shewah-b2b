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
    'inline-flex items-center justify-center gap-2 min-h-[44px] text-xs uppercase tracking-widest font-semibold rounded-lg transition-all active:scale-[0.98]'

  let variantClass = ''
  if (variant === 'primary') {
    variantClass = 'bg-[#25D366] hover:bg-[#20ba59] text-white shadow-md'
  } else if (variant === 'card') {
    variantClass =
      'w-full bg-[#051F34] hover:bg-[#A88A4F] text-white py-2.5 px-4 rounded-xl shadow-sm'
  } else {
    variantClass =
      'border border-[#25D366]/50 hover:border-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366]'
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
