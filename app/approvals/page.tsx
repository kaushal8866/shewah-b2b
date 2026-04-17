'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, partners(store_name, city, credit_limit_paise)')
      .eq('gov_status', 'pending_approval')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function decide(id: string, status: 'approved' | 'denied') {
    const { error } = await supabase
      .from('orders')
      .update({ 
        gov_status: status,
        gov_approved_at: status === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', id)
    
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(`Order ${status === 'approved' ? 'Approved' : 'Denied'}`, 'success')
    load()
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#C49C64]" />
          Governance Approvals
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">Orders requiring manual review by Owner</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading queue...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-stone-900 font-medium">All clear!</h3>
          <p className="text-stone-500 text-sm mt-1">No orders currently pending approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(o => {
            const overLimit = o.total_amount > (o.partners?.credit_limit_paise || 500000)
            const highDiscount = (o.discount_pct || 0) > 0.03

            return (
              <div key={o.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-stone-400">#{o.order_number}</span>
                      <h3 className="font-semibold text-stone-900">{o.partners?.store_name}</h3>
                      <span className="text-xs text-stone-400">· {o.partners?.city}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="text-sm font-medium text-stone-700">{formatCurrency(o.total_amount)}</p>
                      {o.discount_pct > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${highDiscount ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {Math.round(o.discount_pct * 1000) / 10}% Discount
                        </span>
                      )}
                      {overLimit && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Over Credit Limit
                        </span>
                      )}
                    </div>
                    {o.gov_notes && (
                      <p className="text-xs text-stone-400 mt-2 italic">Reason: {o.gov_notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-stone-50">
                    <Link href={`/orders/${o.id}`} className="p-2 text-stone-400 hover:text-stone-600">
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                    <button onClick={() => decide(o.id, 'denied')}
                      className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                      <XCircle className="w-4 h-4" /> Deny
                    </button>
                    <button onClick={() => decide(o.id, 'approved')}
                      className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
