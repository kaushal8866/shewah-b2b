'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Search,
  ShoppingBag,
  Calendar,
  Phone,
  Mail,
  DollarSign
} from 'lucide-react'

export default function ResellerCustomers() {
  const [customers, setCustomers] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/portal/reseller/customers')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setCustomers(data.customers || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading customer network...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const filteredCustomers = (customers || []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  )

  const totalSpent = (customers || []).reduce((s, c) => s + (Number(c.total_value_paise) || 0), 0)

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Users className="w-5.5 h-5.5 text-amber-600" />
          My Customer Network
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          View repeat buyers, customer lifetime value, and order history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Total Customers</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">{customers?.length || 0}</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl text-green-700">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-stone-455 font-bold uppercase tracking-wider">Total Revenue Generated</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">₹{(totalSpent / 100).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-semibold"
            placeholder="Search customers by name, phone or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Customers Found</p>
          <p className="text-stone-400 text-xs mt-1">Customers appear here automatically once you place orders for them.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-550 font-bold border-b border-stone-200 uppercase tracking-wider">
                  <th className="px-5 py-3">Customer Details</th>
                  <th className="px-5 py-3 text-right">Total Orders</th>
                  <th className="px-5 py-3 text-right">Lifetime Spent</th>
                  <th className="px-5 py-3">First Order Date</th>
                  <th className="px-5 py-3">Last Order Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-stone-900 text-sm">{c.name}</p>
                      <div className="flex items-center gap-3 text-stone-400 text-[10px] mt-1 font-semibold">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-stone-850 text-sm">
                      {c.total_orders} order(s)
                    </td>
                    <td className="px-5 py-4 text-right font-black text-green-700 text-sm">
                      ₹{(c.total_value_paise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-stone-500 font-mono">
                      {c.first_order_date ? new Date(c.first_order_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-4 text-stone-500 font-mono">
                      {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
