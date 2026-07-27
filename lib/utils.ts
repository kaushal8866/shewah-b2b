import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(dateStr))
}


// REMOVED: generateOrderNumber / generateCADNumber.
// Both derived a serial from a row count, which collides under concurrency,
// and padded to 3 digits so they would have broken at 1000 records. Neither
// had any callers. Order numbers now come from Postgres sequences — see
// scripts/migrate_ledger_atomicity_and_coupon_limits.sql.

export function getDaysUntil(dateStr: string) {
  const today = new Date()
  const target = new Date(dateStr)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

// Low-saturation tonal status pills for the Architectural Authority palette.
// Each uses a soft tinted background with darker tonal text — no traffic-light
// brights.
export function getStatusColor(status: string): string {
  const danger  = 'bg-status-danger-bg text-status-danger-fg'
  const warning = 'bg-status-warning-bg text-status-warning-fg'
  const success = 'bg-status-success-bg text-status-success-fg'
  const info    = 'bg-status-info-bg text-status-info-fg'
  const neutral = 'bg-status-neutral-bg text-status-neutral-fg'
  const colors: Record<string, string> = {
    hot:         danger,
    warm:        warning,
    cold:        info,
    active:      success,
    inactive:    neutral,
    prospect:    neutral,
    contacted:   info,
    sample_sent: warning,
    delivered:   success,
    dispatched:  info,
    production:  warning,
    urgent:      danger,
    normal:      neutral,
    planned:     info,
    in_progress: warning,
    completed:   success,
  }
  return colors[status] || neutral
}

export const CIRCUITS = [
  { value: 'Gujarat', label: 'Gujarat' },
  { value: 'Maharashtra', label: 'Maharashtra' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'Rajasthan', label: 'Rajasthan' },
  { value: 'Delhi NCR', label: 'Delhi NCR' },
  { value: 'Punjab', label: 'Punjab' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Other', label: 'Other' },
]

