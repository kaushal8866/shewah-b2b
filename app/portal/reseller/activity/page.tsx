'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  Check,
  CheckCircle,
  MessageSquare,
  ShoppingBag,
  CreditCard,
  ChevronRight,
  Info,
  Calendar
} from 'lucide-react'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  link?: string
  is_read: boolean
  created_at: string
}

export default function ResellerActivityPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    setLoading(true)
    try {
      const res = await fetch('/api/portal/reseller/notifications')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setNotifications(data.notifications || [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch('/api/portal/reseller/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (!data.error) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        )
      }
    } catch {}
  }

  async function markAllRead() {
    try {
      const res = await fetch('/api/portal/reseller/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true })
      })
      const data = await res.json()
      if (!data.error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      }
    } catch {}
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading activity feed...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-2xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="p-4 lg:p-7 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5.5 h-5.5 text-amber-600 animate-pulse" />
            Activity &amp; Alerts
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time feed of storefront checkouts, chat messages, and payment verifications.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/50 py-1.5 px-3 rounded-xl transition-all"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <Bell className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">All Quiet Here</p>
          <p className="text-stone-400 text-xs mt-1">No alerts or notifications recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map(n => {
            // Resolve icon type
            let Icon = Info
            let iconColor = 'text-stone-500 bg-stone-50'
            if (n.type === 'order') {
              Icon = ShoppingBag
              iconColor = 'text-indigo-650 bg-indigo-50 border-indigo-100'
            } else if (n.type === 'message') {
              Icon = MessageSquare
              iconColor = 'text-amber-600 bg-amber-50 border-amber-100'
            } else if (n.type === 'payment' || n.type === 'sample') {
              Icon = CreditCard
              iconColor = 'text-green-700 bg-green-50 border-green-100'
            }

            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id)
                }}
                className={`border rounded-2xl p-4 transition-all shadow-sm flex items-start gap-3.5 relative ${
                  n.is_read
                    ? 'bg-white border-stone-200 hover:border-stone-300'
                    : 'bg-amber-50/20 border-amber-200 hover:bg-amber-50/30'
                }`}
              >
                {!n.is_read && (
                  <span className="absolute top-4.5 right-4 w-2 h-2 rounded-full bg-amber-600" />
                )}

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${iconColor}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-xs font-bold text-stone-900 leading-tight">{n.title}</h4>
                  <p className="text-xs text-stone-550 mt-1 leading-relaxed">{n.body}</p>
                  <p className="text-[9px] text-stone-400 font-semibold mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-stone-350" />
                    {new Date(n.created_at).toLocaleString('en-IN')}
                  </p>
                </div>

                {n.link && (
                  <Link
                    href={n.link}
                    className="p-1 border border-stone-200 rounded-lg text-stone-400 hover:text-amber-600 hover:border-amber-500/30 bg-white transition-all self-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
