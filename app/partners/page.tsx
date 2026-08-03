'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Partner } from '@/lib/supabase'
import { formatDate, getStatusColor, CIRCUITS } from '@/lib/utils'
import {
  Plus, Search, Filter, Phone, MapPin,
  ChevronRight, TrendingUp, Users, Inbox
} from 'lucide-react'
import Link from 'next/link'

const STATUS_FILTERS = ['all', 'hot', 'warm', 'cold']
const STAGE_FILTERS = ['all', 'prospect', 'contacted', 'sample_sent', 'active', 'inactive']
const CIRCUIT_FILTERS = ['all', ...CIRCUITS.map(c => c.value)]

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
      setPartners(pData.filter((p: any) => p.stage !== 'pending_approval'))
      setPendingApprovals(pData.filter((p: any) => p.stage === 'pending_approval'))
    }
    
    setCatalogRequests(reqData || [])
    setLoading(false)
  }

  async function approvePartner(id: string) {
    if (!confirm('This will create an authentication account and send an email invite. Proceed?')) return
    
    // Call our automated API
    const res = await fetch('/api/partners/approve', {
      method: 'POST',
      body: JSON.stringify({ partner_id: id })
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Automation failed')
      return
    }

    alert('Partner verified and authentication invite dispatched.')
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
    <div className="p-4 lg:p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Partners</h1>
          <p className="text-stone-500 text-sm mt-0.5">Jeweler CRM — {partners.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/partners/leads"
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors">
            <Inbox className="w-4 h-4" />
            <span className="hidden sm:inline">Lead inbox</span>
            <span className="sm:hidden">Leads</span>
          </Link>
          <Link href="/partners/new"
            className="flex items-center gap-2 bg-stone-800 text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add partner</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
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
            className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
            {CIRCUIT_FILTERS.map(s => {
              const label = s === 'all' ? 'All circuits' : (CIRCUITS.find(c => c.value === s)?.label || s)
              return <option key={s} value={s}>{label}</option>
            })}
          </select>
        </div>
      </div>

      {/* Mobile card list / Desktop table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Desktop table — hidden on mobile */}
        <table className="w-full hidden lg:table">
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
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                {partners.length === 0 ? 'No partners yet — add your first one' : (
                  <span>
                    No partners match your filters.{' '}
                    <button
                      onClick={() => { setSearch(''); setStatusFilter('all'); setStageFilter('all'); setCircuitFilter('all') }}
                      className="text-stone-800 hover:underline"
                    >Clear filters</button>
                  </span>
                )}
              </td></tr>
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

        {/* Mobile card list — hidden on desktop */}
        <div className="lg:hidden divide-y divide-stone-50">
          {loading ? (
            <div className="text-center py-8 text-stone-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              {partners.length === 0 ? 'No partners yet — add your first one' : (
                <span>
                  No partners match your filters.{' '}
                  <button
                    onClick={() => { setSearch(''); setStatusFilter('all'); setStageFilter('all'); setCircuitFilter('all') }}
                    className="text-stone-800 hover:underline"
                  >Clear filters</button>
                </span>
              )}
            </div>
          ) : (
            filtered.map(p => (
              <a key={p.id} href={`/partners/${p.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-stone-900">{p.store_name}</p>
                    <span className={`status-pill text-xs ${getStatusColor(p.status)}`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-stone-500">{p.owner_name}{p.phone ? ` · ${p.phone}` : ''}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-400 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>
                    {p.circuit && <span>{p.circuit} circuit</span>}
                    <span className={`status-pill ${getStatusColor(p.stage)}`}>{p.stage.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
