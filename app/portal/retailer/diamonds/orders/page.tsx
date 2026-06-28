'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/app/components/Toast'
import { ClipboardList, AlertCircle, Loader2, Calendar, Truck } from 'lucide-react'

type Order = {
  id: string
  order_number: string
  status: string
  type: string
  model: string
  quantity: number
  special_notes: string | null
  brief_text: string | null
  trade_price: number
  total_amount: number
  advance_paid: number
  balance_due: number
  order_date: string
  expected_delivery: string
  dispatch_date: string | null
  actual_delivery: string | null
  courier: string | null
  tracking_number: string | null
}

export default function RetailerDiamondOrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/portal/retailer/diamonds/orders')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load diamond orders')
      setOrders(data.orders || [])
    } catch (e: any) {
      toast({ title: 'Error', message: e.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const getStatusBadge = (status: string) => {
    const base = "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider "
    switch (status) {
      case 'brief_received':
      case 'brief_pending':
        return base + "bg-blue-50 text-blue-700 border border-blue-200"
      case 'design_approved':
      case 'in_production':
        return base + "bg-amber-50 text-amber-700 border border-amber-200"
      case 'qc_passed':
        return base + "bg-emerald-50 text-emerald-700 border border-emerald-250"
      case 'dispatched':
        return base + "bg-indigo-50 text-indigo-700 border border-indigo-200"
      case 'delivered':
        return base + "bg-stone-100 text-stone-700 border border-stone-200"
      case 'cancelled':
      default:
        return base + "bg-stone-50 text-stone-400 border border-stone-150"
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-stone-400" />
        <p className="text-xs text-stone-500 mt-2 font-medium">Loading diamond orders...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-2.5 max-w-md mx-auto mt-6">
          <ClipboardList className="w-8 h-8 mx-auto text-stone-350" />
          <p className="font-bold text-stone-700 text-sm">No diamond orders found</p>
          <p className="text-xs text-stone-450 leading-relaxed">
            You haven't purchased any loose diamonds yet. Go to Browse to procure or place asks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <div key={o.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-sm">{o.order_number}</span>
                  <span className={getStatusBadge(o.status)}>{o.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-stone-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Ordered on {new Date(o.order_date).toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <p className="text-xs text-stone-400 font-semibold">Specifications</p>
                  <p className="font-bold text-stone-800 text-sm">{o.special_notes?.replace('Loose Diamond Procurement: ', '')}</p>
                  <p className="text-xs text-stone-500 leading-relaxed">{o.brief_text}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-150 flex flex-col justify-center space-y-2">
                  <div className="flex justify-between items-baseline text-xs text-stone-500">
                    <span>Quantity</span>
                    <span className="font-bold text-stone-850">{o.quantity} Pcs</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-stone-500 pt-1.5 border-t border-stone-200/50">
                    <span>Approved Price</span>
                    <span className="font-bold text-stone-850">₹{o.trade_price.toLocaleString('en-IN')}/pc</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-stone-500 pt-1.5 border-t border-stone-200/50">
                    <span>Total Amount</span>
                    <span className="font-extrabold text-stone-950 text-sm">₹{o.total_amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {o.dispatch_date && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-850 font-semibold">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    <span>Dispatched on {new Date(o.dispatch_date).toLocaleDateString('en-IN')}</span>
                  </div>
                  {o.tracking_number && (
                    <div className="text-stone-600">
                      <span className="font-medium text-stone-400">Carrier:</span> <span className="font-bold text-stone-800">{o.courier}</span> · <span className="font-medium text-stone-400">Tracking:</span> <span className="font-bold text-stone-800 select-all">{o.tracking_number}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
