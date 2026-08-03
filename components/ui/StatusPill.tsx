import { HTMLAttributes } from 'react'
import { cn, getStatusColor } from '@/lib/utils'

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: string
  label?: string
}

// Rectangular, hairline-bordered, tracked uppercase. The wording carries the
// state on its own — color only reinforces it, never signals alone.
export function StatusPill({ status, label, className, ...rest }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-current px-2.5 py-1 text-[10px] font-normal uppercase tracking-micro',
        getStatusColor(status),
        className
      )}
      {...rest}
    >
      {label ?? status.replace(/_/g, ' ')}
    </span>
  )
}
