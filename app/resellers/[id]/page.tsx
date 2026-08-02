'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Reseller, ResellerOrder, ResellerSample, ResellerPayment } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Check,
  X,
  CreditCard,
  ShieldAlert,
  Award,
  FileText,
  Settings,
  UserCheck,
  AlertTriangle,
  Store,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Info,
  Clock,
  Eye,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'

export default function ResellerDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data: session } = useSession()
  const adminUserId = session?.user?.id

  const [reseller, setReseller] = useState<Reseller | null>(null)
  const [orders, setOrders] = useState<ResellerOrder[]>([])
  const [samples, setSamples] = useState<ResellerSample[]>([])
  const [payments, setPayments] = useState<ResellerPayment[]>([])
  const [loading, setLoading] = useState(true)

  // Forms state
  const [creditLimitRupees, setCreditLimitRupees] = useState('')
  const [defaultMarkup, setDefaultMarkup] = useState('')
  const [tier, setTier] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('bronze')
  const [updatingProfile, setUpdatingProfile] = useState(false)

  // Detail Modal state for Order/Sample
  const [selectedOrder, setSelectedOrder] = useState<ResellerOrder | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<ResellerPayment | null>(null)

  useEffect(() => {
    if (id) {
      loadAllData()
    }
  }, [id])

  async function loadAllData() {
    try {
      setLoading(true)
      // 1. Load Reseller Profile
      const { data: resellerData, error: resellerErr } = await supabase
        .from('resellers')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (resellerErr) throw resellerErr
      if (!resellerData) {
        alert('Reseller not found')
        router.push('/resellers')
        return
      }

      setReseller(resellerData)
      setCreditLimitRupees(String(Number(resellerData.credit_limit_paise) / 100))
      setDefaultMarkup(String(resellerData.default_markup_percent))
      setTier(resellerData.performance_tier)

      // 2. Load Orders
      const { data: ordersData } = await supabase
        .from('reseller_orders')
        .select('*, products(code, name)')
        .eq('reseller_id', id)
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])

      // 3. Load Samples
      const { data: samplesData } = await supabase
        .from('reseller_sample_ledger')
        .select('*, products(code, name)')
        .eq('reseller_id', id)
        .order('created_at', { ascending: false })

      setSamples(samplesData || [])

      // 4. Load Payments
      const { data: paymentsData } = await supabase
        .from('reseller_payments')
        .select('*, reseller_orders(order_number), reseller_sample_ledger(notes)')
        .eq('reseller_id', id)
        .order('created_at', { ascending: false })

      setPayments(paymentsData || [])

    } catch (e: any) {
      alert('Error loading reseller data: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!reseller) return
    setUpdatingProfile(true)

    try {
      const limitPaise = Math.round(Number(creditLimitRupees) * 100)
      const markupVal = Number(defaultMarkup) || 0

      const { error } = await supabase
        .from('resellers')
        .update({
          credit_limit_paise: limitPaise,
          default_markup_percent: markupVal,
          performance_tier: tier,
          updated_at: new Date().toISOString()
        })
        .eq('id', reseller.id)

      if (error) {
        alert('Update failed: ' + error.message)
      } else {
        alert('Reseller profile updated successfully!')
        loadAllData()
      }
    } catch (err: any) {
      alert('Error updating: ' + err.message)
    } finally {
      setUpdatingProfile(false)
    }
  }

  async function handleUpdateStatus(newStatus: 'active' | 'suspended') {
    if (!reseller) return
    if (!confirm(`Are you sure you want to change reseller status to: ${newStatus}?`)) return

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'active' && reseller.status !== 'active') {
        updateData.approved_by = adminUserId
      }

      const { error } = await supabase
        .from('resellers')
        .update(updateData)
        .eq('id', reseller.id)

      if (error) {
        alert('Failed to update status: ' + error.message)
      } else {
        // Trigger notification
        if (newStatus === 'active') {
          await fetch('/api/public/invite/trigger-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'reseller_approved',
              toPhone: reseller.id, // resolved server-side from reseller_id
              portalUrl: window.location.origin + '/portal/reseller',
              name: reseller.owner_name
            }),
          }).catch(() => {})
        }

        alert(`Reseller status changed to ${newStatus}`)
        loadAllData()
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  async function handleConfirmPayment(paymentId: string) {
    if (!confirm('Are you sure you want to CONFIRM this payment? This will update the order status or reduce outstanding balance.')) return

    try {
      // 1. Fetch payment info
      const { data: payment } = await supabase
        .from('reseller_payments')
        .select('*')
        .eq('id', paymentId)
        .single()

      if (!payment) {
        alert('Payment record not found')
        return
      }

      // 2. Perform updates based on type
      if (payment.payment_type === 'order_payment' && payment.linked_order_id) {
        // Fetch order to check for group
        const { data: ordRow } = await supabase
          .from('reseller_orders')
          .select('set_order_group_id')
          .eq('id', payment.linked_order_id)
          .maybeSingle()

        let updateQuery = supabase
          .from('reseller_orders')
          .update({
            payment_status: 'paid',
            status: 'brief_received',
            updated_at: new Date().toISOString()
          })

        if (ordRow?.set_order_group_id) {
          updateQuery = updateQuery.eq('set_order_group_id', ordRow.set_order_group_id)
        } else {
          updateQuery = updateQuery.eq('id', payment.linked_order_id)
        }

        const { error: orderErr } = await updateQuery

        if (orderErr) {
          alert('Failed to update linked order: ' + orderErr.message)
          return
        }

        // Trigger notify for payment confirmation
        await fetch('/api/public/invite/trigger-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment_confirmed',
            toPhone: payment.reseller_id,
            orderNumber: payment.linked_order_id, // backend will resolve
            productName: '',
          }),
        }).catch(() => {})

      } else if (payment.payment_type === 'outstanding_clear') {
        // Reduce outstanding balance
        if (reseller) {
          const newOutstanding = Math.max(0, Number(reseller.outstanding_balance_paise) - Number(payment.amount_paise))
          const { error: resErr } = await supabase
            .from('resellers')
            .update({
              outstanding_balance_paise: newOutstanding,
              updated_at: new Date().toISOString()
            })
            .eq('id', reseller.id)

          if (resErr) {
            alert('Failed to update reseller balance: ' + resErr.message)
            return
          }
        }
      } else if (payment.payment_type === 'sample_deposit' && payment.linked_sample_id) {
        // Confirm sample deposit
        const { error: sampleErr } = await supabase
          .from('reseller_sample_ledger')
          .update({
            deposit_status: 'confirmed',
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.linked_sample_id)

        if (sampleErr) {
          alert('Failed to update linked sample: ' + sampleErr.message)
          return
        }
      }

      // 3. Confirm Payment row
      const { error: payErr } = await supabase
        .from('reseller_payments')
        .update({
          status: 'confirmed',
          confirmed_by: adminUserId,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (payErr) {
        alert('Failed to confirm payment row: ' + payErr.message)
      } else {
        alert('Payment confirmed successfully!')
        setSelectedPayment(null)
        loadAllData()
      }

    } catch (e: any) {
      alert('Error confirming payment: ' + e.message)
    }
  }

  async function handleRejectPayment(paymentId: string) {
    const reason = prompt('Please enter the reason for rejection (optional):')
    if (reason === null) return // cancelled prompt

    try {
      const { error } = await supabase
        .from('reseller_payments')
        .update({
          status: 'rejected',
          confirmed_by: adminUserId,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (error) {
        alert('Failed to reject payment: ' + error.message)
      } else {
        alert('Payment rejected.')
        setSelectedPayment(null)
        loadAllData()
      }
    } catch (e: any) {
      alert('Error rejecting payment: ' + e.message)
    }
  }

  // Reused from samples page for convenience
  async function handleConfirmSampleReturn(id: string) {
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
        loadAllData()
      }
    } catch (e: any) {
      alert('Error confirming return: ' + e.message)
    }
  }

  async function handleChargeSample(id: string) {
    if (!confirm('Are you sure you want to mark this sample as lost and charge its value to the reseller\'s outstanding balance?')) return
    try {
      const { data: sample } = await supabase
        .from('reseller_sample_ledger')
        .select('sample_value_paise, sample_type')
        .eq('id', id)
        .single()

      if (!sample || !reseller) return

      const currentBalance = Number(reseller.outstanding_balance_paise) || 0
      const sampleValue = Number(sample.sample_value_paise) || 0

      // Update Reseller
      const { error: resErr } = await supabase
        .from('resellers')
        .update({ outstanding_balance_paise: currentBalance + sampleValue })
        .eq('id', reseller.id)

      if (resErr) {
        alert('Failed to update reseller balance: ' + resErr.message)
        return
      }

      // Update Sample
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
            toPhone: reseller.id,
            productName: id,
            valuePaise: sampleValue,
          }),
        }).catch(() => {})

        alert('Sample charged to reseller balance successfully!')
        loadAllData()
      }
    } catch (e: any) {
      alert('Error charging sample: ' + e.message)
    }
  }

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm font-semibold text-stone-800'

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading reseller details...</div>
  if (!reseller) return <div className="p-4 lg:p-7 text-stone-450 text-sm">Reseller profile not found.</div>

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
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              <span className="text-stone-700">{reseller.store_name}</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Store className="w-5 h-5 text-stone-800" />
              {reseller.store_name}
              <span className={`px-2 py-0.5 text-xs font-semibold border ${statusColors[reseller.status]}`}>
                {reseller.status}
              </span>
            </h1>
            <p className="text-xs text-stone-400 font-mono mt-0.5">Code: {reseller.reseller_code}</p>
          </div>
        </div>

        {/* Quick Activation / Suspension Panel */}
        <div className="flex items-center gap-2">
          {(reseller.status === 'invited' || reseller.status === 'onboarding') && (
            <button
              onClick={() => handleUpdateStatus('active')}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" /> Approve & Activate Profile
            </button>
          )}
          {reseller.status === 'active' && (
            <button
              onClick={() => handleUpdateStatus('suspended')}
              className="bg-red-650 hover:bg-red-750 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" /> Suspend Reseller
            </button>
          )}
          {reseller.status === 'suspended' && (
            <button
              onClick={() => handleUpdateStatus('active')}
              className="bg-green-650 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> Reactivate Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card & KYC Details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Metadata Display */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-stone-400" /> Reseller Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-stone-600">
                <UserCheck className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Owner Name</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{reseller.owner_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-stone-600">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Phone</p>
                  <p className="font-semibold text-stone-850 mt-0.5">{reseller.phone}</p>
                </div>
              </div>
              {reseller.email && (
                <div className="flex items-center gap-2.5 text-stone-600">
                  <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Email Address</p>
                    <p className="font-semibold text-stone-850 mt-0.5">{reseller.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5 text-stone-600">
                <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">City & Address</p>
                  <p className="font-semibold text-stone-850 mt-0.5">{reseller.city}</p>
                  <p className="text-xs text-stone-450 mt-0.5">{reseller.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-stone-600 pt-2 border-t border-stone-100">
                <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-xs text-stone-500 font-medium">Joined: {new Date(reseller.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Edit Limits Form */}
          <form onSubmit={handleUpdateProfile} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-stone-400" /> Adjust System Limits
            </h3>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Credit Limit (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-400 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    className={`${inp} pl-7 font-bold`}
                    value={creditLimitRupees}
                    onChange={e => setCreditLimitRupees(e.target.value)}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>Default Markup %</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    className={`${inp} pr-7 font-bold`}
                    value={defaultMarkup}
                    onChange={e => setDefaultMarkup(e.target.value)}
                    min="0"
                    max="100"
                    required
                  />
                  <span className="absolute right-3 top-2 text-stone-400 text-sm font-semibold">%</span>
                </div>
              </div>

              <div>
                <label className={lbl}>Performance Tier</label>
                <select
                  className={inp}
                  value={tier}
                  onChange={e => setTier(e.target.value as any)}
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                className="w-full bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-2"
              >
                {updatingProfile ? 'Saving...' : 'Update Settings'}
              </button>
            </div>
          </form>

          {/* KYC Details */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-stone-400" /> KYC Verification Docs
            </h3>
            {reseller.kyc_document_type ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Document Type</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{reseller.kyc_document_type}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">ID/Document Number</p>
                  <p className="font-mono font-semibold text-stone-850 mt-0.5">{reseller.kyc_document_number || '—'}</p>
                </div>
                {reseller.kyc_document_url && (
                  <a
                    href={reseller.kyc_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-stone-800 hover:underline font-bold bg-stone-800/5 hover:bg-stone-800/10 px-3 py-1.5 rounded-lg w-full justify-center transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Uploaded KYC Document
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-stone-50 border border-stone-150 rounded-xl text-stone-500 text-xs">
                <Info className="w-4 h-4 text-stone-400" />
                <span>KYC documents have not been uploaded by this reseller yet.</span>
              </div>
            )}
          </div>

          {/* Bank Details */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-stone-400" /> Bank & UPI Details
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Bank Name</p>
                <p className="font-semibold text-stone-850 mt-0.5">{reseller.bank_name || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">Account Number</p>
                  <p className="font-mono text-stone-855 font-semibold mt-0.5">{reseller.account_number || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">IFSC Code</p>
                  <p className="font-mono text-stone-855 font-semibold mt-0.5">{reseller.ifsc_code || '—'}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-stone-100">
                <p className="text-[10px] text-stone-400 font-bold uppercase leading-none">UPI Address / ID</p>
                <p className="font-mono text-stone-855 font-semibold mt-0.5">{reseller.upi_id || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs: Orders, Samples, Payments */}
        <div className="space-y-6 lg:col-span-2">
          {/* Financial summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-stone-800 text-white p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider leading-none">Lifetime Sales</p>
              <p className="text-xl font-bold mt-1.5">₹{(reseller.lifetime_sales_paise / 100).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-stone-450 font-semibold uppercase tracking-wider leading-none">Outstanding Balance</p>
              <p className="text-xl font-bold text-red-650 mt-1.5">₹{(reseller.outstanding_balance_paise / 100).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-stone-450 font-semibold uppercase tracking-wider leading-none">Credit Limit Used</p>
              <div className="flex items-baseline justify-between mt-1.5">
                <p className="text-xl font-bold text-stone-855">
                  ₹{(reseller.outstanding_balance_paise / 100).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400">
                  / ₹{(reseller.credit_limit_paise / 100).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-amber-600 h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      reseller.credit_limit_paise > 0
                        ? (reseller.outstanding_balance_paise / reseller.credit_limit_paise) * 100
                        : 0
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Pending Payment Confirmation Area */}
          {payments.some(p => p.status === 'pending') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Action Required: Confirm Pending Payments
              </div>
              <div className="divide-y divide-amber-150">
                {payments
                  .filter(p => p.status === 'pending')
                  .map(p => (
                    <div key={p.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">
                          {p.payment_type.replace('_', ' ')}
                        </span>
                        <p className="text-sm font-semibold text-stone-800 mt-1">₹{(p.amount_paise / 100).toLocaleString('en-IN')} via {p.payment_method}</p>
                        <p className="text-xs text-stone-500 font-mono mt-0.5">Ref: {p.transaction_reference || '—'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {p.proof_screenshot_url && (
                          <button
                            onClick={() => setSelectedPayment(p)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 text-xs font-semibold flex items-center gap-1"
                            title="View screenshot proof"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Proof
                          </button>
                        )}
                        <button
                          onClick={() => handleConfirmPayment(p.id)}
                          className="bg-green-650 hover:bg-green-700 text-white text-xs font-bold p-1.5 rounded-lg flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm
                        </button>
                        <button
                          onClick={() => handleRejectPayment(p.id)}
                          className="bg-stone-100 hover:bg-red-50 text-red-650 hover:text-red-750 p-1.5 rounded-lg border border-stone-200"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Orders Section */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <Store className="w-4 h-4 text-stone-400" /> Reseller Customer Orders ({orders.length})
              </h3>
            </div>
            {orders.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">No orders placed yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                      <th className="px-4 py-3">Order Number</th>
                      <th className="px-4 py-3">Product / Qty</th>
                      <th className="px-4 py-3">Customer / Address</th>
                      <th className="px-4 py-3 text-right">Floor Price</th>
                      <th className="px-4 py-3 text-right">Markup / Selling</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.map(order => {
                      const pName = (order as any).products?.name || 'Unknown SKU'
                      const pCode = (order as any).products?.code || '—'
                      const isOrderOverdue = order.status === 'payment_pending' && new Date(order.payment_deadline) < new Date()

                      return (
                        <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-3.5 font-bold font-mono text-amber-700">{order.order_number}</td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-stone-850">{pCode}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">{pName} · Qty: {order.quantity}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-stone-850">{order.shipping_name}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">{order.shipping_phone} · {order.shipping_address.slice(0, 30)}...</p>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-stone-700">
                            ₹{(order.reseller_cost_paise / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <p className="font-semibold text-green-700">₹{(order.customer_selling_price_paise / 100).toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">Earnings: ₹{(order.reseller_earnings_paise / 100).toLocaleString('en-IN')}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {order.payment_status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              isOrderOverdue ? 'bg-red-205 text-red-850 font-bold' : 'bg-stone-100 text-stone-700'
                            }`}>
                              {order.status}
                              {isOrderOverdue && ' (Overdue)'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Samples Section */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-stone-400" /> Issued Samples Box ({samples.length})
              </h3>
            </div>
            {samples.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">No sample requests logged.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                      <th className="px-4 py-3">Product SKU</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {samples.map(sample => {
                      const pName = (sample as any).products?.name || ''
                      const pCode = (sample as any).products?.code || '—'
                      const isOverdue =
                        (sample.status === 'approved' || sample.status === 'issued') &&
                        new Date(sample.return_due_date) < new Date()

                      return (
                        <tr key={sample.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-stone-850">{pCode}</p>
                            <p className="text-[10px] text-stone-450 mt-0.5">{pName}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-stone-700">
                            ₹{(sample.sample_value_paise / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 uppercase tracking-wider text-[10px] font-semibold text-stone-600">
                            {sample.sample_type === 'credit' ? (
                              <span className="text-amber-700">Credit</span>
                            ) : (
                              <span>
                                Deposit (₹{((sample.deposit_amount_paise || 0) / 100).toLocaleString('en-IN')})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-stone-500 font-mono">
                            <span className={isOverdue ? 'text-red-500 font-bold' : ''}>
                              {new Date(sample.return_due_date).toLocaleDateString('en-IN')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              sample.status === 'returned' ? 'bg-green-100 text-green-800' :
                              sample.status === 'lost' ? 'bg-red-100 text-red-800' :
                              sample.status === 'approved' || sample.status === 'issued' ? 'bg-purple-100 text-purple-800' :
                              'bg-stone-100 text-stone-500'
                            }`}>
                              {sample.status}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {(sample.status === 'approved' || sample.status === 'issued') && (
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => handleConfirmSampleReturn(sample.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                                >
                                  Returned
                                </button>
                                <button
                                  onClick={() => handleChargeSample(sample.id)}
                                  className="bg-red-650 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                                >
                                  Charge
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
            )}
          </div>

          {/* Payments Ledger Section */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-stone-400" /> Payments History ({payments.length})
              </h3>
            </div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">No payments submitted yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                      <th className="px-4 py-3">Transaction Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Reference / Target</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {payments.map(payment => {
                      const orderNum = payment.reseller_orders?.order_number || ''
                      const statusColors: Record<string, string> = {
                        pending: 'bg-yellow-50 text-yellow-750 border-yellow-200',
                        confirmed: 'bg-green-50 text-green-700 border-green-200',
                        rejected: 'bg-red-50 text-red-700 border-red-200',
                      }

                      return (
                        <tr key={payment.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-stone-500 font-mono">
                            {new Date(payment.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 uppercase tracking-wider text-[10px] font-semibold text-stone-600">
                            {payment.payment_type.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3.5 uppercase text-stone-600">{payment.payment_method}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-stone-900">
                            ₹{(payment.amount_paise / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-stone-850">{payment.transaction_reference || '—'}</p>
                            {orderNum && <p className="text-[10px] text-stone-400 mt-0.5">Order: {orderNum}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[payment.status]}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {payment.proof_screenshot_url && (
                              <button
                                onClick={() => setSelectedPayment(payment)}
                                className="text-xs text-stone-800 hover:underline font-bold"
                              >
                                View Proof
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Screenshot Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Payment Proof Screenshot</h4>
                <p className="text-xs text-stone-400 mt-0.5">₹{(selectedPayment.amount_paise / 100).toLocaleString('en-IN')} · Ref: {selectedPayment.transaction_reference || '—'}</p>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-1 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-stone-50 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              {selectedPayment.proof_screenshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPayment.proof_screenshot_url}
                  alt="Payment screenshot proof"
                  className="max-w-full max-h-[60vh] object-contain rounded-xl border border-stone-200 shadow-sm"
                />
              ) : (
                <span className="text-stone-400 text-xs">No image URL found.</span>
              )}
            </div>
            {selectedPayment.status === 'pending' && (
              <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-2">
                <button
                  onClick={() => handleRejectPayment(selectedPayment.id)}
                  className="bg-red-650 hover:bg-red-750 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Reject Payment proof
                </button>
                <button
                  onClick={() => handleConfirmPayment(selectedPayment.id)}
                  className="bg-green-650 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm Payment & Process Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
