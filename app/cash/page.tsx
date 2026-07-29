'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Wallet, Plus, AlertCircle, Calendar, ArrowUpRight, ArrowDownLeft,
  Search, Filter, X, ChevronLeft, ChevronRight, Ban, CheckCircle2
} from 'lucide-react'
import {
  CASH_CATEGORIES,
  getCategoryMeta,
  getCategoriesByType,
  PINNED_INCOME_CATEGORIES,
  PINNED_EXPENSE_CATEGORIES
} from '@/lib/cashCategories'
import { formatDate, formatCurrency, cn } from '@/lib/utils'

export default function CashBookPage() {
  const { data: session } = useSession()
  const role = session?.user?.role || 'sub'
  const isMaster = role === 'master'

  // Form State
  const [txnType, setTxnType] = useState<'income' | 'expense'>('income')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [note, setNote] = useState('')
  const [partyName, setPartyName] = useState('')
  const [linkedOrderId, setLinkedOrderId] = useState('')
  const [linkedPartnerId, setLinkedPartnerId] = useState('')
  const [txnDate, setTxnDate] = useState('')

  // Form Metadata/Lists
  const [partnersList, setPartnersList] = useState<any[]>([])
  const [ordersList, setOrdersList] = useState<any[]>([])

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Recent Transactions State
  const [txns, setTxns] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingTxns, setLoadingTxns] = useState(false)

  // Filters State
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Void Modal State
  const [voidingTxn, setVoidingTxn] = useState<any | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  // Set default date to today
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
    setTxnDate(todayStr)
  }, [])

  // Load partners and orders for linking
  useEffect(() => {
    async function fetchReferences() {
      try {
        const resPartners = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'partners',
            op: 'select',
            select: 'id, name, city'
          })
        })
        if (resPartners.ok) {
          const d = await resPartners.ok ? await resPartners.json() : {}
          setPartnersList(d.data || [])
        }

        const resOrders = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'orders',
            op: 'select',
            select: 'id, order_number, total_amount'
          })
        })
        if (resOrders.ok) {
          const d = await resOrders.ok ? await resOrders.json() : {}
          setOrdersList(d.data || [])
        }
      } catch (err) {
        console.error('Error fetching references', err)
      }
    }
    fetchReferences()
  }, [])

  // Load recent transactions with filters & pagination
  const loadTransactions = async () => {
    setLoadingTxns(true)
    setErrorMsg('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      })
      if (filterType) params.append('txn_type', filterType)
      if (filterCategory) params.append('category', filterCategory)
      if (filterFrom) params.append('from', filterFrom)
      if (filterTo) params.append('to', filterTo)
      if (search) params.append('search', search)

      const res = await fetch(`/api/cash?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch transactions')
      }
      const result = await res.json()
      setTxns(result.data || [])
      setTotalCount(result.count || 0)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoadingTxns(false)
    }
  }

  // Reload transactions when filters or page changes
  useEffect(() => {
    loadTransactions()
  }, [page, filterType, filterCategory, filterFrom, filterTo, search])

  // Select default category when txnType changes
  useEffect(() => {
    const list = getCategoriesByType(txnType)
    if (list.length > 0) {
      setCategory(list[0].key)
    }
  }, [txnType])

  const handleSave = async (addAnother: boolean) => {
    setErrorMsg('')
    setSuccessMsg('')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0')
      return
    }
    if (!category) {
      setErrorMsg('Please select a category')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txn_date: txnDate,
          txn_type: txnType,
          category,
          amount: amt,
          payment_mode: paymentMode,
          note: note.trim(),
          party_name: partyName.trim(),
          linked_order_id: linkedOrderId || null,
          linked_partner_id: linkedPartnerId || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save transaction')
      }

      setSuccessMsg('Transaction saved successfully!')
      loadTransactions()

      // Reset logic
      if (addAnother) {
        setAmount('')
        setNote('')
        // Retain txnType, txnDate, paymentMode, category, and optionally partyName/links
      } else {
        setAmount('')
        setNote('')
        setPartyName('')
        setLinkedOrderId('')
        setLinkedPartnerId('')
        const todayStr = new Date().toLocaleDateString('en-CA')
        setTxnDate(todayStr)
        setPaymentMode('cash')
        const list = getCategoriesByType(txnType)
        if (list.length > 0) setCategory(list[0].key)
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoidSubmit = async () => {
    if (!voidReason.trim()) {
      alert('Void reason is required')
      return
    }
    setVoiding(true)
    try {
      const res = await fetch(`/api/cash/${voidingTxn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason.trim() }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to void transaction')
      }
      setVoidingTxn(null)
      setVoidReason('')
      loadTransactions()
      alert('Transaction voided successfully!')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setVoiding(false)
    }
  }

  const categoriesOfCurrentType = getCategoriesByType(txnType)
  const pinnedIds = txnType === 'income' ? PINNED_INCOME_CATEGORIES : PINNED_EXPENSE_CATEGORIES

  const inputStyle = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 focus:ring-1 focus:ring-stone-800 outline-none transition-all"
  const labelStyle = "block text-xs font-semibold text-stone-600 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-stone-800 to-stone-700 flex items-center justify-center text-white shadow-md">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Cash Book</h1>
            <p className="text-stone-500 text-sm mt-0.5">Record informal/cash flows and maintain ledger integrity</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Form + Quick Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Quick Entry Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 border-b border-stone-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Quick Transaction Entry</h2>
            <div className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
              <button
                type="button"
                onClick={() => setTxnType('income')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1",
                  txnType === 'income'
                    ? "bg-white text-emerald-700 shadow-sm border border-stone-200"
                    : "text-stone-500 hover:text-stone-800"
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Income
              </button>
              <button
                type="button"
                onClick={() => setTxnType('expense')}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1",
                  txnType === 'expense'
                    ? "bg-white text-rose-700 shadow-sm border border-stone-200"
                    : "text-stone-500 hover:text-stone-800"
                )}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Expense
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Pinned Shortcut Chips */}
            <div>
              <label className={labelStyle}>Quick Select Category</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {categoriesOfCurrentType
                  .filter(c => pinnedIds.includes(c.key))
                  .map(c => {
                    const isSelected = category === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shadow-sm",
                          isSelected
                            ? txnType === 'income'
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-200"
                              : "bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200"
                            : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        <span>{c.emoji}</span>
                        <span>{c.label}</span>
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* Full Category Select */}
            <div>
              <label className={labelStyle}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputStyle}
              >
                {categoriesOfCurrentType.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount input */}
            <div>
              <label className={labelStyle}>Amount (₹) *</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="text-stone-400 font-medium text-lg">₹</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputStyle, "pl-8 text-lg font-semibold")}
                  required
                />
              </div>
            </div>

            {/* Advanced / Optional Fields */}
            <div className="border-t border-stone-100 pt-6">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Secondary details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className={labelStyle}>Transaction Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={txnDate}
                      onChange={e => setTxnDate(e.target.value)}
                      max={new Date().toLocaleDateString('en-CA')}
                      className={inputStyle}
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className={labelStyle}>Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className={inputStyle}
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="upi">📲 UPI</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="cheque">📝 Cheque</option>
                    <option value="other">➕ Other</option>
                  </select>
                </div>

                {/* Party Name */}
                <div>
                  <label className={labelStyle}>Party Name (e.g. Karigar, Vendor, Retailer)</label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={e => setPartyName(e.target.value)}
                    placeholder="Enter name"
                    className={inputStyle}
                  />
                </div>

                {/* Note */}
                <div>
                  <label className={labelStyle}>Note / Description</label>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Enter short details"
                    className={inputStyle}
                  />
                </div>

                {/* Linked Partner */}
                <div>
                  <label className={labelStyle}>Link Partner (Optional)</label>
                  <select
                    value={linkedPartnerId}
                    onChange={e => setLinkedPartnerId(e.target.value)}
                    className={inputStyle}
                  >
                    <option value="">-- None --</option>
                    {partnersList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.city})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Linked Order */}
                <div>
                  <label className={labelStyle}>Link Order (Optional)</label>
                  <select
                    value={linkedOrderId}
                    onChange={e => setLinkedOrderId(e.target.value)}
                    className={inputStyle}
                  >
                    <option value="">-- None --</option>
                    {ordersList.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} (₹{o.total_amount?.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-100 justify-end">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={submitting || !amount}
                className="px-5 py-2.5 rounded-lg border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 font-medium text-sm disabled:opacity-55 transition-colors"
              >
                Save & Add Another
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={submitting || !amount}
                className="px-5 py-2.5 rounded-lg text-white bg-stone-800 hover:bg-stone-900 font-medium text-sm disabled:opacity-55 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Help Card */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-850 rounded-2xl p-6 text-white border border-stone-800 shadow-xl space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Ledger Integrity</h2>
          <div className="space-y-3.5 text-stone-300 text-sm">
            <p>
              This module operates as a separate cash-flow ledger representing informal or outside-GST transactions.
            </p>
            <p>
              Expenses categorized under **COGS** (e.g. Karigar Labour, Gold Purchase) will reduce Gross Margins. General overheads like Rent and Salary affect **Net Margin** only.
            </p>
            <div className="border-t border-stone-800 pt-3">
              <p className="font-semibold text-white mb-1">Key rules:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-stone-400">
                <li>Date cannot be set to a future date.</li>
                <li>Advances are excluded from gross revenue.</li>
                <li>Void actions are restricted to master roles.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Transactions Log */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* List Header & Filters */}
        <div className="p-6 border-b border-stone-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-stone-900">Transaction History</h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter Tabs */}
              <div className="flex border border-stone-200 rounded-lg p-0.5 bg-stone-50">
                <button
                  onClick={() => { setFilterType(''); setPage(1); }}
                  className={cn("px-2.5 py-1 text-xs font-semibold rounded-md", !filterType ? "bg-white text-stone-950 shadow-xs border border-stone-200" : "text-stone-500")}
                >
                  All
                </button>
                <button
                  onClick={() => { setFilterType('income'); setPage(1); }}
                  className={cn("px-2.5 py-1 text-xs font-semibold rounded-md", filterType === 'income' ? "bg-white text-emerald-800 shadow-xs border border-stone-200" : "text-stone-500")}
                >
                  Incomes
                </button>
                <button
                  onClick={() => { setFilterType('expense'); setPage(1); }}
                  className={cn("px-2.5 py-1 text-xs font-semibold rounded-md", filterType === 'expense' ? "bg-white text-rose-800 shadow-xs border border-stone-200" : "text-stone-500")}
                >
                  Expenses
                </button>
              </div>
            </div>
          </div>

          {/* Filtering Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search className="w-3.5 h-3.5 text-stone-400" />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className={cn(inputStyle, "pl-7.5")}
              />
            </div>

            {/* Category Select */}
            <div>
              <select
                value={filterCategory}
                onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                className={inputStyle}
              >
                <option value="">All Categories</option>
                {CASH_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From date */}
            <div className="relative">
              <input
                type="date"
                value={filterFrom}
                onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
                className={inputStyle}
                placeholder="From Date"
              />
            </div>

            {/* To date */}
            <div className="relative">
              <input
                type="date"
                value={filterTo}
                onChange={e => { setFilterTo(e.target.value); setPage(1); }}
                className={inputStyle}
                placeholder="To Date"
              />
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                setSearch('')
                setFilterType('')
                setFilterCategory('')
                setFilterFrom('')
                setFilterTo('')
                setPage(1)
              }}
              className="px-4 py-2 text-stone-600 hover:text-stone-850 hover:bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          {loadingTxns ? (
            <div className="p-12 text-center text-stone-400 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-700 mx-auto mb-4"></div>
              <span>Fetching transactions...</span>
            </div>
          ) : txns.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-sm">
              <span>No transactions found</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Txn #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Party</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Note</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {txns.map(t => {
                  const meta = getCategoryMeta(t.category)
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        "hover:bg-stone-50 transition-colors",
                        t.is_void && "bg-stone-50 text-stone-400 line-through opacity-70"
                      )}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-xs text-stone-600">
                        {t.txn_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-stone-600">
                        {formatDate(t.txn_date)}
                      </td>
                      <td className="px-6 py-4">
                        {t.is_void ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-200 text-stone-700">
                            Voided
                          </span>
                        ) : t.txn_type === 'income' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            Income
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-100">
                            <ArrowDownLeft className="w-3 h-3 mr-0.5" />
                            Expense
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-stone-800">
                        <span className="mr-1">{meta?.emoji}</span>
                        {meta?.label || t.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-stone-700 font-medium">
                        {t.party_name || '—'}
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold whitespace-nowrap",
                        t.is_void ? "text-stone-400" : t.txn_type === 'income' ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {t.txn_type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-stone-600" title={t.note}>
                        {t.note || '—'}
                        {t.is_void && t.void_reason && (
                          <div className="text-[11px] text-stone-500 font-semibold mt-0.5">
                            Reason: {t.void_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-stone-600">
                        {isMaster && !t.is_void && (
                          <button
                            onClick={() => { setVoidingTxn(t); setVoidReason(''); }}
                            className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all"
                            title="Void transaction"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalCount > 50 && (
          <div className="p-4 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              Showing {(page - 1) * 50 + 1} - {Math.min(page * 50, totalCount)} of {totalCount}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="p-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page * 50 >= totalCount}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidingTxn && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Ban className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-stone-900">Void Transaction</h3>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed">
              Are you sure you want to void transaction <span className="font-semibold text-stone-800">{voidingTxn.txn_number}</span> (₹{voidingTxn.amount.toLocaleString()})?
              This action is irreversible and will remove the item from all margin and P&L calculations.
            </p>
            <div>
              <label className={labelStyle}>Reason for voiding *</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate entry, incorrect amount"
                className={cn(inputStyle, "h-24 resize-none")}
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVoidingTxn(null)}
                className="px-4 py-2 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={voiding || !voidReason.trim()}
                onClick={handleVoidSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {voiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
