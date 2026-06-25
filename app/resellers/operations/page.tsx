'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  Clock,
  Briefcase,
  Users,
  ShoppingBag,
  DollarSign,
  ChevronRight,
  ShieldAlert,
  Megaphone,
  CheckCircle,
  ExternalLink
} from 'lucide-react'

export default function ResellerOperationsHub() {
  const [resellers, setResellers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastSuccess, setBroadcastSuccess] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // 1. Fetch all resellers
      const res1 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'resellers', op: 'select' })
      })
      const d1 = await res1.json()
      if (d1.error) throw new Error(d1.error.message)
      setResellers(d1.data || [])

      // 2. Fetch reseller orders
      const res2 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'reseller_orders', op: 'select', select: '*, products(code, name)' })
      })
      const d2 = await res2.json()
      if (d2.error) throw new Error(d2.error.message)
      setOrders(d2.data || [])

      // 3. Fetch samples ledger
      const res3 = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'reseller_sample_ledger', op: 'select', select: '*, products(code, name)' })
      })
      const d3 = await res3.json()
      if (d3.error) throw new Error(d3.error.message)
      setSamples(d3.data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load operations dashboard.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePostBroadcast(e: React.FormEvent) {
    e.preventDefault()
    if (!broadcastText.trim()) return

    setBroadcasting(true)
    setBroadcastSuccess(false)

    try {
      // Insert a system broadcast notification into reseller_notifications for ALL resellers
      const notificationsToInsert = resellers
        .filter(r => r.status === 'active')
        .map(r => ({
          reseller_id: r.id,
          title: 'System Announcement',
          body: broadcastText,
          type: 'message',
          link: '/portal/reseller'
        }))

      if (notificationsToInsert.length === 0) {
        alert('No active resellers to broadcast to.')
        setBroadcasting(false)
        return
      }

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'reseller_notifications',
          op: 'insert',
          values: notificationsToInsert
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      setBroadcastSuccess(true)
      setBroadcastText('')
      setTimeout(() => setBroadcastSuccess(false), 3000)
    } catch (err: any) {
      alert('Broadcast failed: ' + err.message)
    } finally {
      setBroadcasting(false)
    }
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading operations control board...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  // Aggregated calculations
  const totalResellers = resellers.length
  const activeResellers = resellers.filter(r => r.status === 'active').length
  const suspendedResellers = resellers.filter(r => r.status === 'suspended').length

  const totalB2BVolumePaise = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.reseller_cost_paise || 0), 0)

  const totalOutstandingPaise = resellers.reduce((sum, r) => sum + Number(r.outstanding_balance_paise || 0), 0)
  const totalCreditLimitPaise = resellers.reduce((sum, r) => sum + Number(r.credit_limit_paise || 0), 0)

  // Risk & Flags
  const now = new Date()
  const overdueSamples = samples.filter(s => s.status === 'issued' && new Date(s.return_due_date) < now)
  const overdueOrders = orders.filter(o => o.status === 'payment_pending' && new Date(o.payment_deadline) < now)

  // High credit utilization flag (> 80%)
  const highRiskResellers = resellers.filter(r => {
    const limit = Number(r.credit_limit_paise) || 0
    const owed = Number(r.outstanding_balance_paise) || 0
    return limit > 0 && owed / limit > 0.8
  })

  return (
    <div className="p-4 lg:p-7 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Activity className="w-5.5 h-5.5 text-amber-600" />
          Reseller Operations Hub
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Ecosystem health tracking, risk moderation, overdue samples, and network-wide broadcasts.
        </p>
      </div>

      {/* Grid: Financial & Network metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Network Size</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-stone-850">{totalResellers}</p>
          <p className="text-[10px] text-stone-450">
            {activeResellers} active · {suspendedResellers} suspended
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">B2B Trade Volume</span>
            <ShoppingBag className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-green-650">₹{(totalB2BVolumePaise / 100).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-stone-450">Gross wholesale floor revenue</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outstanding / Limit</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-red-650">
            ₹{(totalOutstandingPaise / 100).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-stone-450">
            Limit: ₹{(totalCreditLimitPaise / 100).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-1">
          <div className="flex justify-between items-center text-stone-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Samples</span>
            <Briefcase className="w-4 h-4 text-red-500" />
          </div>
          <p className={`text-2xl font-black ${overdueSamples.length > 0 ? 'text-red-650' : 'text-stone-850'}`}>
            {overdueSamples.length}
          </p>
          <p className="text-[10px] text-stone-450">Sample boxes exceeding return deadline</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Risk & Moderation */}
        <div className="lg:col-span-7 space-y-6">
          {/* Overdue Payment Orders */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5 border-b border-stone-100">
              <Clock className="w-4 h-4 text-red-500" /> Overdue Dropship Payments ({overdueOrders.length})
            </h3>
            {overdueOrders.length === 0 ? (
              <p className="text-stone-400 text-xs py-2">No pending payments are currently overdue.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {overdueOrders.map(o => (
                  <div key={o.id} className="p-3 bg-red-50/50 border border-red-150 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-black text-red-800">{o.order_number}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        Floor Cost: ₹{(o.reseller_cost_paise / 100).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[9px] text-red-700 mt-0.5">
                        Deadline: {new Date(o.payment_deadline).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <Link
                      href={`/resellers/${o.reseller_id}`}
                      className="text-xs font-bold text-stone-700 hover:text-amber-600 flex items-center gap-0.5"
                    >
                      Boutique Profile <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High Credit Utilization Warnings */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5 border-b border-stone-100">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> High Credit Risk Alerts ({highRiskResellers.length})
            </h3>
            {highRiskResellers.length === 0 ? (
              <p className="text-stone-400 text-xs py-2">All resellers have safe credit limits.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {highRiskResellers.map(r => {
                  const limit = Number(r.credit_limit_paise) || 0
                  const owed = Number(r.outstanding_balance_paise) || 0
                  const pct = Math.round((owed / limit) * 100)
                  return (
                    <div key={r.id} className="p-3 bg-amber-50/30 border border-amber-200/50 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-stone-850">{r.store_name} ({r.owner_name})</p>
                        <p className="text-[10px] text-stone-500 mt-0.5">
                          Owed: ₹{(owed / 100).toLocaleString('en-IN')} / Limit: ₹{(limit / 100).toLocaleString('en-IN')}
                        </p>
                        <div className="w-28 bg-stone-100 rounded-full h-1.5 mt-2">
                          <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-red-650 shrink-0">{pct}% Used</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Broadcast & Overdue Samples */}
        <div className="lg:col-span-5 space-y-6">
          {/* Global Broadcast Broadcast Panel */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5 border-b border-stone-100">
              <Megaphone className="w-4 h-4 text-amber-600" /> Network Broadcast Alert
            </h3>
            <form onSubmit={handlePostBroadcast} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                  Broadcast Message
                </label>
                <textarea
                  className="w-full border border-stone-250 rounded-xl p-3 text-xs h-20 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white font-medium text-stone-800"
                  placeholder="Announce new collection releases, holiday hours, or policy adjustments..."
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  required
                />
              </div>

              {broadcastSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Broadcast sent successfully to all active boutiques!
                </div>
              )}

              <button
                type="submit"
                disabled={broadcasting || !broadcastText.trim()}
                className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {broadcasting ? 'Sending broadcast...' : 'Send Broadcast Notification'}
              </button>
            </form>
          </div>

          {/* Overdue Sample Boxes */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm pb-1 flex items-center gap-1.5 border-b border-stone-100">
              <Briefcase className="w-4 h-4 text-stone-400" /> Overdue Sample Returns ({overdueSamples.length})
            </h3>
            {overdueSamples.length === 0 ? (
              <p className="text-stone-400 text-xs py-2">All issued samples are within their return timeline.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {overdueSamples.map(s => (
                  <div key={s.id} className="p-3 bg-stone-50 border border-stone-150 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-stone-900">{s.products?.name || 'Sample Item'}</span>
                      <span className="text-red-650 font-black">₹{(s.sample_value_paise / 100).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[10px] text-stone-450">SKU: {s.products?.code || '—'}</p>
                    <p className="text-[9px] text-red-650 font-bold">
                      Due Date: {new Date(s.return_due_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
