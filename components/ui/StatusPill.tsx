import { HTMLAttributes } from 'react'
import { cn, getStatusColor } from '@/lib/utils'

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: string
  label?: string
}

export function StatusPill({ status, label, className, ...rest }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusColor(status),
        className
      )}
      {...rest}
    >
      {label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
