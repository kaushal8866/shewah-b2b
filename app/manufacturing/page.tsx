'use client'

import { useEffect, useState } from 'react'
import { supabase, type ManufacturingPartner, type ManufacturingOrder, type MaterialFloat } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Factory, ChevronRight, Phone, Layers, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type MfgPartner = {
  id: string
  name: string
  owner_name: string
  phone: string
  city: string
  speciality: string[]
  material_policy: string
  labour_rate_18k: number
  status: string
}

type FloatSummary = {
  partner_id: string
  material_type: string
  balance: number
  total_deposited: number
}

export default function ManufacturingPage() {
  const [partners, setPartners] = useState<MfgPartner[]>([])
  const [floats, setFloats] = useState<FloatSummary[]>([])
  const [orders, setOrders] = useState<(ManufacturingOrder & { manufacturing_partners?: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: f }, { data: o }] = await Promise.all([
      supabase.from('manufacturing_partners').select('*').order('name'),
      supabase.from('material_float').select('*'),
      supabase.from('manufacturing_orders').select('*, manufacturing_partners(name)').order('created_at', { ascending: false }).limit(10),
    ])
    setPartners(p || [])
    setFloats(f || [])
    setOrders(o || [])
    setLoading(false)
  }

  function getPartnerFloats(partnerId: string) {
    return floats.filter(f => f.partner_id === partnerId)
  }

  const activeOrders = orders.filter(o => !['delivered'].includes(o.status))

  const MFG_STATUS_COLORS: Record<string, string> = {
    issued: 'bg-blue-100 text-blue-700',
    material_sent: 'bg-yellow-100 text-yellow-700',
    in_production: 'bg-orange-100 text-orange-700',
    qc: 'bg-purple-100 text-purple-700',
    ready: 'bg-teal-100 text-teal-700',
    delivered: 'bg-green-100 text-green-700',
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Manufacturing</h1>
          <p className="text-stone-500 text-sm mt-0.5">Partner orders + material tracking</p>
        </div>
        <div className="flex gap-2">
          <Link href="/manufacturing/orders/new"
            className="flex items-center gap-2 bg-[#C49C64] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Issue order</span>
            <span className="sm:hidden">Order</span>
          </Link>
          <Link href="/manufacturing/partners/new"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-700 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add partner</span>
            <span className="sm:hidden">Partner</span>
          </Link>
        </div>
      </div>

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 mb-5 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-medium text-stone-900 text-sm">Active manufacturing orders</h2>
            <Link href="/manufacturing/orders" className="text-xs text-[#C49C64] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-stone-50">
            {activeOrders.slice(0, 5).map(o => (
              <Link key={o.id} href={`/manufacturing/orders/${o.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{o.order_number}</p>
                  <p className="text-xs text-stone-400">{o.manufacturing_partners?.name} · {o.description?.substring(0, 40)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${MFG_STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                  {o.status?.replace(/_/g, ' ')}
                </span>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Partners + material float */}
      <div>
        <h2 className="font-medium text-stone-900 mb-3">Manufacturing partners</h2>
        {loading ? (
          <div className="text-center py-12 text-stone-400">Loading...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
            <Factory className="w-10 h-10 text-stone-200 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">No manufacturing partners yet</p>
            <Link href="/manufacturing/partners/new" className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">
              Add your first partner →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map(p => {
              const pFloats = getPartnerFloats(p.id)
              const lowBalance = pFloats.some(f => f.balance < 1)
              return (
                <div key={p.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-stone-900">{p.name}</p>
                        {lowBalance && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="w-3 h-3" /> Low material
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{p.owner_name} · {p.city}</p>
                      {p.speciality && p.speciality.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.speciality.map(s => (
                            <span key={s} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                      <Link href={`/manufacturing/partners/${p.id}`} className="text-stone-300 hover:text-stone-600">
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>

                  {/* Material float cards */}
                  {pFloats.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-stone-100">
                      {pFloats.map(f => {
                        const isGold = f.material_type?.startsWith('gold')
                        const displayValue = isGold ? (f.balance / 1000).toFixed(3) : (f.balance / 100).toFixed(2)
                        const unit = isGold ? 'g' : 'ct'
                        return (
                          <div key={f.material_type} className={`rounded-lg p-2.5 ${f.balance < 1 ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'}`}>
                            <p className="text-xs text-stone-400 capitalize">{f.material_type.replace(/_/g, ' ')}</p>
                            <p className={`text-base font-semibold mt-0.5 ${f.balance < 1 ? 'text-amber-700' : 'text-stone-800'}`}>
                              {displayValue}{unit}
                            </p>
                            <p className="text-xs text-stone-400">Total: {isGold ? (f.total_deposited/1000).toFixed(1) : (f.total_deposited/100).toFixed(1)}{unit}</p>
                          </div>
                        )
                      })}
                      <Link href={`/manufacturing/partners/${p.id}/float`}
                        className="rounded-lg border border-dashed border-stone-200 p-2.5 flex items-center justify-center text-xs text-stone-400 hover:border-[#C49C64] hover:text-[#C49C64] transition-colors">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Deposit / Withdraw
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <p className="text-xs text-stone-400">No material float yet</p>
                      <Link href={`/manufacturing/partners/${p.id}/float`}
                        className="text-xs text-[#C49C64] hover:underline">
                        Set up material float →
                      </Link>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                    <Link href={`/manufacturing/orders/new?partner=${p.id}`}
                      className="flex-1 text-center text-xs bg-[#C49C64] text-white py-2 rounded-lg hover:bg-[#9B7A40] transition-colors">
                      Issue order
                    </Link>
                    <a href={`tel:${p.phone}`}
                      className="flex items-center gap-1 text-xs border border-stone-200 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50">
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                    <a href={`https://wa.me/${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-100">
                      WhatsApp
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
