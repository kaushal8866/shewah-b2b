'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart2, Calendar, Download, RefreshCw, AlertCircle, TrendingUp, TrendingDown, ShieldAlert
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function PnLStatementPage() {
  const { data: session } = useSession()
  const role = session?.user?.role || 'sub'
  const isMaster = role === 'master'

  const [preset, setPreset] = useState('this_month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [report, setReport] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Calculate default dates based on preset
  const applyPreset = (p: string) => {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()

    let fromStr = ''
    let toStr = today.toLocaleDateString('en-CA')

    switch (p) {
      case 'this_week': {
        const dayOfWeek = today.getDay()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - dayOfWeek)
        fromStr = startOfWeek.toLocaleDateString('en-CA')
        break
      }
      case 'this_month': {
        fromStr = new Date(y, m, 1).toLocaleDateString('en-CA')
        break
      }
      case 'last_month': {
        fromStr = new Date(y, m - 1, 1).toLocaleDateString('en-CA')
        toStr = new Date(y, m, 0).toLocaleDateString('en-CA')
        break
      }
      case 'this_quarter': {
        const qStartMonth = Math.floor(m / 3) * 3
        fromStr = new Date(y, qStartMonth, 1).toLocaleDateString('en-CA')
        break
      }
      case 'this_year': {
        fromStr = new Date(y, 0, 1).toLocaleDateString('en-CA')
        break
      }
      default:
        return // custom preserves current values
    }

    setFromDate(fromStr)
    setToDate(toStr)
  }

  // Handle preset change
  useEffect(() => {
    applyPreset(preset)
  }, [preset])

  // Run fetch P&L
  const fetchPnL = async () => {
    if (!fromDate || !toDate) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/cash/pnl?from=${fromDate}&to=${toDate}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to fetch P&L report')
      }
      const data = await res.json()
      setReport(data)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load report on date changes
  useEffect(() => {
    fetchPnL()
  }, [fromDate, toDate])

  const handleExportCSV = () => {
    if (!report) return

    const rows = [
      ['Shewah B2B Platform - Unified P&L Statement'],
      [`Period: ${formatDate(report.period.from)} to ${formatDate(report.period.to)}`],
      [],
      ['REVENUE', 'Amount (INR)'],
      ['Formal Order Completed Revenue', report.formal_order_revenue],
      ['Cash Sales Income', report.cash_sales_income],
      ['Other Income', report.other_income],
      ['TOTAL GROSS REVENUE', report.gross_revenue],
      [],
      ['DIRECT COGS', 'Amount (INR)'],
      ['Formal Order COGS', report.formal_order_cogs],
      ['Cash Raw Materials', report.cash_raw_material],
      ['Cash Manufacturing/Labour', report.cash_manufacturing],
      ['Cash Certification/Hallmarking', report.cash_certification],
      ['Cash Packaging & Logistics', report.cash_packaging_logistics],
      ['Karigar Material Returns (Deduction)', -report.karigar_material_returns],
      ['TOTAL COGS', report.total_cogs],
      [],
      ['GROSS PROFIT', report.gross_profit],
      ['GROSS MARGIN (%)', `${report.gross_margin_pct}%`],
      [],
      ['OPERATING EXPENSES (OPEX)', 'Amount (INR)'],
    ]

    Object.entries(report.opex_by_group).forEach(([group, val]) => {
      rows.push([`${group.toUpperCase()} overheads`, val as number])
    })

    rows.push(
      ['TOTAL OPEX', report.total_opex],
      [],
      ['NET PROFIT', report.net_profit],
      ['NET MARGIN (%)', `${report.net_margin_pct}%`],
      [],
      ['MEMO: NON-REVENUE CASH FLOWS', 'Amount (INR)'],
      ['Cash Advances/Collections Received', report.advance_income],
      [],
      ['AUDIT DETAILS'],
      ['Total Cash Transactions Count', report.total_cash_txns],
      ['Voided Transactions Count', report.voided_count]
    )

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `pnl_report_${fromDate}_to_${toDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Restrict screen for non-masters
  if (!isMaster) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto text-center mt-20">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 max-w-lg mx-auto space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
          <h2 className="text-xl font-bold text-stone-900">Access Restricted</h2>
          <p className="text-sm text-stone-500">
            The Profit & Loss statement and unified margin metrics are restricted to master role accounts only. Please contact your master admin.
          </p>
        </div>
      </div>
    )
  }

  const opexCategories = [
    { key: 'office', label: '🏢 Office (Rent, Bills, Supplies)' },
    { key: 'staff', label: '👤 Staff (Salary, Bonuses)' },
    { key: 'travel', label: '✈️ Travel & Conveyance' },
    { key: 'marketing', label: '📲 Marketing & Branding' },
    { key: 'tax_fee', label: '🧾 Taxes & CA Professional Fees' },
    { key: 'misc', label: '💸 Miscellaneous / Repairs' }
  ]

  const cardStyle = "bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex items-center justify-between transition-all"

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-200 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1E3A5F] to-[#2E5E8A] flex items-center justify-center text-white shadow-md">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Unified P&L Statement</h1>
            <p className="text-stone-500 text-sm mt-0.5">Consolidated formal orders + informal cash ledger statement</p>
          </div>
        </div>

        {/* Date presets & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 text-xs">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={preset}
              onChange={e => setPreset(e.target.value)}
              className="bg-transparent font-semibold text-stone-700 outline-none border-none cursor-pointer"
            >
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-stone-200 rounded-lg px-2.5 py-1 text-xs outline-none"
              />
              <span className="text-stone-400 text-xs font-semibold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-stone-200 rounded-lg px-2.5 py-1 text-xs outline-none"
              />
            </div>
          )}

          <button
            onClick={handleExportCSV}
            disabled={!report}
            className="flex items-center gap-1.5 bg-[#1E3A5F] text-white hover:bg-[#162B47] px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && !report ? (
        <div className="p-12 text-center text-stone-400 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-700 mx-auto mb-4"></div>
          <span>Generating report payload...</span>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Revenue Card */}
            <div className={cardStyle}>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Gross Revenue</p>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{formatCurrency(report.gross_revenue)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Total COGS Card */}
            <div className={cardStyle}>
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total COGS</p>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{formatCurrency(report.total_cogs)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            {/* Net Profit Card */}
            <div className={cn(
              cardStyle,
              report.net_profit >= 0 ? "bg-emerald-50/45 border-emerald-150" : "bg-rose-50/45 border-rose-150"
            )}>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Net Profit (Unified)</p>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{formatCurrency(report.net_profit)}</h3>
                <span className={cn(
                  "text-xs font-semibold mt-1 inline-block px-1.5 py-0.5 rounded-md",
                  report.net_profit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                )}>
                  Margin: {report.net_margin_pct}%
                </span>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shadow-xs text-white",
                report.net_profit >= 0 ? "bg-emerald-600" : "bg-rose-600"
              )}>
                {report.net_profit >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              </div>
            </div>
          </div>

          {/* Detailed Statement Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Revenue & COGS */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Trading Profitability (COGS)</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Revenue breakdown */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Revenue</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Formal Completed Revenue</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.formal_order_revenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Cash Book Sales Income</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.cash_sales_income)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Other Cash Incomes</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.other_income)}</span>
                    </div>
                    <div className="border-t border-stone-100 pt-2 flex justify-between text-sm font-bold text-stone-800">
                      <span>Total Gross Revenue</span>
                      <span>{formatCurrency(report.gross_revenue)}</span>
                    </div>
                  </div>
                </div>

                {/* COGS breakdown */}
                <div className="space-y-3 border-t border-stone-100 pt-6">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Direct Costs (COGS)</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Formal Order COGS</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.formal_order_cogs)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Cash Raw Materials (Gold, Diamond, Findings)</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.cash_raw_material)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Cash Manufacturing & Karigar Labour</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.cash_manufacturing)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Cash Certification & BIS Hallmarking</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.cash_certification)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Cash Packaging & Freight Logistics</span>
                      <span className="font-medium text-stone-850">{formatCurrency(report.cash_packaging_logistics)}</span>
                    </div>
                    {report.karigar_material_returns > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 font-semibold bg-emerald-50/50 p-2 rounded-lg">
                        <span>Less: Karigar Material Returns</span>
                        <span>- {formatCurrency(report.karigar_material_returns)}</span>
                      </div>
                    )}
                    <div className="border-t border-stone-100 pt-2 flex justify-between text-sm font-bold text-stone-800">
                      <span>Total COGS</span>
                      <span>{formatCurrency(report.total_cogs)}</span>
                    </div>
                  </div>
                </div>

                {/* Gross margin result */}
                <div className="bg-stone-50 rounded-xl p-4 flex justify-between items-center border border-stone-150">
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Gross Profit</p>
                    <p className="text-lg font-bold text-stone-900 mt-0.5">{formatCurrency(report.gross_profit)}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                    Margin: {report.gross_margin_pct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Right: OPEX & Advances */}
            <div className="space-y-6">
              {/* Operating Expenses Card */}
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                  <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Operating Expenses (OPEX)</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    {opexCategories.map(cat => {
                      const val = report.opex_by_group[cat.key] || 0
                      return (
                        <div key={cat.key} className="flex justify-between text-sm text-stone-600">
                          <span>{cat.label}</span>
                          <span className="font-medium text-stone-850">{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="border-t border-stone-100 pt-2 flex justify-between text-sm font-bold text-stone-800">
                      <span>Total OPEX</span>
                      <span>{formatCurrency(report.total_opex)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advances and Audit Log Card */}
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                  <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Memo: Cash Flows & Audits</h2>
                </div>
                <div className="p-6 space-y-4 text-sm text-stone-600">
                  <div className="flex justify-between items-center bg-stone-50 p-3 rounded-lg border border-stone-150">
                    <div>
                      <span className="font-semibold text-stone-800 block">Cash Advances Collected</span>
                      <span className="text-[11px] text-stone-400">Advances received for active orders (Excluded from Revenue)</span>
                    </div>
                    <span className="font-bold text-stone-900">{formatCurrency(report.advance_income)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 text-xs">
                    <div>
                      <span className="text-stone-400 font-medium">Total Cash Transactions</span>
                      <p className="text-base font-bold text-stone-800 mt-0.5">{report.total_cash_txns}</p>
                    </div>
                    <div>
                      <span className="text-stone-400 font-medium">Voided Transactions</span>
                      <p className="text-base font-bold text-stone-800 mt-0.5">{report.voided_count}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
