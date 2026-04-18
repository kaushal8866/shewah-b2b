'use client'

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full bg-stone-50 border border-transparent rounded-xl px-3.5 text-sm text-stone-900 placeholder-stone-400 outline-none transition-colors focus:bg-white focus:ring-4 focus:ring-primary-500/15 focus:border-primary-500/40'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...rest} />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'py-2.5 resize-y', className)} {...rest} />
  )
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...rest }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'h-10 pr-8 appearance-none', className)} {...rest} />
  )
)
Select.displayName = 'Select'
