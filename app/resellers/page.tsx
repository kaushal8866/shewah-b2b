'use client'

import { useEffect, useState } from 'react'
import { supabase, Reseller } from '@/lib/supabase'
import { Plus, Search, Store, CreditCard, ShieldAlert, Award, FileText, Settings, UserPlus, ShieldCheck, Activity, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default function ResellersDirectoryPage() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [totals, setTotals] = useState({
    activeCount: 0,
    totalSales: 0,
    outstanding: 0,
  })

  useEffect(() => {
    fetchResellers()
  }, [])

  async function fetchResellers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('resellers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        alert('Error loading resellers: ' + error.message)
      } else {
        const list = data || []
        setResellers(list)

        // Calculate totals
        const active = list.filter((r: any) => r.status === 'active').length
        const sales = list.reduce((s: number, r: any) => s + (Number(r.lifetime_sales_paise) || 0), 0)
        const balance = list.reduce((s: number, r: any) => s + (Number(r.outstanding_balance_paise) || 0), 0)
        setTotals({ activeCount: active, totalSales: sales, outstanding: balance })
      }
    } catch (e: any) {
      alert('Error fetching resellers: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredResellers = resellers.filter(r => {
    const matchesSearch =
      r.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      r.store_name.toLowerCase().includes(search.toLowerCase()) ||
      r.reseller_code.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search)
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    const matchesTier = tierFilter === 'all' || r.performance_tier === tierFilter
    return matchesSearch && matchesStatus && matchesTier
  })

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-1 font-medium">
            <Link href="/dashboard" className="hover:text-stone-700">Dashboard</Link>
            <span>/</span>
            <span className="text-stone-700">Resellers</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-stone-800" />
            Reseller Network
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage White-Label dropship resellers, review credit limits, and check outstanding balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/resellers/operations"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-600 hover:bg-stone-55 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <Activity className="w-4 h-4 text-amber-600" />
            Operations Hub
          </Link>
          <Link
            href="/resellers/messages"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-600 hover:bg-stone-55 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <MessageSquare className="w-4 h-4 text-indigo-650" />
            Support Chats
          </Link>
          <Link
            href="/resellers/invitations"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-stone-500" />
            Manage Invites
          </Link>
          <Link
            href="/resellers/samples"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <CreditCard className="w-4 h-4 text-stone-500" />
            Sample Fulfillment
          </Link>
          <Link
            href="/resellers/settings"
            className="flex items-center gap-2 border border-stone-200 bg-white text-stone-600 hover:bg-stone-55 p-2.5 rounded-xl transition-all shadow-sm"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-stone-500" />
          </Link>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-stone-800">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-450 font-medium uppercase tracking-wider">Active Resellers</p>
            <p className="text-2xl font-bold text-stone-900 mt-0.5">{totals.activeCount} <span className="text-xs font-normal text-stone-400">/ {resellers.length} total</span></p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl text-green-600">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-455 font-medium uppercase tracking-wider">Lifetime Sales</p>
            <p className="text-2xl font-bold text-stone-900 mt-0.5">₹{(totals.totalSales / 100).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-xl text-red-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-460 font-medium uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-2xl font-bold text-stone-900 mt-0.5">₹{(totals.outstanding / 100).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800"
            placeholder="Search by code, owner name, store name, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="invited">Invited</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20"
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
          >
            <option value="all">All Tiers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
        </div>
      </div>

      {/* Resellers Directory Table */}
      {loading ? (
        <div className="text-center text-stone-400 py-12">Loading resellers...</div>
      ) : filteredResellers.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <Store className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Resellers Found</p>
          <p className="text-stone-400 text-xs mt-1">Try adjusting your filters or send a new invitation to onboard.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                  <th className="px-5 py-3">Code / Store</th>
                  <th className="px-5 py-3">Owner Details</th>
                  <th className="px-5 py-3">Performance Tier</th>
                  <th className="px-5 py-3 text-right">Credit Used / Limit</th>
                  <th className="px-5 py-3 text-right">Outstanding</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredResellers.map(reseller => {
                  const statusColors: Record<string, string> = {
                    invited: 'bg-blue-50 text-blue-700 border-blue-200',
                    onboarding: 'bg-yellow-50 text-yellow-750 border-yellow-200',
                    active: 'bg-green-50 text-green-700 border-green-200',
                    suspended: 'bg-red-50 text-red-700 border-red-200',
                  }

                  const tierColors: Record<string, string> = {
                    bronze: 'bg-amber-100 text-amber-800',
                    silver: 'bg-stone-200 text-stone-700',
                    gold: 'bg-yellow-100 text-yellow-800',
                    platinum: 'bg-purple-100 text-purple-800',
                  }

                  return (
                    <tr key={reseller.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs text-amber-700 font-bold">{reseller.reseller_code}</p>
                        <p className="font-bold text-stone-900 mt-0.5">{reseller.store_name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-stone-850">{reseller.owner_name}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{reseller.phone} · {reseller.city}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${tierColors[reseller.performance_tier] || 'bg-stone-100'}`}>
                          {reseller.performance_tier}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-semibold text-stone-900">₹{(reseller.outstanding_balance_paise / 100).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-stone-400 mt-0.5">Limit: ₹{(reseller.credit_limit_paise / 100).toLocaleString('en-IN')}</p>
                      </td>
                      <td className="px-5 py-4 text-right text-stone-800 font-bold">
                        ₹{(reseller.outstanding_balance_paise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-medium border ${statusColors[reseller.status]}`}>
                          {reseller.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/resellers/${reseller.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-stone-800 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/60 px-3 py-1.5 rounded-lg transition-all"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
