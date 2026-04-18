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

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function generateOrderNumber(count: number) {
  const year = new Date().getFullYear()
  return `SH-ORD-${year}-${String(count).padStart(3, '0')}`
}

export function generateCADNumber(count: number) {
  const year = new Date().getFullYear()
  return `SH-CAD-${year}-${String(count).padStart(3, '0')}`
}

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
