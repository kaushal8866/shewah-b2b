'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export type CadRealtimeEvent = {
  id: string
  request_number: string
  status: string
  partner_feedback?: string | null
}

type ToastItem = {
  key: string
  cadId: string
  requestNumber: string
  kind: 'approval' | 'revision'
  message: string
}

// Tracks the most recent status we have toasted for a given CAD request so we
// don't fire duplicates when the row is updated multiple times in a row.
const seenStatus = new Map<string, string>()

// Subscribe to realtime UPDATE events on the `cad_requests` table. The
// optional `onChange` callback receives every changed row so the caller can
// patch its local state without a full refetch. Toasts are only shown when
// the new status is `approved` or `revision_requested` (the two events the
// retailer can trigger from their portal).
export function useCadRequestRealtimeToasts(opts?: {
  onChange?: (row: any) => void
  // When set, only surface toasts for this specific cad request id.
  scopeToId?: string
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const onChangeRef = useRef(opts?.onChange)
  const scopeRef = useRef(opts?.scopeToId)
  onChangeRef.current = opts?.onChange
  scopeRef.current = opts?.scopeToId

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key))
  }, [])

  useEffect(() => {
    // Unique topic per hook instance avoids cross-instance collisions if the
    // hook is ever mounted in more than one place at the same time.
    const topic = `cad_requests_realtime_${Math.random().toString(36).slice(2, 10)}`
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cad_requests' },
        (payload: any) => {
          const row = payload?.new
          if (!row?.id) return

          if (scopeRef.current && row.id !== scopeRef.current) {
            // Still let the parent know so it can refresh other rows.
            onChangeRef.current?.(row)
            return
          }

          onChangeRef.current?.(row)

          const status = String(row.status || '')
          const last = seenStatus.get(row.id)
          if (last === status) return
          seenStatus.set(row.id, status)

          if (status === 'approved') {
            const key = `${row.id}-approved-${Date.now()}`
            setToasts((prev) => [
              ...prev,
              {
                key,
                cadId: row.id,
                requestNumber: row.request_number || 'CAD request',
                kind: 'approval',
                message: 'Retailer approved the design',
              },
            ])
            setTimeout(() => dismiss(key), 8000)
          } else if (status === 'revision_requested' || status === 'revision') {
            const key = `${row.id}-revision-${Date.now()}`
            const note = (row.partner_feedback || '').trim()
            setToasts((prev) => [
              ...prev,
              {
                key,
                cadId: row.id,
                requestNumber: row.request_number || 'CAD request',
                kind: 'revision',
                message: note
                  ? `Retailer requested a revision: ${note.slice(0, 120)}${note.length > 120 ? '…' : ''}`
                  : 'Retailer requested a revision',
              },
            ])
            setTimeout(() => dismiss(key), 12000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dismiss])

  return { toasts, dismiss }
}

export function CadToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (key: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
      {toasts.map((t) => {
        const isApproval = t.kind === 'approval'
        const Icon = isApproval ? CheckCircle2 : AlertCircle
        const ring = isApproval ? 'border-green-200' : 'border-orange-200'
        const iconCls = isApproval ? 'text-green-600' : 'text-orange-600'
        const tint = isApproval ? 'bg-green-50' : 'bg-orange-50'
        return (
          <div
            key={t.key}
            className={`relative flex gap-3 items-start ${tint} ${ring} border rounded-xl shadow-sm p-3 pr-8`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconCls}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900">{t.requestNumber}</p>
              <p className="text-xs text-stone-600 mt-0.5">{t.message}</p>
              <Link
                href={`/cad-requests/${t.cadId}`}
                className="inline-block text-xs font-medium text-[#1E3A5F] hover:underline mt-1.5"
                onClick={() => onDismiss(t.key)}
              >
                View request →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.key)}
              aria-label="Dismiss"
              className="absolute top-2 right-2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
