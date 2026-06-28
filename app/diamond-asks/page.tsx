'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/app/components/Toast'
import {
  Loader2, Search, Filter, AlertTriangle, ShieldAlert, CheckCircle,
  XCircle, Clock, ArrowRight, MessageSquare, Clipboard, BadgeAlert, Sparkles
} from 'lucide-react'

type Partner = {
  id: string
  store_name: string
  phone: string
  diamond_tier: 'starter' | 'silver' | 'gold' | 'platinum'
  custom_diamond_discount_limit: number | null
}

type Ask = {
  id: string
  diamond_type: 'lgd' | 'natural'
  original_price_per_pc: number
  original_price_per_ct: number
  asked_price: number
  asked_unit: 'per_pc' | 'per_ct'
  quantity: number
  reason: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'converted_to_order' | 'expired'
  approved_price: number | null
  approved_unit: 'per_pc' | 'per_ct' | null
  admin_notes: string | null
  expiry_at: string
  purchase_window_expiry_at: string | null
  created_at: string
  exceeds_limit: boolean
  partner?: Partner
  shape?: { name: string }
  size?: { label: string; approx_carats: number }
  quality?: { label: string }
  color?: { label: string }
}

export default function AdminDiamondAsksPage() {
  const { toast } = useToast()
  const [asks, setAsks] = useState<Ask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAskId, setSelectedAskId] = useState<string | null>(null)

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('newest')

  // Decision Form State
  const [decisionPrice, setDecisionPrice] = useState('')
  const [decisionUnit, setDecisionUnit] = useState<'per_pc' | 'per_ct'>('per_pc')
  const [decisionNotes, setDecisionNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  const loadAsks = async () => {
    try {
      const res = await fetch('/api/diamond-asks')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load asks')
      setAsks(data.asks || [])
    } catch (e: any) {
      toast({ title: 'Error', message: e.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAsks()
  }, [])

  const selectedAsk = asks.find(a => a.id === selectedAskId) || null

  // Pre-fill decision fields when selected ask changes
  useEffect(() => {
    if (selectedAsk) {
      setDecisionPrice(String(selectedAsk.asked_price))
      setDecisionUnit(selectedAsk.asked_unit)
      setDecisionNotes('')
    }
  }, [selectedAskId])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedAsk) return
    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/diamond-asks/${selectedAsk.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPrice: parseFloat(decisionPrice),
          approvedUnit: decisionUnit,
          adminNotes: decisionNotes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action execution failed')

      toast({
        title: action === 'approve' ? 'Ask Approved' : 'Ask Rejected',
        message: `Successfully processed the ask proposal.`,
        type: 'success'
      })
      await loadAsks()
    } catch (e: any) {
      toast({ title: 'Error', message: e.message, type: 'error' })
    } finally {
      setSubmittingAction(false)
    }
  }

  // Analytics Helpers
  const pendingCount = asks.filter(a => a.status === 'pending').length
  const limitBreakers = asks.filter(a => a.status === 'pending' && a.exceeds_limit).length
  const convertedCount = asks.filter(a => a.status === 'converted_to_order').length

  // Filter & Sort Logic
  const filteredAsks = asks
    .filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (typeFilter !== 'all' && a.diamond_type !== typeFilter) return false
      if (search.trim()) {
        const term = search.toLowerCase()
        const store = a.partner?.store_name?.toLowerCase() || ''
        const sizeLabel = a.size?.label?.toLowerCase() || ''
        const shapeName = a.shape?.name?.toLowerCase() || ''
        return store.includes(term) || sizeLabel.includes(term) || shapeName.includes(term)
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'largest_qty') return b.quantity - a.quantity
      if (sortBy === 'gap') {
        const gapA = ((a.original_price_per_pc - (a.asked_unit === 'per_ct' ? a.asked_price * (a.size?.approx_carats || 0) : a.asked_price)) / a.original_price_per_pc)
        const gapB = ((b.original_price_per_pc - (b.asked_unit === 'per_ct' ? b.asked_price * (b.size?.approx_carats || 0) : b.asked_price)) / b.original_price_per_pc)
        return gapB - gapA
      }
      return 0
    })

  const getGapPercent = (ask: Ask) => {
    const approx = ask.size?.approx_carats || 0
    const askedPc = ask.asked_unit === 'per_ct' ? ask.asked_price * approx : ask.asked_price
    const diff = ask.original_price_per_pc - askedPc
    return ((diff / ask.original_price_per_pc) * 100).toFixed(0)
  }

  const getStatusBadge = (status: string) => {
    const base = "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider "
    switch (status) {
      case 'pending':
        return base + "bg-blue-50 text-blue-700 border border-blue-150"
      case 'approved':
        return base + "bg-emerald-50 text-emerald-700 border border-emerald-150"
      case 'rejected':
        return base + "bg-red-50 text-red-700 border border-red-150"
      case 'converted_to_order':
        return base + "bg-stone-100 text-stone-700 border border-stone-200"
      case 'expired':
      default:
        return base + "bg-stone-50 text-stone-400 border border-stone-150"
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-64px)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#1E3A5F]" /> Loose Diamond Asks
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Manage price negotiations and loose diamond procurement bids.</p>
        </div>
      </div>

      {/* Analytics Summary Banner */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Pending Asks</p>
            <p className="text-2xl font-black text-stone-900 mt-1">{pendingCount}</p>
          </div>
          <Clock className="w-8 h-8 text-blue-500/25" />
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tier limit Exceeded</p>
            <p className="text-2xl font-black text-red-600 mt-1">{limitBreakers}</p>
          </div>
          <ShieldAlert className="w-8 h-8 text-red-500/25" />
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Converted Orders</p>
            <p className="text-2xl font-black text-stone-900 mt-1">{convertedCount}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-500/25" />
        </div>
      </div>

      {/* Main Workspace Split-Pane */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Left Pane: List */}
        <div className="w-full md:w-5/12 bg-white border border-stone-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {/* List Search & Filter Bar */}
          <div className="p-4 border-b border-stone-150 space-y-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
              <input type="text" placeholder="Search by store or specs..." className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 outline-none"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select className="bg-stone-50 border border-stone-200 text-stone-600 text-[11px] px-2.5 py-1.5 rounded-lg font-bold"
                value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setSelectedAskId(null) }}>
                <option value="pending">Status: Pending</option>
                <option value="approved">Status: Approved</option>
                <option value="rejected">Status: Rejected</option>
                <option value="converted_to_order">Status: Ordered</option>
                <option value="expired">Status: Expired</option>
                <option value="all">Status: All Asks</option>
              </select>

              <select className="bg-stone-50 border border-stone-200 text-stone-600 text-[11px] px-2.5 py-1.5 rounded-lg font-bold"
                value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="gap">Sort: Largest Gap</option>
                <option value="largest_qty">Sort: Largest Qty</option>
              </select>
            </div>
          </div>

          {/* Scrollable Asks List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2 space-y-1.5">
            {loading ? (
              <div className="text-center py-20">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
                <p className="text-xs text-stone-500 mt-2 font-medium">Loading asks...</p>
              </div>
            ) : filteredAsks.length === 0 ? (
              <div className="text-center py-20 text-stone-400 space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-stone-300" />
                <p className="text-xs font-semibold">No matching asks found</p>
              </div>
            ) : (
              filteredAsks.map(ask => {
                const active = selectedAskId === ask.id
                const specs = `${ask.size?.label || ''} ${ask.quality?.label || ''}-${ask.color?.label || ''} ${ask.shape?.name || ''}`
                const gap = getGapPercent(ask)

                return (
                  <button key={ask.id} onClick={() => setSelectedAskId(ask.id)}
                    className={`w-full text-left p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all outline-none ${
                      active
                        ? 'bg-[#1E3A5F]/5 border-[#1E3A5F]'
                        : 'border-stone-150 hover:bg-stone-50'
                    }`}>
                    <div className="flex items-start justify-between w-full">
                      <div>
                        <h4 className="font-bold text-stone-900 text-xs truncate max-w-[180px]">{ask.partner?.store_name}</h4>
                        <p className="text-[10px] text-stone-400 font-semibold uppercase mt-0.5 tracking-wider">{specs} ({ask.diamond_type === 'lgd' ? 'LGD' : 'Natural'})</p>
                      </div>
                      <span className={getStatusBadge(ask.status)}>{ask.status.replace(/_/g, ' ')}</span>
                    </div>

                    <div className="flex justify-between items-center w-full">
                      <div className="text-[10px] text-stone-500 font-bold">
                        <span>Asked: </span>
                        <span className="text-[#1E3A5F] font-black">
                          ₹{ask.asked_price.toLocaleString('en-IN')}/{ask.asked_unit === 'per_pc' ? 'pc' : 'ct'}
                        </span>
                        <span className="mx-1 text-stone-300">·</span>
                        <span>Qty: {ask.quantity}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ask.status === 'pending' && ask.exceeds_limit && (
                          <span className="flex items-center gap-0.5 bg-red-50 text-red-700 text-[8px] font-black uppercase border border-red-200 px-1.5 py-0.5 rounded">
                            <BadgeAlert className="w-2.5 h-2.5" /> LIMIT
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                          -{gap}%
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane: Details & Decision Workspace */}
        <div className="hidden md:flex flex-col flex-1 bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          {!selectedAsk ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-stone-400">
              <Clipboard className="w-10 h-10 text-stone-300" />
              <p className="font-bold text-stone-700 text-sm">Select negotiation ask</p>
              <p className="text-xs max-w-xs leading-relaxed text-stone-450">
                Choose an ask from the left panel list to audit, approve counter-offers, or reject.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Detail Header */}
              <div className="p-5 border-b border-stone-100 flex justify-between items-start shrink-0">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">{selectedAsk.partner?.store_name}</h3>
                  <p className="text-xs text-stone-400 font-semibold mt-0.5">Tier: <span className="capitalize text-stone-600 font-bold">{selectedAsk.partner?.diamond_tier}</span> · Phone: {selectedAsk.partner?.phone}</p>
                </div>
                <div className="text-right text-xs text-stone-450 font-bold">
                  <p>Submitted Ask</p>
                  <p className="text-stone-350 text-[10px] font-medium mt-0.5">
                    {new Date(selectedAsk.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Specs & Audit Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Diamond Specifications</label>
                  <div className="grid grid-cols-2 gap-3 bg-stone-50 border border-stone-150 p-4 rounded-xl text-xs text-stone-700">
                    <p><span className="text-stone-400 font-bold">Type:</span> <span className="capitalize">{selectedAsk.diamond_type === 'lgd' ? 'Lab Grown (LGD)' : 'Natural'}</span></p>
                    <p><span className="text-stone-400 font-bold">Shape:</span> <span className="capitalize">{selectedAsk.shape?.name}</span></p>
                    <p><span className="text-stone-400 font-bold">Size Label:</span> {selectedAsk.size?.label}</p>
                    <p><span className="text-stone-400 font-bold">Approx Weight:</span> {selectedAsk.size?.approx_carats?.toFixed(3)} ct/pc</p>
                    <p><span className="text-stone-400 font-bold">Clarity Bucket:</span> {selectedAsk.quality?.label}</p>
                    <p><span className="text-stone-400 font-bold">Color Range:</span> {selectedAsk.color?.label}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Original Rates</label>
                    <p className="text-xs text-stone-700 font-bold">₹{selectedAsk.original_price_per_pc.toLocaleString('en-IN')}/pc</p>
                    <p className="text-[10px] text-stone-400 font-semibold">₹{selectedAsk.original_price_per_ct.toLocaleString('en-IN')}/ct</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Asked Rates</label>
                    <p className="text-xs text-[#1E3A5F] font-black">
                      ₹{selectedAsk.asked_price.toLocaleString('en-IN')}/{selectedAsk.asked_unit === 'per_pc' ? 'pc' : 'ct'}
                    </p>
                    <p className="text-[10px] text-stone-400 font-bold">Quantity: {selectedAsk.quantity} Pcs</p>
                  </div>
                </div>

                {selectedAsk.reason && (
                  <div className="space-y-1.5 border-t border-stone-100 pt-4">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Retailer justification</label>
                    <p className="italic bg-stone-50 border border-stone-150 p-3 rounded-lg text-xs text-stone-550 leading-relaxed">
                      " {selectedAsk.reason} "
                    </p>
                  </div>
                )}

                {selectedAsk.status === 'pending' && selectedAsk.exceeds_limit && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
                    <div>
                      <p className="font-bold">Discount Limit Violation</p>
                      <p className="leading-relaxed mt-0.5">This ask proposes a {getGapPercent(selectedAsk)}% discount, which exceeds their tier limit of {selectedAsk.partner?.custom_diamond_discount_limit ?? (selectedAsk.partner?.diamond_tier === 'silver' ? 15 : selectedAsk.partner?.diamond_tier === 'gold' ? 20 : selectedAsk.partner?.diamond_tier === 'platinum' ? 25 : 10)}%. Proceeding requires explicit master override approval.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Decision Pane */}
              <div className="p-5 bg-stone-50 border-t border-stone-150 shrink-0">
                {selectedAsk.status === 'pending' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Approved Price (Counter offer)</label>
                        <input type="number" step="any" min="0.01" className="w-full bg-white border border-stone-250 text-stone-800 text-xs px-3 py-2.5 rounded-lg font-bold"
                          value={decisionPrice} onChange={e => setDecisionPrice(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Approved Unit</label>
                        <select className="w-full bg-white border border-stone-250 text-stone-850 text-xs px-2 py-2.5 rounded-lg font-bold"
                          value={decisionUnit} onChange={e => setDecisionUnit(e.target.value as any)}>
                          <option value="per_pc">/ pc</option>
                          <option value="per_ct">/ ct</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Admin Response &amp; Notes</label>
                      <textarea rows={2} className="w-full bg-white border border-stone-250 text-stone-850 text-xs px-3 py-2 rounded-lg font-semibold resize-none"
                        placeholder="Provide details to the retailer explaining counter-offer/rejection reason..."
                        value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleAction('reject')} disabled={submittingAction}
                        className="flex-1 bg-red-600 hover:bg-red-755 text-white py-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" />
                        REJECT ASK
                      </button>
                      <button onClick={() => handleAction('approve')} disabled={submittingAction}
                        className="flex-1 bg-[#1E3A5F] hover:bg-[#162B47] text-white py-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {submittingAction ? <Loader2 className="w-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        APPROVE Counter Price
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-150/50 rounded-xl p-4 text-xs text-stone-500 space-y-2">
                    <p className="font-bold text-stone-700">Audit Trail</p>
                    <p>Status: <span className="capitalize font-bold text-stone-800">{selectedAsk.status.replace(/_/g, ' ')}</span></p>
                    {selectedAsk.approved_price && (
                      <p>Approved Rate: <span className="font-bold text-stone-800">₹{selectedAsk.approved_price.toLocaleString('en-IN')}/{selectedAsk.approved_unit === 'per_pc' ? 'pc' : 'ct'}</span></p>
                    )}
                    {selectedAsk.admin_notes && (
                      <p>Admin note: <span className="italic text-stone-600">"{selectedAsk.admin_notes}"</span></p>
                    )}
                    {selectedAsk.purchase_window_expiry_at && (
                      <p>Purchase window: <span className="font-medium text-stone-600">Expired/Active till {new Date(selectedAsk.purchase_window_expiry_at).toLocaleString('en-IN')}</span></p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
