'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'outline' | 'tertiary' | 'ghost' | 'danger' | 'cta' | 'cta-quiet'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Tracked uppercase at weight 400 — emphasis comes from letter-spacing, never
// from bold. Radius is already flattened globally by the Tailwind config.
const base =
  'inline-flex items-center justify-center gap-2 font-normal uppercase tracking-cta transition-colors ' +
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-accent disabled:opacity-35 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:  'bg-stone-800 text-white border border-stone-800 hover:bg-accent hover:border-accent',
  outline:  'bg-transparent text-stone-800 border border-stone-800 hover:bg-stone-800 hover:text-white',
  // Retained so existing `variant="tertiary"` call sites keep compiling.
  tertiary: 'bg-stone-100 text-stone-800 border border-stone-200 hover:bg-stone-200',
  ghost:    'bg-transparent text-stone-600 border border-transparent hover:text-stone-900',
  danger:   'bg-status-danger-fg text-white border border-status-danger-fg hover:opacity-90',
  // The signature component: a hairline under tracked text. No fill, no box.
  'cta':       'bg-transparent border-b border-stone-900 text-stone-800 hover:border-accent hover:text-stone-900',
  'cta-quiet': 'bg-transparent border-b border-stone-300 text-stone-500 hover:border-accent hover:text-stone-800',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[11px]',
  md: 'h-11 px-6 text-[13px]',
  lg: 'h-14 px-8 text-[13px]',
}

// The text-CTA variants are not boxes, so they take no height and no x-padding.
const ctaSizes: Record<Size, string> = {
  sm: 'text-[11px] pb-2',
  md: 'text-[13px] pb-2.5',
  lg: 'text-[13px] pb-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => {
    const isCta = variant === 'cta' || variant === 'cta-quiet'
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], isCta ? ctaSizes[size] : sizes[size], className)}
        {...rest}
      />
    )
  }
)
Button.displayName = 'Button'
