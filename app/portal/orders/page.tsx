'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Eye, Clock } from 'lucide-react'
import Link from 'next/link'

const PIPELINE_INDEX = {
  brief_received: 1, cad_in_progress: 1, cad_sent: 1, design_approved: 2,
  production: 3, qc: 4, dispatched: 5, delivered: 6
}

type Order = {
  id: string, order_number: string, product_name: string | null,
  status: string, order_date: string, balance_due: number, expected_delivery: string | null
}

export default function PartnerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('partners').select('id').single()
      if (p) {
        const { data } = await supabase.from('order_pipeline')
          .select('*')
          .eq('partner_id', p.id)
          .order('order_date', { ascending: false })
        setOrders(data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="p-12 text-secondary animate-pulse text-sm">Loading architectural timelines...</div>
  }

  const activeOrders = orders.filter(o => o.status !== 'delivered')
  const historicOrders = orders.filter(o => o.status === 'delivered')

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-6xl mx-auto font-sans">
      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Logistics Engine</span>
        <h1 className="text-4xl lg:text-6xl font-serif text-primary mt-4 tracking-tight leading-none mb-6">
          Architectural Timelines
        </h1>
        <p className="text-secondary font-light max-w-xl text-lg leading-relaxed">
          Monitor your active production runs. We prioritize precision tracking so your supply chain remains transparent.
        </p>
      </div>

      <div className="space-y-16">
        {/* Active Productions */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary border-b border-primary pb-2 mb-8">Active Executions</h2>
          
          <div className="space-y-6">
            {activeOrders.length === 0 ? (
              <div className="bg-surface-highest p-12 text-center border-dashed border border-outline-variant/30">
                <Package className="w-8 h-8 text-outline-variant mx-auto mb-4" />
                <p className="text-secondary tracking-widest text-xs uppercase">No active executions.</p>
              </div>
            ) : (
              activeOrders.map(order => {
                const currentStage = PIPELINE_INDEX[order.status as keyof typeof PIPELINE_INDEX] || 1;
                
                return (
                  <div key={order.id} className="bg-surface-lowest p-8 border border-outline-variant/20 shadow-ambient group hover:border-primary/40 transition-colors">
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-8">
                      <div>
                        <h3 className="text-2xl font-serif text-primary">{order.order_number}</h3>
                        <p className="text-sm text-secondary tracking-wide mt-1">{order.product_name || 'Bespoke Private Label'}</p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-1">Expected Delivery</p>
                        <p className="text-lg font-medium text-primary">
                          {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : 'Pending CAD Approval'}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Tracker */}
                    <div className="relative pt-4 bg-surface-low p-6 border border-outline-variant/10">
                      <div className="absolute top-[42px] left-8 right-8 h-px bg-outline-variant/30 md:block hidden"></div>
                      <div className="absolute top-[42px] left-8 h-px bg-primary md:block hidden transition-all duration-1000" style={{ width: `${(currentStage - 1) * 25}%` }}></div>
                      
                      <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-0 relative z-10">
                        {[
                          { step: 1, label: 'Design' },
                          { step: 2, label: 'Approved' },
                          { step: 3, label: 'Production' },
                          { step: 4, label: 'QC' },
                          { step: 5, label: 'Dispatched' }
                        ].map((stage) => (
                          <div key={stage.step} className="flex md:flex-col items-center gap-4 md:gap-3 flex-1 text-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] uppercase font-bold shrink-0 transition-colors duration-500 shadow-sm
                              ${currentStage > stage.step ? 'bg-primary text-surface-lowest border-primary' : 
                                currentStage === stage.step ? 'bg-[#c49c64] text-surface-lowest shadow-[#c49c64]/30' : 
                                'bg-surface-lowest border border-outline-variant/40 text-outline-variant'}`}>
                              {stage.step}
                            </div>
                            <span className={`text-xs uppercase tracking-widest font-bold ${currentStage >= stage.step ? 'text-primary' : 'text-secondary'}`}>
                              {stage.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Historic Orders */}
        {historicOrders.length > 0 && (
          <section>
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary border-b border-outline-variant/20 pb-2 mb-8 mt-24">Archive / Delivered</h2>
            <div className="bg-surface-low border border-outline-variant/20 divide-y divide-outline-variant/10">
              {historicOrders.map(order => (
                <div key={order.id} className="flex flex-col md:flex-row items-center justify-between p-6 hover:bg-surface-highest transition-colors">
                  <div className="flex-1">
                    <p className="font-semibold text-primary">{order.order_number}</p>
                    <p className="text-xs text-secondary mt-1">{order.product_name || 'Bespoke Structure'}</p>
                  </div>
                  <div className="flex items-center gap-6 mt-4 md:mt-0">
                    <span className="text-[10px] uppercase tracking-widest bg-outline-variant/20 text-secondary px-3 py-1 font-bold">Delivered</span>
                    <p className="text-secondary text-sm font-medium">{new Date(order.order_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
