import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean
}

// Elevation is a ground change plus a 1px rule — never a shadow.
export function Card({ accent, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative bg-white border border-stone-200 p-5',
        accent && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-accent',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-baseline justify-between gap-4', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-normal uppercase tracking-cta text-[13px] text-stone-800', className)}
      {...rest}
    />
  )
}

// Editorial heading. The serif is opted into deliberately, never applied to
// headings wholesale.
export function CardDisplayTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-serif font-normal text-lg text-stone-900', className)} {...rest} />
}
