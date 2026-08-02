'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  AlertTriangle,
  Clock,
  Info,
  Package,
  Calendar,
  CheckCircle2
} from 'lucide-react'

export default function ResellerSampleBox() {
  const [samples, setSamples] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/portal/reseller/samples')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setSamples(data.samples || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading sample box...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>

  const activeSamples = (samples || []).filter(s => ['approved', 'issued'].includes(s.status))
  const requestedSamples = (samples || []).filter(s => s.status === 'requested')
  const totalValue = activeSamples.reduce((s, x) => s + (Number(x.sample_value_paise) || 0), 0)

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-5.5 h-5.5 text-amber-600" />
          My Sample Box
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Review active sample boxes, return deadlines, and pending sample requests.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-700">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Active Samples</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{activeSamples.length}</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Pending Requests</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{requestedSamples.length}</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-xl text-red-650">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Active Sample Liabilities</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">₹{(totalValue / 100).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* RLS policy information banner */}
      <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 flex items-start gap-3 text-xs text-stone-500">
        <Info className="w-4.5 h-4.5 text-stone-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Samples can be credit-based (backed by your reseller credit limit) or deposit-based (remitted via UPI bank transfer).
          Admins will configure the sample type and return dates on approval. Ensure items are returned before the due date to avoid automated balance charges.
        </p>
      </div>

      {/* Samples List */}
      {samples === null ? (
        <p className="text-stone-400 text-sm">Loading samples...</p>
      ) : samples.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center shadow-sm">
          <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Sample Records Found</p>
          <p className="text-stone-400 text-xs mt-1 mb-4">Go to catalog product detail page to request samples for physical showcase.</p>
          <Link
            href="/portal/reseller/catalog"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm"
          >
            Explore Catalog to Request
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-550 font-bold border-b border-stone-200 uppercase tracking-wider">
                  <th className="px-5 py-3">Product SKU</th>
                  <th className="px-5 py-3 text-right">Wholesale Value</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Due Return Date</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {samples.map(sample => {
                  const coverImg = sample.products?.photo_urls?.[0]
                  const pCode = sample.products?.code || '—'
                  const pName = sample.products?.name || 'Jewelry Piece'
                  const isOverdue = ['approved', 'issued'].includes(sample.status) && new Date(sample.return_due_date) < new Date()

                  const statusColors: Record<string, string> = {
                    requested: 'bg-yellow-50 text-yellow-750 border-yellow-200',
                    approved: 'bg-blue-50 text-blue-700 border-blue-200',
                    issued: 'bg-purple-50 text-purple-700 border-purple-200',
                    returned: 'bg-green-50 text-green-700 border-green-200',
                    lost: 'bg-red-50 text-red-700 border-red-200',
                    sold: 'bg-stone-100 text-stone-700 border-stone-200',
                    rejected: 'bg-stone-100 text-stone-400 border-stone-200',
                  }

                  return (
                    <tr key={sample.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-4 flex items-center gap-3">
                        {coverImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverImg}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-stone-150 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 border border-stone-150 text-stone-400 text-[10px] font-bold">
                            SKU
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-stone-900">{pCode}</p>
                          <p className="text-[10px] text-stone-450 mt-0.5">{pName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-stone-850 text-sm">
                        ₹{(sample.sample_value_paise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 uppercase tracking-wider text-[10px] font-semibold text-stone-600">
                        {sample.status === 'requested' ? (
                          <span className="text-stone-400 font-normal">Pending approval</span>
                        ) : sample.sample_type === 'credit' ? (
                          <span className="text-amber-700">Credit Limit</span>
                        ) : (
                          <span>
                            Deposit
                            <p className="text-[9px] text-stone-400 normal-case mt-0.5">Status: {sample.deposit_status}</p>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-stone-500 font-mono text-xs">
                        {sample.status === 'requested' ? (
                          '—'
                        ) : (
                          <span className={isOverdue ? 'text-red-500 font-bold flex items-center gap-1' : ''}>
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                            {new Date(sample.return_due_date).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-[9px] font-bold border ${statusColors[sample.status]}`}>
                          {sample.status}
                          {isOverdue && ' (Overdue)'}
                        </span>
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
