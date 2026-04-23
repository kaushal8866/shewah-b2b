'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ENQUIRY_BOARD_COLUMNS, ENQUIRY_STATUSES, ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_STYLE,
  formatINR, displayPhone,
  type CustomerEnquiry, type Customer,
} from '@/lib/customers'
import { Loader2, Plus, Inbox, LayoutGrid, List, Filter, ArrowUpRight } from 'lucide-react'

type EnquiryRow = CustomerEnquiry & { customer?: Pick<Customer, 'id' | 'full_name' | 'whatsapp' | 'city'> }

export default function EnquiriesPage() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [rows, setRows] = useState<EnquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | EnquiryRow['status']>('all')

  async function load() {
    setLoading(true); setError(null)
    const { data, error } = await supabase
      .from('customer_enquiries')
      .select('*, customer:customers(id, full_name, whatsapp, city)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setError(error.message)
    setRows((data as any) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => filter === 'all' ? rows : rows.filter(r => r.status === filter), [rows, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const s of ENQUIRY_STATUSES) c[s] = rows.filter(r => r.status === s).length
    return c
  }, [rows])

  const byColumn = useMemo(() => {
    const map: Record<string, EnquiryRow[]> = {}
    for (const s of ENQUIRY_BOARD_COLUMNS) map[s] = []
    for (const r of filtered) if (map[r.status]) map[r.status].push(r)
    return map
  }, [filtered])

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">D2C</p>
          <h1 className="text-2xl font-serif mt-0.5">Enquiry inbox</h1>
        </div>
        <Link href="/enquiries/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#172d49]">
          <Plus className="w-4 h-4" /> Log enquiry
        </Link>
      </div>
      <p className="text-sm text-stone-600 mb-5">Walk-in, phone and DM enquiries logged by the team. Triage them through to a quote.</p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setView('board')}
          className={`text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${view === 'board' ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-stone-700 border-stone-200'}`}>
          <LayoutGrid className="w-3.5 h-3.5" /> Board
        </button>
        <button onClick={() => setView('list')}
          className={`text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${view === 'list' ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-stone-700 border-stone-200'}`}>
          <List className="w-3.5 h-3.5" /> List
        </button>

        <div className="w-px h-5 bg-stone-200 mx-2" />
        <Filter className="w-4 h-4 text-stone-400" />
        {(['all', ...ENQUIRY_STATUSES] as const).map(k => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === k ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>
            {k === 'all' ? 'All' : ENQUIRY_STATUS_LABEL[k]}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[k] || 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error.includes('relation') && error.includes('does not exist')
            ? 'The customer_enquiries table is not yet provisioned. Run scripts/migrate_d2c_customers.sql in the Supabase SQL Editor and refresh.'
            : error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-stone-500 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading enquiries…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <Inbox className="w-8 h-8 mx-auto text-stone-300" />
          <p className="mt-3 text-sm">No enquiries {filter !== 'all' ? `with status "${ENQUIRY_STATUS_LABEL[filter]}"` : 'yet'}.</p>
          <Link href="/enquiries/new" className="inline-flex items-center gap-1 mt-4 text-sm text-[#1E3A5F] font-medium hover:text-[#172d49]">
            <Plus className="w-4 h-4" /> Log the first one
          </Link>
        </div>
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ENQUIRY_BOARD_COLUMNS.map(col => (
            <div key={col} className="bg-stone-50 rounded-xl p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider">{ENQUIRY_STATUS_LABEL[col]}</p>
                <span className="text-[10px] text-stone-500 bg-white border border-stone-200 rounded-full px-2 py-0.5">{byColumn[col].length}</span>
              </div>
              <div className="space-y-2">
                {byColumn[col].map(r => <EnquiryCard key={r.id} r={r} />)}
                {byColumn[col].length === 0 && (
                  <div className="text-center text-[11px] text-stone-400 py-6">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-xs text-stone-500">
                <th className="text-left px-4 py-2.5 font-medium">Enquiry</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Budget</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{r.title}</p>
                    <p className="text-[11px] text-stone-500">{r.enquiry_number}{r.product_type ? ` · ${r.product_type}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-stone-800">{r.customer?.full_name || '—'}</p>
                    <p className="text-[11px] text-stone-500">{r.customer ? displayPhone(r.customer.whatsapp) : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ENQUIRY_STATUS_STYLE[r.status]}`}>
                      {ENQUIRY_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-700">
                    {r.budget_min || r.budget_max ? `${formatINR(r.budget_min)} – ${formatINR(r.budget_max)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-2 py-3">
                    <Link href={`/enquiries/${r.id}`} className="text-[#1E3A5F] hover:text-[#172d49]">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EnquiryCard({ r }: { r: EnquiryRow }) {
  return (
    <Link href={`/enquiries/${r.id}`}
      className="block bg-white rounded-lg border border-stone-200 p-3 hover:border-stone-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-stone-900 line-clamp-2">{r.title}</p>
      </div>
      <p className="text-[11px] text-stone-500 mt-0.5">{r.enquiry_number}</p>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-stone-700 truncate">{r.customer?.full_name || '—'}</span>
        <span className={`px-1.5 py-0.5 rounded-full border ${ENQUIRY_STATUS_STYLE[r.status]}`}>{ENQUIRY_STATUS_LABEL[r.status]}</span>
      </div>
      {(r.budget_min || r.budget_max) && (
        <p className="mt-1 text-[11px] text-stone-500">{formatINR(r.budget_min)} – {formatINR(r.budget_max)}</p>
      )}
      {r.reference_image_urls?.length > 0 && (
        <div className="mt-2 flex gap-1">
          {r.reference_image_urls.slice(0, 4).map((u, i) => (
            <img key={i} src={u} className="w-9 h-9 object-cover rounded border border-stone-200" alt="" />
          ))}
        </div>
      )}
    </Link>
  )
}
