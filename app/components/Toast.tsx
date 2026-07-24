'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; title?: string; message: string; type: ToastType }

/**
 * Two call styles are supported:
 *   toast('Saved')
 *   toast('Could not save', 'error')
 *   toast({ title: 'Error', message: e.message, type: 'error' })
 *
 * The object form was already in use across the diamond-procurement screens
 * while this hook only accepted a string — so `message` was rendered as a raw
 * object, which React throws on ("Objects are not valid as a React child").
 * Accepting both shapes fixes those call sites and adds the title they wanted.
 */
type ToastInput = string | { title?: string; message: string; type?: ToastType }

const ToastContext = createContext<{
  toast: (input: ToastInput, type?: ToastType) => void
}>({ toast: () => {} })

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((input: ToastInput, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    const item: ToastItem =
      typeof input === 'string'
        ? { id, message: input, type }
        : { id, title: input.title, message: input.message, type: input.type ?? type }
    setToasts(prev => [...prev, item])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[60] space-y-2 max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm animate-slide-up ${colors[t.type]}`}>
              <Icon className={`w-4 h-4 shrink-0 ${iconColors[t.type]}`} />
              <div className="flex-1 min-w-0">
                {t.title && <p className="font-semibold">{t.title}</p>}
                <p className={t.title ? 'opacity-90' : undefined}>{t.message}</p>
              </div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
