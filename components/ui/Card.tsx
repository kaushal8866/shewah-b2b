import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean
}

export function Card({ accent, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl p-5',
        accent && 'before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:rounded-r-md before:bg-primary-600',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-baseline justify-between', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display font-semibold text-stone-900 text-base tracking-tight', className)} {...rest} />
}
