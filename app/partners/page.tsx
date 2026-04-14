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
  const [pendingApprovals, setPendingApprovals] = useState<Partner[]>([])
  const [catalogRequests, setCatalogRequests] = useState<any[]>([])

  useEffect(() => {
    loadPartners()
  }, [])

  async function loadPartners() {
    setLoading(true)
    const [{ data: pData }, { data: reqData }] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      supabase.from('catalog_access_requests').select('*, partners(store_name)').eq('status', 'pending')
    ])
    
    if (pData) {
      setPartners(pData.filter(p => p.stage !== 'pending_approval'))
      setPendingApprovals(pData.filter(p => p.stage === 'pending_approval'))
    }
    
    setCatalogRequests(reqData || [])
    setLoading(false)
  }

  async function approvePartner(id: string) {
    await supabase.from('partners').update({ stage: 'active', status: 'hot' }).eq('id', id)
    loadPartners()
  }

  async function approveCatalogAccess(id: string) {
    const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString()
    await supabase.from('catalog_access_requests').update({ status: 'approved', granted_at: new Date().toISOString(), expires_at: expiresAt }).eq('id', id)
    loadPartners()
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
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32">
      {/* Header */}
      <div className="flex items-end justify-between mb-12">
        <div>
          <h1 className="display-sm">Partners</h1>
          <p className="text-secondary tracking-wide mt-2">Jeweler CRM — {partners.length} contacts</p>
        </div>
        <Link href="/partners/new"
          className="flex items-center gap-2 bg-primary text-surface-lowest px-5 py-3 rounded-md text-sm font-medium hover:bg-surface-highest hover:text-primary transition-colors">
          <Plus className="w-5 h-5" />
          Add partner
        </Link>
      </div>

      {/* Admin Action Banners */}
      {(pendingApprovals.length > 0 || catalogRequests.length > 0) && (
        <div className="mb-8 space-y-4">
          {pendingApprovals.map(p => (
            <div key={p.id} className="bg-amber-50 border border-amber-200 p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-amber-800 font-medium text-sm">New Partner Registration: {p.store_name} ({p.owner_name})</p>
                <p className="text-amber-700 text-xs mt-0.5">{p.phone} · {p.email}</p>
              </div>
              <button onClick={() => approvePartner(p.id)} className="bg-amber-100 text-amber-900 border border-amber-300 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-amber-200 transition-colors">
                Approve Access
              </button>
            </div>
          ))}

          {catalogRequests.map(req => (
            <div key={req.id} className="bg-blue-50 border border-blue-200 p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-blue-800 font-medium text-sm">24-Hour Catalog Access Request</p>
                <p className="text-blue-700 text-xs mt-0.5">Requested by: {req.partners?.store_name}</p>
              </div>
              <button onClick={() => approveCatalogAccess(req.id)} className="bg-blue-100 text-blue-900 border border-blue-300 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-blue-200 transition-colors">
                Grant 24HR Access
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
        {[
          { label: 'Total', value: stats.total, icon: Users },
          { label: 'Hot leads', value: stats.hot, icon: TrendingUp },
          { label: 'Sample sent', value: stats.sample, icon: TrendingUp },
          { label: 'Active partners', value: stats.active, icon: Users },
        ].map(s => (
          <div key={s.label} className="bg-surface-low hover:bg-surface-highest transition-colors px-6 py-5 flex flex-col justify-center">
            <p className="label-md">{s.label}</p>
            <p className="display-sm mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface-low p-6 mb-8">
        <p className="label-md mb-4">Pipeline Filters</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-secondary" />
            <input
              type="text"
              placeholder="Search by name, city, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm bg-surface-lowest ghost-border"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            {STAGE_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All stages' : s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={circuitFilter} onChange={e => setCircuitFilter(e.target.value)}
            className="flex-1 sm:flex-none text-sm px-4 py-3 bg-surface-lowest ghost-border">
            {CIRCUIT_FILTERS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All circuits' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-lowest ghost-border overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b ghost-border bg-surface-low text-secondary text-left">
              <th className="label-md px-6 py-4">Store</th>
              <th className="label-md px-4 py-4 hidden sm:table-cell">Contact</th>
              <th className="label-md px-4 py-4 hidden sm:table-cell">Location</th>
              <th className="label-md px-4 py-4">Status</th>
              <th className="label-md px-4 py-4 hidden lg:table-cell">Stage</th>
              <th className="label-md px-4 py-4 hidden lg:table-cell">Model</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-secondary text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <Users className="w-10 h-10 text-outline-variant mx-auto mb-4" />
                  <p className="text-secondary text-sm">
                    {partners.length === 0 ? 'No partners yet — add your first one' : 'No partners match your filters'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-low transition-colors cursor-pointer"
                  onClick={() => router.push(`/partners/${p.id}`)}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-primary">{p.store_name}</p>
                    <p className="text-xs text-secondary">{p.owner_name}</p>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-secondary">
                      <Phone className="w-3 h-3" />
                      {p.phone}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-xs text-secondary">
                      <MapPin className="w-3 h-3 text-secondary" />
                      {p.city}, {p.state}
                    </div>
                    {p.circuit && <p className="text-xs text-outline-variant mt-0.5">{p.circuit} circuit</p>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`status-pill ${getStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className={`status-pill ${getStatusColor(p.stage)}`}>
                      {p.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-xs text-secondary capitalize">
                      {p.model_preference?.replace(/_/g, ' ') || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-secondary ml-auto" />
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
