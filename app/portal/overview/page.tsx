'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Package, Clock, ShieldCheck, TrendingUp } from 'lucide-react'
import { usePartner } from '@/app/hooks/usePartner'
import Link from 'next/link'

export default function PartnerOverview() {
  const { partner, loading: partnerLoading } = usePartner()
  const [activeCads, setActiveCads] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (partner) {
        const [{ data: cads }, { data: orders }] = await Promise.all([
          supabase.from('cad_requests')
            .select('*')
            .eq('partner_id', partner.id)
            .in('status', ['pending', 'in_progress', 'revision_requested'])
            .order('created_at', { ascending: false })
            .limit(3),
          supabase.from('orders')
            .select('*')
            .eq('partner_id', partner.id)
            .not('status', 'eq', 'delivered')
            .order('order_date', { ascending: false })
            .limit(3)
        ])
        setActiveCads(cads || [])
        setActiveOrders(orders || [])
      }
      setLoading(false)
    }
    if (!partnerLoading) load()
  }, [partner, partnerLoading])

  if (partnerLoading || loading) {
    return <div className="p-12 text-secondary animate-pulse text-sm">Synchronizing ledger...</div>
  }

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-6xl mx-auto font-sans">
      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Portal Core</span>
        <h1 className="text-4xl lg:text-5xl font-serif text-primary mt-4 tracking-tight leading-none mb-4">
          Welcome back, {partner?.store_name || 'Partner'}.
        </h1>
        <p className="text-secondary font-light">Here is the real-time status of your active productions and architectural requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-surface-highest p-8 border hover:border-primary/30 transition-colors border-outline-variant/20 shadow-ambient flex flex-col justify-between h-48">
          <TrendingUp className="w-6 h-6 text-primary mb-4" />
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-1">Production Queue</h3>
            <p className="text-4xl font-serif">{activeOrders.length}</p>
          </div>
        </div>
        <div className="bg-surface-lowest p-8 border hover:border-primary/30 transition-colors border-outline-variant/20 shadow-ambient flex flex-col justify-between h-48">
          <Clock className="w-6 h-6 text-primary mb-4" />
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-1">Pending CADs</h3>
            <p className="text-4xl font-serif">{activeCads.length}</p>
          </div>
        </div>
        <div className="bg-[#f2e8d5]/40 p-8 border hover:border-[#c49c64]/30 transition-colors border-[#c49c64]/20 shadow-ambient flex flex-col justify-between h-48">
          <ShieldCheck className="w-6 h-6 text-[#9B7A40] mb-4" />
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#9B7A40] mb-1">System Status</h3>
            <p className="text-lg font-serif text-[#C49C64] mt-2 leading-none">Optimal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Active Productions */}
        <div>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/30">
            <h2 className="text-xl font-serif">Active Productions</h2>
            <Link href="/portal/orders" className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary hover:text-secondary">View Pipeline</Link>
          </div>
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <p className="text-sm text-secondary font-light">No items in active production.</p>
            ) : (
              activeOrders.map(order => (
                <Link href={`/portal/orders/${order.id}`} key={order.id} className="block group">
                  <div className="bg-surface-highest p-5 border border-outline-variant/10 group-hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-primary">{order.order_number}</span>
                      <span className="text-[9px] uppercase tracking-widest bg-primary text-surface-lowest px-2 py-1">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-secondary truncate">{order.product_name || 'Bespoke Creation'}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* CAD Requests */}
        <div>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/30">
            <h2 className="text-xl font-serif">Bespoke Architectural Drafts</h2>
            <Link href="/portal/bespoke" className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary hover:text-secondary">Initiate Draft</Link>
          </div>
          <div className="space-y-4">
            {activeCads.length === 0 ? (
              <p className="text-sm text-secondary font-light">No drafts in queue.</p>
            ) : (
              activeCads.map(cad => (
                <div key={cad.id} className="bg-surface-lowest p-5 border border-outline-variant/20">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-primary">{cad.request_number}</span>
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-1 ${cad.status === 'pending' ? 'bg-surface-low text-secondary' : 'bg-[#e2e2e5] text-primary'}`}>
                      {cad.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-secondary max-w-full truncate">{cad.brief_text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
