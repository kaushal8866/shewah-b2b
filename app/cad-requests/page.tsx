'use client'

import { useEffect, useState } from 'react'
import { supabase, CADRequest } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Search, Clock, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type CADRow = CADRequest & { partner_name?: string; partner_city?: string }

export default function CADRequestsPage() {
  const [requests, setRequests] = useState<CADRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    loadRequests()
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('cad_requests')
      .select(`*, partners(store_name, city)`)
      .order('received_date', { ascending: false })
    setRequests(
      (data || []).map((r: any) => ({
        ...r,
        partner_name: r.partners?.store_name,
        partner_city: r.partners?.city,
      }))
    )
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    const updates: Record<string, any> = { status }
    if (status === 'sent') updates.sent_date = new Date().toISOString().split('T')[0]
    if (status === 'approved') updates.approved_date = new Date().toISOString().split('T')[0]
    await supabase.from('cad_requests').update(updates).eq('id', id)
    loadRequests()
  }

  function getHoursLeft(receivedDate: string, dueDate?: string) {
    const base = dueDate
      ? new Date(dueDate).getTime()
      : new Date(receivedDate).getTime() + 48 * 3600 * 1000
    const diff = (base - now) / 3600000
    return diff
  }

  function HoursChip({ received, due, status }: { received: string; due?: string; status: string }) {
    if (['approved', 'rejected', 'sent'].includes(status)) return null
    const h = getHoursLeft(received, due)
    if (h < 0) return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
        <AlertCircle className="w-3 h-3" /> OVERDUE
      </span>
    )
    if (h < 8) return (
      <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
        <Clock className="w-3 h-3" /> {Math.round(h)}h left
      </span>
    )
    if (h < 24) return (
      <span className="flex items-center gap-1 text-xs text-yellow-600">
        <Clock className="w-3 h-3" /> {Math.round(h)}h left
      </span>
    )
    return (
      <span className="flex items-center gap-1 text-xs text-stone-400">
        <Clock className="w-3 h-3" /> {Math.round(h)}h left
      </span>
    )
  }

  const STATUSES = ['all', 'pending', 'in_progress', 'sent', 'revision_requested', 'approved', 'rejected']

  const filtered = requests.filter(r => {
    const matchSearch = !search ||
      r.request_number.toLowerCase().includes(search.toLowerCase()) ||
      r.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.brief_text?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const urgentCount = requests.filter(r =>
    !['approved', 'rejected', 'sent'].includes(r.status) &&
    getHoursLeft(r.received_date, r.due_date) < 24
  ).length

  const statsBar = [
    { label: 'Pending', count: requests.filter(r => r.status === 'pending').length, color: 'text-blue-600' },
    { label: 'In progress', count: requests.filter(r => r.status === 'in_progress').length, color: 'text-yellow-600' },
    { label: 'Sent to partner', count: requests.filter(r => r.status === 'sent').length, color: 'text-purple-600' },
    { label: 'Revision needed', count: requests.filter(r => r.status === 'revision_requested').length, color: 'text-orange-600' },
    { label: 'Approved', count: requests.filter(r => r.status === 'approved').length, color: 'text-green-600' },
  ]

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">CAD Requests</h1>
          <p className="text-stone-500 text-sm mt-0.5">Custom design tracker — 48h SLA</p>
        </div>
        <Link href="/cad-requests/new"
          className="flex items-center gap-2 bg-[#C49C64] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
          <Plus className="w-4 h-4" />
          New request
        </Link>
      </div>

      {/* Urgent alert */}
      {urgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">{urgentCount} request{urgentCount > 1 ? 's' : ''} due within 24 hours</p>
            <p className="text-xs text-red-600">Review and send to partners before the 48h window closes</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {statsBar.map(s => (
          <button key={s.label}
            onClick={() => setStatusFilter(s.label.toLowerCase().replace(' ', '_') === statusFilter ? 'all' : s.label.toLowerCase().replace(' ', '_'))}
            className="bg-white rounded-xl border border-stone-200 px-3 py-3 text-center hover:border-stone-300 transition-colors">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search request number, partner, brief..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white">
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left text-xs text-stone-400 font-medium px-5 py-3">Request</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Partner</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Brief</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Status</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Timer</th>
              <th className="text-left text-xs text-stone-400 font-medium px-4 py-3">Actions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                {requests.length === 0 ? 'No CAD requests yet' : 'No requests match filters'}
              </td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-stone-900">{r.request_number}</p>
                    <p className="text-xs text-stone-400">{formatDate(r.received_date)}</p>
                    {r.priority === 'urgent' && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">urgent</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-stone-700">{r.partner_name || '—'}</p>
                    <p className="text-xs text-stone-400">{r.partner_city}</p>
                  </td>
                  <td className="px-4 py-3.5 max-w-48">
                    <p className="text-xs text-stone-600 line-clamp-2">{r.brief_text || '—'}</p>
                    {r.diamond_shape && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        {r.diamond_weight} · {r.diamond_shape} · {r.gold_karat}K
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`status-pill ${getStatusColor(r.status)}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <HoursChip received={r.received_date} due={r.due_date} status={r.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    {r.status === 'pending' && (
                      <button onClick={() => updateStatus(r.id, 'in_progress')}
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-200 transition-colors">
                        Start work
                      </button>
                    )}
                    {r.status === 'in_progress' && (
                      <button onClick={() => updateStatus(r.id, 'sent')}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-200 transition-colors">
                        Mark sent
                      </button>
                    )}
                    {r.status === 'sent' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(r.id, 'approved')}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors">
                          Approved
                        </button>
                        <button onClick={() => updateStatus(r.id, 'revision_requested')}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-200 transition-colors">
                          Revision
                        </button>
                      </div>
                    )}
                    {r.status === 'revision_requested' && (
                      <button onClick={() => updateStatus(r.id, 'in_progress')}
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-200 transition-colors">
                        Rework
                      </button>
                    )}
                    {r.status === 'approved' && (
                      <div className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/cad-requests/${r.id}`}>
                      <ChevronRight className="w-4 h-4 text-stone-300" />
                    </Link>
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
