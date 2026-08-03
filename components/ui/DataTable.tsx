import { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * FUNCTIONAL TIER
 *
 * The system's answer to dense data. Palette, family and zero radius are
 * identical to the editorial tier, but weight 500 and tabular figures are
 * permitted here — a 200-row ledger has to stay scannable, and 400-weight
 * low-contrast grey does not survive that.
 *
 * Use on operational screens only (tables, dashboards, ledgers). Client-facing
 * pages use the editorial tier.
 */

// Wide data scrolls in its own container so the page body never moves sideways.
export function TableScroller({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full overflow-x-auto', className)} {...rest} />
}

export function DataTable({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse tabular-nums', className)} {...rest} />
}

export function Th({ className, numeric, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'border-b border-stone-200 px-3 py-2.5 text-[10px] font-medium uppercase tracking-micro text-stone-500 whitespace-nowrap',
        numeric ? 'text-right' : 'text-left',
        className
      )}
      {...rest}
    />
  )
}

export function Td({ className, numeric, strong, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; strong?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-stone-200 px-3 py-2.5 text-[13px] leading-5 text-stone-800',
        numeric && 'text-right tabular-nums',
        strong && 'font-medium text-stone-900',
        className
      )}
      {...rest}
    />
  )
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-stone-50', className)} {...rest} />
}
