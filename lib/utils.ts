import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Canonical money formatter — input is integer paise (₹1 = 100 paise).
 * Use this for all Phase 0+ monetary values.
 */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

/**
 * @deprecated Use formatPaise() for values stored as integer paise.
 * Kept for backward compatibility with old rupee-denomination values.
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a date string in IST (Asia/Kolkata).
 * Always use this — never format raw Date objects without timezone.
 */
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Format integer milligrams as a readable gram weight.
 * E.g. 5342 → "5.342g"
 */
export function formatGoldWeight(mg: number): string {
  return `${(mg / 1000).toFixed(3)}g`
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

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    hot: 'warning',
    warm: 'warning',
    cold: 'active',
    active: 'success',
    inactive: '',
    prospect: 'active',
    contacted: 'active',
    sample_sent: 'warning',
    delivered: 'success',
    dispatched: 'success',
    production: 'warning',
    urgent: 'warning',
    normal: '',
    planned: 'active',
    in_progress: 'warning',
    completed: 'success',
  }
  return map[status] || ''
}
