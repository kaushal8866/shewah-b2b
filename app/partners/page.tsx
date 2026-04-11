'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Partner } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import {
  Plus, Search, Phone, MapPin,
  ChevronRight, TrendingUp, Users
} from 'lucide-react'
import Link from 'next/link'

const STATUS_FILTERS = ['all', 'hot', 'warm', 'cold']
const STAGE_FILTERS = ['all', 'prospect', 'contacted', 'sample_sent', 'active', 'inactive']
const CIRCUIT_FILTERS = ['all', 'Gujarat', 'Maharashtra', 'MP', 'Rajasthan']

export default function PartnersPage() {
  const router = useRouter()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [circuitFilter, setCircuitFilter] = useState('all')

  useEffect(() => {
    loadPartners()
  }, [])

  async function loadPartners() {
    setLoading(true)
    const { data } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })
    setPartners(data || [])
    setLoading(false)
  }

  const filtered = partners.filter(p => {
    const matchSearch = !search ||
      p.store_name.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchStage = stageFilter === 'all' || p.stage === stageFilter
    const matchCircuit = circuitFilter === 'all' || p.circuit === circuitFilter
    return matchSearch && matchStatus && matchStage && matchCircuit
  })

  const stats = {
    total: partners.length,
    hot: partners.filter(p => p.status === 'hot').length,
    active: partners.filter(p => p.stage === 'active').length,
    sample: partners.filter(p => p.stage === 'sample_sent').length,
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Partners</h1>
          <p className="text-stone-500 text-sm mt-0.5">Jeweler CRM — {partners.length} contacts</p>
        </div>
        <Link href="/partners/new"
          className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
          <Plus className="w-4 h-4" />
          Add partner
        </Link>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-stone-600' },
          { label: 'Hot leads', value: stats.hot, icon: TrendingUp, color: 'text-red-500' },
          { label: 'Sample sent', value: stats.sample, icon: TrendingUp, color: 'text-yellow-600' },
          { label: 'Active partners', value: stats.active, icon: Users, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-400">{s.label}</p>
            <p className={`text-2xl font-semibold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, city, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            {STAGE_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All stages' : s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={circuitFilter} onChange={e => setCircuitFilter(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            {CIRCUIT_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All circuits' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left text-xs text-stone-400 font-medium px-5 py-3">Store</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden sm:table-cell">Contact</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden sm:table-cell">Location</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Status</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden lg:table-cell">Stage</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3 hidden lg:table-cell">Model</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                {partners.length === 0
                  ? 'No partners yet — add your first one'
                  : 'No partners match your filters'}
              </td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/partners/${p.id}`)}>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-stone-900">{p.store_name}</p>
                    <p className="text-xs text-stone-400">{p.owner_name}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Phone className="w-3 h-3" />
                      {p.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      {p.city}, {p.state}
                    </div>
                    {p.circuit && <p className="text-xs text-stone-400 mt-0.5">{p.circuit} circuit</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`status-pill ${getStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className={`status-pill ${getStatusColor(p.stage)}`}>
                      {p.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-xs text-stone-500 capitalize">
                      {p.model_preference?.replace(/_/g, ' ') || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <ChevronRight className="w-4 h-4 text-stone-300" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
