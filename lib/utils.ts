import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amountPaise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amountPaise / 100)
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
