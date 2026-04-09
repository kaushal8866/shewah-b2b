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

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    hot: 'bg-red-100 text-red-700',
    warm: 'bg-yellow-100 text-yellow-700',
    cold: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    prospect: 'bg-gray-100 text-gray-700',
    contacted: 'bg-blue-100 text-blue-800',
    sample_sent: 'bg-yellow-100 text-yellow-800',
    delivered: 'bg-green-100 text-green-800',
    dispatched: 'bg-teal-100 text-teal-800',
    production: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-700',
    normal: 'bg-gray-100 text-gray-600',
    planned: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
}
