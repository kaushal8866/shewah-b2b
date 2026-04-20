'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, AlertTriangle } from 'lucide-react'

type Balance = {
  material_type: string
  item_label: string
  unit: string
  balance: number
  last_movement_date: string | null
}

const MATERIAL_LABELS: Record<string, string> = {
  gold_14k: 'Gold 14K',
  gold_18k: 'Gold 18K',
  gold_22k: 'Gold 22K',
  diamond_lgd: 'Lab Diamond',
  diamond_natural: 'Natural Diamond',
  finding: 'Finding',
}

const GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: 'gold',    label: 'Gold',     types: ['gold_14k', 'gold_18k', 'gold_22k'] },
  { key: 'diamond', label: 'Diamonds', types: ['diamond_lgd', 'diamond_natural'] },
  { key: 'finding', label: 'Findings', types: ['finding'] },
]

function fmtUnit(u: string) {
  if (u === 'grams') return 'g'
  if (u === 'carats') return 'ct'
  return u
}

export default function StockPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/stock/balances')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setBalances(d.balances || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const m = new Map<string, Balance[]>()
    for (const b of balances) {
      const g = GROUPS.find(x => x.types.includes(b.material_type))?.key || 'other'
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(b)
    }
    return m
  }, [balances])

  const totals = useMemo(() => {
    const goldG = balances.filter(b => b.material_type.startsWith('gold')).reduce((s, b) => s + b.balance, 0)
    const diaC = balances.filter(b => b.material_type.startsWith('diamond')).reduce((s, b) => s + b.balance, 0)
    const negatives = balances.filter(b => b.balance < 0).length
    return { goldG, diaC, negatives }
  }, [balances])

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#1E3A5F]" />
            Stock
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">Live central inventory — every gram in or out</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/movements"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <ClipboardList className="w-4 h-4" /> History
          </Link>
          <Link href="/stock/receive"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <ArrowDownToLine className="w-4 h-4" /> Receive
          </Link>
          <Link href="/stock/issue"
            className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47]">
            <ArrowUpFromLine className="w-4 h-4" /> Issue to karigar
          </Link>
        </div>
      </div>

      {totals.negatives > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{totals.negatives} material(s) show a negative balance</p>
            <p className="text-xs text-red-600 mt-0.5">
              That means more was issued than received. Record the missing purchase or adjust the ledger.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Gold on hand</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{totals.goldG.toFixed(3)} g</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Diamonds on hand</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{totals.diaC.toFixed(3)} ct</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs text-stone-400">Distinct items</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{balances.length}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-stone-400">Loading balances...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && balances.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <Boxes className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">No stock movements yet.</p>
          <p className="text-xs text-stone-400 mt-1">Record a purchase from a vendor to start the ledger.</p>
          <Link href="/stock/receive" className="inline-block mt-3 text-sm text-[#1E3A5F] hover:underline">
            Record a purchase →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {GROUPS.map(g => {
          const rows = grouped.get(g.key) || []
          if (rows.length === 0) return null
          return (
            <div key={g.key} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-stone-700">{g.label}</h2>
                <p className="text-xs text-stone-400">{rows.length} item(s)</p>
              </div>
              <div className="divide-y divide-stone-50">
                {rows.map((b, i) => {
                  const negative = b.balance < 0
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900">
                          {MATERIAL_LABELS[b.material_type] || b.material_type}
                          {b.item_label && <span className="text-stone-500 font-normal"> — {b.item_label}</span>}
                        </p>
                        {b.last_movement_date && (
                          <p className="text-xs text-stone-400 mt-0.5">
                            Last move: {new Date(b.last_movement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className={`text-right shrink-0 ${negative ? 'text-red-500' : 'text-stone-900'}`}>
                        <p className="text-sm font-semibold">{b.balance.toFixed(3)} {fmtUnit(b.unit)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
