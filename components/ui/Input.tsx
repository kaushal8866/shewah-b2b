'use client'

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// An underline, not a box. Focus is a 1px accent rule reinforced by a matching
// shadow, which reads as a 2px rule without introducing a border box.
const fieldBase =
  'w-full bg-transparent border-0 border-b border-stone-300 px-0 py-2 text-base text-stone-800 ' +
  'placeholder-stone-400 outline-none transition-colors hover:border-stone-400 ' +
  'focus:border-accent focus:shadow-[0_1px_0_0_theme(colors.accent.DEFAULT)] ' +
  'disabled:text-stone-400 disabled:border-dashed'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...rest} />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'resize-y', className)} {...rest} />
  )
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...rest }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'pr-8 appearance-none', className)} {...rest} />
  )
)
Select.displayName = 'Select'

// Micro caption above the control.
export function Label({ className, ...rest }: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-[10px] uppercase tracking-micro text-stone-500', className)}
      {...rest}
    />
  )
}

// Help and error share one slot, so the field never changes height on failure.
export function FieldHelp({ error, className, ...rest }: HTMLAttributes<HTMLParagraphElement> & { error?: boolean }) {
  return (
    <p
      className={cn('text-[13px] leading-5', error ? 'text-status-danger-fg' : 'text-stone-400', className)}
      {...rest}
    />
  )
}

export function Field({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2', className)} {...rest} />
}
