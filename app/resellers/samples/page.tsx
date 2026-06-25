'use client'

import { useEffect, useState } from 'react'
import { supabase, ResellerSample } from '@/lib/supabase'
import { ArrowLeft, Check, X, CreditCard, ShieldAlert, Award, FileText, Settings, UserCheck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function ResellerSamplesPage() {
  const [samples, setSamples] = useState<(ResellerSample & { resellers?: { store_name: string; owner_name: string; phone: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchSamples()
  }, [])

  async function fetchSamples() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reseller_sample_ledger')
        .select(`
          *,
          resellers (
            store_name,
            owner_name,
            phone
          ),
          products (
            code,
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        alert('Error loading sample ledger: ' + error.message)
      } else {
        setSamples(data || [])
      }
    } catch (e: any) {
      alert('Error fetching sample ledger: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveSample(id: string, type: 'credit' | 'deposit', depositAmount: number = 0) {
    try {
      const returnDate = new Date()
      returnDate.setDate(returnDate.getDate() + 30) // default 30 days return policy

      // 1. Fetch sample info to get value and reseller ID
      const { data: sampleRow } = await supabase
        .from('reseller_sample_ledger')
        .select('reseller_id, sample_value_paise')
        .eq('id', id)
        .single()

      if (!sampleRow) return

      if (type === 'credit') {
        // Verify reseller outstanding/credit limits
        const { data: reseller } = await supabase
          .from('resellers')
          .select('credit_limit_paise, outstanding_balance_paise')
          .eq('id', sampleRow.reseller_id)
          .single()
        
        if (reseller) {
          const used = Number(reseller.outstanding_balance_paise)
          const limit = Number(reseller.credit_limit_paise)
          if (used + Number(sampleRow.sample_value_paise) > limit) {
            if (!confirm('Warning: This sample exceeds the reseller\'s available credit limit. Proceed anyway?')) {
              return
            }
          }
        }
      }

      // 2. Update sample status
      const { error: err } = await supabase
        .from('reseller_sample_ledger')
        .update({
          status: 'approved',
          sample_type: type,
          deposit_amount_paise: type === 'deposit' ? depositAmount * 100 : 0,
          deposit_status: type === 'deposit' ? 'pending_proof' : null,
          issue_date: new Date().toISOString(),
          return_due_date: returnDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (err) {
        alert('Approve failed: ' + err.message)
      } else {
        // Trigger simulated WhatsApp notification
        await fetch('/api/public/invite/trigger-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'sample_approved',
            toPhone: sampleRow.reseller_id, // backend maps ID to phone
            productName: id, // resolved server-side
            sampleType: type,
            dueDate: returnDate.toISOString(),
          }),
        }).catch(() => {})

        alert('Sample request approved successfully!')
        fetchSamples()
      }
    } catch (e: any) {
      alert('Error approving sample: ' + e.message)
    }
  }

  async function handleConfirmReturn(id: string) {
    try {
      const { data: sampleRow } = await supabase
        .from('reseller_sample_ledger')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!sampleRow) return

      const { error: err } = await supabase
        .from('reseller_sample_ledger')
        .update({
          status: 'returned',
          deposit_status: sampleRow.sample_type === 'deposit' ? 'refunded' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (err) {
        alert('Failed to return: ' + err.message)
      } else {
        alert('Sample return logged and confirmed!')
        fetchSamples()
      }
    } catch (e: any) {
      alert('Error confirming return: ' + e.message)
    }
  }

  async function handleChargeSample(id: string) {
    if (!confirm('Are you sure you want to mark this sample as lost and charge the value to the reseller\'s outstanding balance?')) return
    try {
      // 1. Fetch sample info
      const { data: sample } = await supabase
        .from('reseller_sample_ledger')
        .select('reseller_id, sample_value_paise, status')
        .eq('id', id)
        .single()

      if (!sample) return

      // 2. Fetch reseller info
      const { data: reseller } = await supabase
        .from('resellers')
        .select('outstanding_balance_paise')
        .eq('id', sample.reseller_id)
        .single()

      if (!reseller) return

      const currentBalance = Number(reseller.outstanding_balance_paise) || 0
      const sampleValue = Number(sample.sample_value_paise) || 0

      // 3. Perform update transaction
      const { error: resErr } = await supabase
        .from('resellers')
        .update({ outstanding_balance_paise: currentBalance + sampleValue })
        .eq('id', sample.reseller_id)

      if (resErr) {
        alert('Failed to update reseller balance: ' + resErr.message)
        return
      }

      const { error: sampleErr } = await supabase
        .from('reseller_sample_ledger')
        .update({
          status: 'lost',
          deposit_status: sample.sample_type === 'deposit' ? 'forfeited' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (sampleErr) {
        alert('Failed to update sample status: ' + sampleErr.message)
      } else {
        // Trigger simulated WhatsApp notification
        await fetch('/api/public/invite/trigger-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'sample_charged',
            toPhone: sample.reseller_id,
            productName: id,
            valuePaise: sampleValue,
          }),
        }).catch(() => {})

        alert('Sample charged to reseller balance successfully!')
        fetchSamples()
      }
    } catch (e: any) {
      alert('Error charging sample: ' + e.message)
    }
  }

  const filteredSamples = samples.filter(s => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return s.status === 'requested'
    if (statusFilter === 'active') return s.status === 'approved' || s.status === 'issued'
    return s.status === statusFilter
  })

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20'

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/resellers"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/resellers" className="hover:text-stone-700">Resellers</Link>
            <span>/</span>
            <span className="text-stone-700">Samples</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-stone-500" />
            Sample Fulfillment
          </h1>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-550 font-bold uppercase tracking-wider">Filter requests:</label>
          <select
            className={inp}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Ledger Rows</option>
            <option value="pending">Pending Requests</option>
            <option value="approved">Approved</option>
            <option value="returned">Returned</option>
            <option value="lost">Charged (Lost)</option>
            <option value="sold">Sold</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button
          onClick={fetchSamples}
          className="text-xs font-semibold text-[#1E3A5F] hover:underline"
        >
          Reload Ledger
        </button>
      </div>

      {/* Sample Ledger list */}
      {loading ? (
        <div className="text-center text-stone-400 py-12">Loading sample ledger...</div>
      ) : filteredSamples.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-sm">
          <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 font-semibold text-sm">No Sample Records Found</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                  <th className="px-5 py-3">Reseller</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3">Sample Type</th>
                  <th className="px-5 py-3"><span className="flex items-center gap-1">Due Date</span></th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSamples.map(sample => {
                  const rName = sample.resellers?.store_name || 'Unknown'
                  const rOwner = sample.resellers?.owner_name || ''
                  const pCode = (sample as any).products?.code || '—'
                  const pName = (sample as any).products?.name || ''
                  const isOverdue =
                    (sample.status === 'approved' || sample.status === 'issued') &&
                    new Date(sample.return_due_date) < new Date()

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
                      <td className="px-5 py-4">
                        <p className="font-bold text-stone-900">{rName}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{rOwner} · {sample.resellers?.phone}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-stone-850">{pCode}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{pName}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-stone-900">
                        ₹{(sample.sample_value_paise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 uppercase tracking-wider text-xs font-semibold text-stone-600">
                        {sample.status === 'requested' ? (
                          <span className="text-stone-400 font-normal">Pending type decision</span>
                        ) : sample.sample_type === 'credit' ? (
                          <span className="text-amber-700">Credit Limit</span>
                        ) : (
                          <span>
                            Deposit (₹{((sample.deposit_amount_paise || 0) / 100).toLocaleString('en-IN')})
                            <p className="text-[10px] text-stone-450 normal-case mt-0.5">Status: {sample.deposit_status}</p>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-stone-500 text-xs font-mono">
                        {sample.status === 'requested' ? (
                          '—'
                        ) : (
                          <span className={isOverdue ? 'text-red-500 font-bold flex items-center gap-1' : ''}>
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                            {new Date(sample.return_due_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[sample.status]}`}>
                          {sample.status}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                        {sample.status === 'requested' && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveSample(sample.id, 'credit')}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Approve (Credit)
                            </button>
                            <button
                              onClick={() => {
                                const dep = prompt('Enter Refundable Deposit Amount (₹):', String(sample.sample_value_paise / 100))
                                if (dep !== null) {
                                  handleApproveSample(sample.id, 'deposit', Number(dep) || 0)
                                }
                              }}
                              className="bg-[#1E3A5F] hover:bg-[#162B47] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Approve (Deposit)
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Reject this sample request?')) {
                                  await supabase.from('reseller_sample_ledger').update({ status: 'rejected' }).eq('id', sample.id)
                                  fetchSamples()
                                }
                              }}
                              className="border border-stone-200 text-stone-500 hover:bg-stone-50 text-xs font-semibold px-2 py-1.5 rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {(sample.status === 'approved' || sample.status === 'issued') && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleConfirmReturn(sample.id)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Confirm Return
                            </button>
                            <button
                              onClick={() => handleChargeSample(sample.id)}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" /> Charge Lost
                            </button>
                          </div>
                        )}
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
