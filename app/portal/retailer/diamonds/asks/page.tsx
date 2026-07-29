'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/Toast'
import { MessageSquare, AlertCircle, ShoppingCart, Loader2, Clock, Check } from 'lucide-react'

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
  shape?: { name: string }
  size?: { label: string; approx_carats: number }
  quality?: { label: string }
  color?: { label: string }
}

export default function RetailerAsksPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [asks, setAsks] = useState<Ask[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [timeNow, setTimeNow] = useState<number>(Date.now())

  // Load asks list
  const loadAsks = async () => {
    try {
      const res = await fetch('/api/portal/retailer/diamonds/asks')
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
    const timer = setInterval(() => setTimeNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Purchase approved ask
  const handlePurchase = async (id: string) => {
    setPurchasingId(id)
    try {
      const res = await fetch(`/api/portal/retailer/diamonds/asks/${id}/purchase`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')

      toast({ title: 'Order Created', message: 'Loose diamond order placed successfully!', type: 'success' })
      router.push('/portal/retailer/diamonds/orders')
    } catch (e: any) {
      toast({ title: 'Error', message: e.message, type: 'error' })
    } finally {
      setPurchasingId(null)
    }
  }

  // Helper to format remaining time
  const getRemainingTime = (expiryStr: string | null) => {
    if (!expiryStr) return ''
    const diff = new Date(expiryStr).getTime() - timeNow
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const secs = Math.floor((diff % (1000 * 60)) / 1000)
    return `${hours}h ${mins}m ${secs}s left`
  }

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider "
    switch (status) {
      case 'pending':
        return base + "bg-blue-50 text-blue-700 border border-blue-200"
      case 'under_review':
        return base + "bg-amber-50 text-amber-700 border border-amber-200"
      case 'approved':
        return base + "bg-emerald-50 text-emerald-700 border border-emerald-200"
      case 'rejected':
        return base + "bg-red-50 text-red-700 border border-red-200"
      case 'converted_to_order':
        return base + "bg-stone-100 text-stone-700 border border-stone-200"
      case 'expired':
      default:
        return base + "bg-stone-50 text-stone-400 border border-stone-150"
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-stone-400" />
        <p className="text-xs text-stone-500 mt-2 font-medium">Loading negotiation asks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {asks.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-2.5 max-w-md mx-auto mt-6">
          <MessageSquare className="w-8 h-8 mx-auto text-stone-300" />
          <p className="font-bold text-stone-700 text-sm">No negotiations found</p>
          <p className="text-xs text-stone-450 leading-relaxed">
            You haven't submitted any loose diamond price asks. Browse the catalog to negotiate pricing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {asks.map(ask => {
            const isApproved = ask.status === 'approved'
            const isPending = ask.status === 'pending'
            const specsStr = `${ask.size?.label || ''} ${ask.quality?.label || ''}-${ask.color?.label || ''} ${ask.shape?.name || ''}`
            const typeStr = ask.diamond_type === 'lgd' ? 'LGD' : 'Natural'

            return (
              <div key={ask.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">{specsStr}</h4>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{typeStr}</p>
                    </div>
                    <span className={getStatusBadge(ask.status)}>{ask.status.replace(/_/g, ' ')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-y border-stone-100 py-3 mt-1">
                    <div>
                      <p className="text-stone-400 font-semibold">Original Quote</p>
                      <p className="text-stone-850 font-bold mt-0.5">₹{ask.original_price_per_pc.toLocaleString('en-IN')}/pc</p>
                    </div>
                    <div>
                      <p className="text-stone-400 font-semibold">Asked Price</p>
                      <p className="text-stone-800 font-bold mt-0.5">
                        ₹{ask.asked_price.toLocaleString('en-IN')}/{ask.asked_unit === 'per_pc' ? 'pc' : 'ct'}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 space-y-1.5 pt-1">
                    <p><span className="text-stone-400 font-semibold">Quantity:</span> {ask.quantity} pcs</p>
                    {ask.reason && (
                      <p className="italic bg-stone-50 p-2 rounded border border-stone-100 text-[11px] text-stone-500">
                        " {ask.reason} "
                      </p>
                    )}
                  </div>

                  {isApproved && ask.approved_price && (
                    <div className="bg-emerald-50 border border-emerald-250/65 rounded-xl p-3 space-y-2 mt-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Approved Rate</span>
                        <span className="text-sm font-extrabold text-emerald-950">
                          ₹{ask.approved_price.toLocaleString('en-IN')}/{ask.approved_unit === 'per_pc' ? 'pc' : 'ct'}
                        </span>
                      </div>
                      {ask.admin_notes && (
                        <p className="text-[10px] text-emerald-700/90 leading-relaxed border-t border-emerald-200/50 pt-1.5">
                          <span className="font-bold">Shewah Team:</span> {ask.admin_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {ask.status === 'rejected' && ask.admin_notes && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mt-2">
                      <span className="font-bold">Rejection Note:</span> {ask.admin_notes}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between mt-auto">
                  {isApproved ? (
                    <>
                      <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getRemainingTime(ask.purchase_window_expiry_at)}</span>
                      </div>
                      <button onClick={() => handlePurchase(ask.id)} disabled={purchasingId === ask.id}
                        className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50">
                        {purchasingId === ask.id ? <Loader2 className="w-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                        Purchase Now
                      </button>
                    </>
                  ) : isPending ? (
                    <div className="flex items-center gap-1.5 text-stone-400 text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Review window: {getRemainingTime(ask.expiry_at)}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400">Created on {new Date(ask.created_at).toLocaleDateString('en-IN')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
