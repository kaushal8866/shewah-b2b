'use client'

import { useEffect, useState } from 'react'
import { supabase, Circuit } from '@/lib/supabase'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { Plus, MapPin, Target, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function CircuitsPage() {
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadCircuits() }, [])

  async function loadCircuits() {
    setLoading(true)
    const { data } = await supabase.from('circuits').select('*').order('start_date', { ascending: false })
    setCircuits(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('circuits').update({ status }).eq('id', id)
    loadCircuits()
  }

  function pct(actual: number, target: number) {
    if (!target) return 0
    return Math.min(Math.round((actual / target) * 100), 100)
  }

  const ProgressBar = ({ value }: { value: number }) => (
    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <div className="h-full bg-[#C49C64] rounded-full transition-all"
        style={{ width: `${value}%` }} />
    </div>
  )

  const stats = {
    total: circuits.length,
    planned: circuits.filter(c => c.status === 'planned').length,
    active: circuits.filter(c => c.status === 'in_progress').length,
    completed: circuits.filter(c => c.status === 'completed').length,
    totalVisits: circuits.reduce((s, c) => s + (c.actual_visits || 0), 0),
    totalPartners: circuits.reduce((s, c) => s + (c.actual_partners || 0), 0),
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Circuits</h1>
          <p className="text-stone-500 text-sm mt-0.5">B2B visit trip planner</p>
        </div>
        <Link href="/circuits/new"
          className="flex items-center gap-2 bg-[#C49C64] text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Plan circuit</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 lg:mb-6">
        {[
          { label: 'Total trips', value: stats.total },
          { label: 'Active now', value: stats.active },
          { label: 'Stores visited', value: stats.totalVisits },
          { label: 'Partners acquired', value: stats.totalPartners },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-400">{s.label}</p>
            <p className="text-2xl font-semibold text-stone-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Circuit cards */}
      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading circuits...</div>
      ) : circuits.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">No circuits planned yet</p>
          <Link href="/circuits/new" className="inline-block mt-3 text-sm text-[#C49C64] hover:underline">
            Plan your first circuit →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {circuits.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-stone-900">{c.name}</h3>
                    <span className={`status-pill text-xs ${getStatusColor(c.status)}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                    {c.region && (
                      <span className="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full">
                        {c.region}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                    {c.start_date && <span>{formatDate(c.start_date)}</span>}
                    {c.start_date && c.end_date && <span>→</span>}
                    {c.end_date && <span>{formatDate(c.end_date)}</span>}
                    {c.cities && c.cities.length > 0 && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {c.cities.slice(0, 4).join(' → ')}{c.cities.length > 4 ? ` +${c.cities.length - 4}` : ''}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === 'planned' && (
                    <button onClick={() => updateStatus(c.id, 'in_progress')}
                      className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-200 transition-colors">
                      Start circuit
                    </button>
                  )}
                  {c.status === 'in_progress' && (
                    <button onClick={() => updateStatus(c.id, 'completed')}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors">
                      Mark complete
                    </button>
                  )}
                  <Link href={`/circuits/${c.id}`}
                    className="text-stone-300 hover:text-stone-600 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-5">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-stone-500 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Store visits
                    </span>
                    <span className="font-medium text-stone-700">
                      {c.actual_visits}/{c.target_visits || '?'}
                    </span>
                  </div>
                  <ProgressBar value={pct(c.actual_visits, c.target_visits || 0)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-stone-500">Sample orders</span>
                    <span className="font-medium text-stone-700">
                      {c.actual_samples}/{c.target_samples || '?'}
                    </span>
                  </div>
                  <ProgressBar value={pct(c.actual_samples, c.target_samples || 0)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-stone-500 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Partners signed
                    </span>
                    <span className="font-medium text-stone-700">
                      {c.actual_partners}/{c.target_partners || '?'}
                    </span>
                  </div>
                  <ProgressBar value={pct(c.actual_partners, c.target_partners || 0)} />
                </div>
              </div>

              {/* Budget */}
              {c.budget_inr && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <p className="text-xs text-stone-400">Budget: {formatCurrency(c.budget_inr)}</p>
                  <p className="text-xs text-stone-400">
                    Spent: {formatCurrency(c.spent_inr || 0)}
                    {c.budget_inr > 0 && (
                      <span className="ml-1 text-stone-300">
                        ({Math.round((c.spent_inr / c.budget_inr) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
