'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Plus, Search, Filter, Diamond, ArrowUpRight, ArrowDownLeft, X, DollarSign, Calendar, Clipboard, FileText, Download, Trash2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function PartnerTradesPage() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  const [trades, setTrades] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [partnerFilter, setPartnerFilter] = useState('all')

  // Selected trade for details panel / logging payments
  const [selectedTrade, setSelectedTrade] = useState<any>(null)

  // GST Invoices State
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [generateInvoiceOpen, setGenerateInvoiceOpen] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState<any>({
    tax_treatment: 'inclusive',
    invoice_date: new Date().toISOString().split('T')[0],
    buyer_name: '',
    buyer_gstin: '',
    buyer_address: '',
    buyer_state: 'Gujarat',
    hsn_code: '7102',
  })
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')

  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    if (!selectedTrade) return
    setInvoiceForm({
      tax_treatment: 'inclusive',
      invoice_date: new Date().toISOString().split('T')[0],
      buyer_name: selectedTrade.partners?.store_name || selectedTrade.partners?.owner_name || '',
      buyer_gstin: selectedTrade.partners?.gst_number || '',
      buyer_address: selectedTrade.partners?.address || '',
      buyer_state: selectedTrade.partners?.state || 'Gujarat',
      hsn_code: '7102',
    })
  }, [selectedTrade])
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase
        .from('partner_diamond_trades')
        .select(`
          *,
          partners:partner_id (store_name, owner_name, state, address, gst_number),
          diamond_shapes:diamond_shape_id (name),
          diamond_sizes:diamond_size_id (label)
        `)
        .order('trade_date', { ascending: false }),
      supabase.from('partners').select('id, store_name').order('store_name')
    ])
    setTrades(t || [])
    setPartners(p || [])
    setLoading(false)
  }

  // Load payments and invoices when a trade is selected
  useEffect(() => {
    if (selectedTrade) {
      loadPayments(selectedTrade.id)
      loadInvoices(selectedTrade.id)
    } else {
      setPayments([])
      setInvoices([])
    }
  }, [selectedTrade])

  async function loadInvoices(tradeId: string) {
    setLoadingInvoices(true)
    try {
      const { data } = await supabase
        .from('gst_invoices')
        .select('*')
        .eq('diamond_trade_id', tradeId)
        .order('created_at', { ascending: false })
      setInvoices(data || [])
    } catch (e) {
      console.warn('Failed to load trade invoices', e)
    } finally {
      setLoadingInvoices(false)
    }
  }

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true)
    setInvoiceError('')
    try {
      const items = [{
        description: `${selectedTrade.material_type === 'diamond_lgd' ? 'Lab Grown' : 'Natural'} Diamond (${selectedTrade.diamond_shapes?.name || ''} · ${selectedTrade.diamond_sizes?.label || ''})`,
        hsn_code: invoiceForm.hsn_code || '7102',
        qty: Number(selectedTrade.carats) || 1,
        rate: Number(selectedTrade.rate_per_carat),
        amount: Number(selectedTrade.total_amount),
        unit: 'carats',
      }]

      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_type: 'diamond_trade',
          target_id: selectedTrade.id,
          tax_treatment: invoiceForm.tax_treatment,
          items,
          buyer_details: {
            buyer_name: invoiceForm.buyer_name,
            buyer_address: invoiceForm.buyer_address || null,
            buyer_gstin: invoiceForm.buyer_gstin || null,
            buyer_state: invoiceForm.buyer_state,
            partner_id: selectedTrade.partner_id,
          },
          invoice_date: invoiceForm.invoice_date,
        })
      })

      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to generate invoice')

      setGenerateInvoiceOpen(false)
      await loadInvoices(selectedTrade.id)
    } catch (e: any) {
      setInvoiceError(e.message)
    } finally {
      setGeneratingInvoice(false)
    }
  }

  async function handleCancelInvoice() {
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason.')
      return
    }

    setCancelling(true)
    setCancelError('')
    try {
      const r = await fetch(`/api/invoices/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to cancel invoice')
      
      setCancelTarget(null)
      setCancelReason('')
      await loadInvoices(selectedTrade.id)
    } catch (e: any) {
      setCancelError(e.message)
    } finally {
      setCancelling(false)
    }
  }

  async function loadPayments(tradeId: string) {
    setLoadingPayments(true)
    const { data } = await supabase
      .from('partner_trade_payments')
      .select('*')
      .eq('trade_id', tradeId)
      .order('payment_date', { ascending: false })
    setPayments(data || [])
    setLoadingPayments(false)
  }

  async function handleAddPayment() {
    setPaymentError('')
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Enter a positive payment amount.')
      return
    }
    const balance = selectedTrade.total_amount - selectedTrade.paid_amount
    if (amt > balance) {
      setPaymentError(`Payment exceeds outstanding balance of ₹${balance.toLocaleString('en-IN')}`)
      return
    }

    setSavingPayment(true)
    try {
      const r = await fetch(`/api/stock/partner-trade/${selectedTrade.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          payment_date: paymentDate,
          method: paymentMethod,
          reference: paymentRef,
          notes: paymentNotes,
        })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to record payment')

      // Reset payment form
      setPaymentAmount('')
      setPaymentRef('')
      setPaymentNotes('')
      setShowPaymentForm(false)

      // Refresh data
      await loadPayments(selectedTrade.id)
      await load() // Refresh list to update paid amount and status

      // Update local selected trade state
      setSelectedTrade(d.trade)
    } catch (e: any) {
      setPaymentError(e.message)
    } finally {
      setSavingPayment(false)
    }
  }

  const filtered = trades.filter(t => {
    const storeName = t.partners?.store_name || ''
    const ownerName = t.partners?.owner_name || ''
    const matchSearch = !search ||
      storeName.toLowerCase().includes(search.toLowerCase()) ||
      ownerName.toLowerCase().includes(search.toLowerCase())

    const matchStatus = statusFilter === 'all' || t.payment_status === statusFilter
    const matchPartner = partnerFilter === 'all' || t.partner_id === partnerFilter

    return matchSearch && matchStatus && matchPartner
  })

  // Calculations
  const stats = filtered.reduce((acc, t) => {
    if (t.trade_type === 'sale') {
      acc.totalSales += Number(t.total_amount)
      acc.totalPaid += Number(t.paid_amount)
    } else {
      acc.totalReturns += Number(t.total_amount)
    }
    return acc
  }, { totalSales: 0, totalPaid: 0, totalReturns: 0 })

  const totalDue = stats.totalSales - stats.totalPaid

  function getStatusStyle(s: string) {
    switch (s) {
      case 'paid': return 'bg-green-50 text-green-700 border border-green-200'
      case 'partially_paid': return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'unpaid': return 'bg-red-50 text-red-700 border border-red-200'
      default: return 'bg-stone-50 text-stone-700 border border-stone-200'
    }
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 relative min-h-screen">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Diamond className="w-6 h-6 text-stone-800" />
            Partner Trades
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">B2B loose diamond sales, returns, and payment collection ledger</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            Cancel
          </Link>
          <Link href="/stock/partner-trade"
            className="flex items-center gap-1.5 bg-stone-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-900">
            <Plus className="w-4 h-4" /> Record Trade
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Total B2B Sales</p>
          <p className="text-xl font-semibold mt-0.5 text-stone-900">₹{stats.totalSales.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Total Payments Received</p>
          <p className="text-xl font-semibold mt-0.5 text-green-600">₹{stats.totalPaid.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Total Outstanding Balance</p>
          <p className="text-xl font-semibold mt-0.5 text-red-600">₹{totalDue.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Total Returns</p>
          <p className="text-xl font-semibold mt-0.5 text-amber-600">₹{stats.totalReturns.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search partner store or owner..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white outline-none" />
        </div>
        <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none">
          <option value="all">All partners</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.store_name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none">
          <option value="all">All status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Trades Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-stone-400">Loading trades...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-stone-400">No trades match filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-xs text-stone-400 font-medium uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Diamond Specifications</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50 text-sm">
                {filtered.map(t => {
                  const balance = t.total_amount - t.paid_amount
                  const isReturn = t.trade_type === 'return'
                  return (
                    <tr key={t.id} onClick={() => setSelectedTrade(t)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-stone-600">{formatDate(t.trade_date)}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-stone-900">{t.partners?.store_name || '—'}</p>
                        <p className="text-xs text-stone-400">{t.partners?.owner_name || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isReturn ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                          {isReturn ? (
                            <><ArrowDownLeft className="w-3 h-3" /> Return</>
                          ) : (
                            <><ArrowUpRight className="w-3 h-3" /> Sale</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-stone-900 font-medium">
                          {t.material_type === 'diamond_lgd' ? 'Lab Diamond' : 'Natural Diamond'}
                        </p>
                        <p className="text-xs text-stone-500">
                          {t.diamond_shapes?.name || 'Shape'} · {t.diamond_sizes?.label || 'Size'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-stone-800">{t.pieces} pcs</p>
                        <p className="text-xs text-stone-400">{Number(t.carats).toFixed(3)} ct</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-stone-900">
                        ₹{Number(t.total_amount).toLocaleString('en-IN')}
                        <p className="text-[10px] text-stone-400 font-normal">@ ₹{Number(t.rate_per_carat).toLocaleString('en-IN')}/ct</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyle(t.payment_status)}`}>
                          {t.payment_status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-stone-800">
                        {isReturn ? '—' : `₹${balance.toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Trade Slide-over / Details Panel */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setSelectedTrade(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10">
            {/* Slideover Header */}
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <h2 className="font-semibold text-stone-900">Transaction Details</h2>
                <p className="text-xs text-stone-500">Recorded on {formatDate(selectedTrade.trade_date)}</p>
              </div>
              <button onClick={() => setSelectedTrade(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slideover Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Core Details Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500 font-medium">B2B Partner</span>
                  <span className="text-sm font-semibold text-stone-900">{selectedTrade.partners?.store_name}</span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500 font-medium">Trade Type</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${selectedTrade.trade_type === 'return' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {selectedTrade.trade_type === 'return' ? 'Return' : 'Sale'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500 font-medium">Material / Spec</span>
                  <span className="text-xs text-stone-800 text-right">
                    <strong>{selectedTrade.material_type === 'diamond_lgd' ? 'Lab Diamond' : 'Natural Diamond'}</strong><br/>
                    {selectedTrade.diamond_shapes?.name} · {selectedTrade.diamond_sizes?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500 font-medium">Quantity</span>
                  <span className="text-xs text-stone-800 font-medium">{selectedTrade.pieces} pcs / {Number(selectedTrade.carats).toFixed(3)} ct</span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500 font-medium">Rate per Carat</span>
                  <span className="text-xs text-stone-800 font-semibold">₹{Number(selectedTrade.rate_per_carat).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500 font-medium">Total Amount</span>
                  <span className="text-sm font-bold text-stone-800">₹{Number(selectedTrade.total_amount).toLocaleString('en-IN')}</span>
                </div>
                {selectedTrade.reference && (
                  <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                    <span className="text-xs text-stone-500 font-medium">Reference</span>
                    <span className="text-xs text-stone-700 font-mono">{selectedTrade.reference}</span>
                  </div>
                )}
                {selectedTrade.notes && (
                  <div className="border-t border-stone-100 pt-2">
                    <span className="text-xs text-stone-500 font-medium">Notes</span>
                    <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">{selectedTrade.notes}</p>
                  </div>
                )}
              </div>

              {/* Financial Balance Summary */}
              {selectedTrade.trade_type === 'sale' && (
                <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">Paid Amount</span>
                    <span className="text-sm font-semibold text-green-600">₹{Number(selectedTrade.paid_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                    <span className="text-xs text-stone-500 font-semibold">Balance Due</span>
                    <span className="text-base font-bold text-red-600">₹{(selectedTrade.total_amount - selectedTrade.paid_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* Payments Ledger Section */}
              {selectedTrade.trade_type === 'sale' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900 text-sm">Payments History</h3>
                    {selectedTrade.paid_amount < selectedTrade.total_amount && !showPaymentForm && (
                      <button onClick={() => setShowPaymentForm(true)}
                        className="text-xs text-stone-800 hover:underline flex items-center gap-1 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Log Payment
                      </button>
                    )}
                  </div>

                  {showPaymentForm && (
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-semibold text-stone-700">Record Payment</h4>
                        <button onClick={() => { setShowPaymentForm(false); setPaymentError('') }} className="text-stone-400 hover:text-stone-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={lbl}>Amount (₹) *</label>
                          <input type="number" className={inp} placeholder="Amount" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                        </div>
                        <div>
                          <label className={lbl}>Date *</label>
                          <input type="date" className={inp} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={lbl}>Method *</label>
                          <select className={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                            <option value="upi">UPI</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Reference</label>
                          <input className={inp} placeholder="UTR / Txn ID" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                        </div>
                      </div>

                      <div>
                        <label className={lbl}>Notes</label>
                        <input className={inp} placeholder="Optional notes" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                      </div>

                      {paymentError && <p className="text-xs text-red-600 font-medium">{paymentError}</p>}

                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => { setShowPaymentForm(false); setPaymentError('') }}
                          className="px-3 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900 bg-white">
                          Cancel
                        </button>
                        <button onClick={handleAddPayment} disabled={savingPayment}
                          className="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 font-medium">
                          {savingPayment ? 'Saving...' : 'Save Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  {loadingPayments ? (
                    <p className="text-xs text-stone-400">Loading payments...</p>
                  ) : payments.length === 0 ? (
                    <p className="text-xs text-stone-400 italic bg-stone-50 border border-stone-100 rounded-lg p-3 text-center">No payments recorded against this trade yet.</p>
                  ) : (
                    <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden bg-white">
                      {payments.map(p => (
                        <div key={p.id} className="p-3 text-xs flex justify-between items-start">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-stone-800">₹{Number(p.amount).toLocaleString('en-IN')}</p>
                            <p className="text-stone-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(p.payment_date)} · <span className="uppercase font-medium text-stone-500">{p.method}</span>
                            </p>
                            {p.reference && <p className="text-stone-500 font-mono text-[10px]">Ref: {p.reference}</p>}
                            {p.notes && <p className="text-stone-500 leading-normal italic mt-0.5">"{p.notes}"</p>}
                          </div>
                          <span className="text-[10px] text-stone-400 font-medium bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5">By {p.created_by}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* GST Invoices Section */}
                  <div className="space-y-3 pt-4 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-1">
                        <FileText className="w-4 h-4 text-stone-800" /> GST Tax Invoices
                      </h3>
                      {isMaster && !invoices.some(inv => inv.status === 'active') && (
                        <button onClick={() => setGenerateInvoiceOpen(true)}
                          className="text-xs text-stone-800 hover:underline flex items-center gap-1 font-medium">
                          <Plus className="w-3.5 h-3.5" /> Generate Invoice
                        </button>
                      )}
                    </div>

                    {loadingInvoices ? (
                      <p className="text-xs text-stone-400">Loading invoices...</p>
                    ) : invoices.length === 0 ? (
                      <p className="text-xs text-stone-400 italic bg-stone-50 border border-stone-100 rounded-lg p-3 text-center">No tax invoices generated for this trade yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.map((inv) => (
                          <div key={inv.id} className={`flex items-center justify-between border rounded-lg p-3 ${inv.status === 'cancelled' ? 'bg-stone-50 border-stone-100 opacity-60' : 'bg-white border-stone-200'}`}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-stone-950 truncate">{inv.invoice_number}</p>
                                {inv.status === 'cancelled' && (
                                  <span className="text-[8px] font-bold bg-red-100 text-red-700 px-1.5 py-0.2 rounded">VOID</span>
                                )}
                              </div>
                              <p className="text-[10px] text-stone-500 mt-0.5">
                                Date: {formatDate(inv.invoice_date)} · Total: ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                                className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 bg-white rounded-lg transition-colors flex items-center gap-0.5 text-[10px]">
                                <Download className="w-3 h-3" /> PDF
                              </a>
                              {inv.status === 'active' && isMaster && (
                                <button onClick={() => setCancelTarget(inv)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 bg-white rounded-lg transition-colors flex items-center gap-0.5 text-[10px]">
                                  <Trash2 className="w-3 h-3" /> Void
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {generateInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-semibold text-stone-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-stone-800" />
                Generate GST Tax Invoice
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Confirm tax details for this loose diamond trade. Default diamond GST rate is 0.25%.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Invoice Date</label>
                <input type="date" className={inp} value={invoiceForm.invoice_date}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, invoice_date: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>HSN Code</label>
                <input type="text" className={inp} value={invoiceForm.hsn_code}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, hsn_code: e.target.value }))} placeholder="7102" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Tax Treatment</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="radio" checked={invoiceForm.tax_treatment === 'inclusive'}
                      onChange={() => setInvoiceForm((p: any) => ({ ...p, tax_treatment: 'inclusive' }))} />
                    <span>Tax Inclusive</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="radio" checked={invoiceForm.tax_treatment === 'exclusive'}
                      onChange={() => setInvoiceForm((p: any) => ({ ...p, tax_treatment: 'exclusive' }))} />
                    <span>Tax Exclusive</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Buyer (Recipient) Details</h4>
              <div>
                <label className={lbl}>Buyer Name</label>
                <input type="text" className={inp} value={invoiceForm.buyer_name}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>GSTIN (Optional)</label>
                  <input type="text" className={inp} value={invoiceForm.buyer_gstin}
                    onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_gstin: e.target.value }))} placeholder="e.g. 24ABCDE1234F1Z5" />
                </div>
                <div>
                  <label className={lbl}>Buyer State</label>
                  <input type="text" className={inp} value={invoiceForm.buyer_state}
                    onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Billing Address</label>
                <textarea className={`${inp} resize-none`} rows={2} value={invoiceForm.buyer_address}
                  onChange={e => setInvoiceForm((p: any) => ({ ...p, buyer_address: e.target.value }))} />
              </div>
            </div>

            {/* Calculations Preview */}
            {(() => {
              const standardRate = 0.25
              const isSameState = invoiceForm.buyer_state?.toLowerCase().trim() === 'gujarat'
              const totalAmount = Number(selectedTrade?.total_amount) || 0
              
              let subtotalAmount = totalAmount
              let totalTax = 0
              let grandTotal = totalAmount

              if (invoiceForm.tax_treatment === 'inclusive') {
                grandTotal = totalAmount
                subtotalAmount = totalAmount / (1 + standardRate / 100)
                totalTax = grandTotal - subtotalAmount
              } else {
                subtotalAmount = totalAmount
                totalTax = subtotalAmount * (standardRate / 100)
                grandTotal = subtotalAmount + totalTax
              }

              subtotalAmount = Math.round(subtotalAmount * 100) / 100
              totalTax = Math.round(totalTax * 100) / 100
              grandTotal = Math.round(grandTotal * 100) / 100

              const taxLabel = isSameState
                ? `CGST (0.125%) + SGST (0.125%)`
                : `IGST (0.25%)`

              return (
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between text-stone-500">
                    <span>Taxable Subtotal:</span>
                    <span>₹{subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>{taxLabel}:</span>
                    <span>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-1 text-sm">
                    <span>Grand Total:</span>
                    <span className="text-stone-800">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )
            })()}

            {invoiceError && <p className="text-xs text-red-600 font-medium">{invoiceError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setGenerateInvoiceOpen(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={handleGenerateInvoice} disabled={generatingInvoice}
                className="flex-1 bg-stone-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-900 disabled:opacity-50">
                {generatingInvoice ? 'Generating...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Cancel Tax Invoice?</h3>
                <p className="text-sm text-stone-500 mt-1">
                  You are about to cancel invoice <strong>{cancelTarget.invoice_number}</strong>. This action will keep the record in the database for accounting audits but mark it as voided.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Reason for cancellation *</label>
              <textarea className={`${inp} resize-none`} rows={3} placeholder="e.g. Return of items, clerical typo, trade modified"
                value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>

            {cancelError && <p className="text-xs text-red-600 font-medium">{cancelError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(''); setCancelError('') }}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Back
              </button>
              <button onClick={handleCancelInvoice} disabled={cancelling}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
