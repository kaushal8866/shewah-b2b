'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, AlertTriangle, Diamond } from 'lucide-react'

type Balance = {
  material_type: string
  item_label: string
  unit: string
  balance: number
  last_movement_date: string | null
}

type DiamondGroup = {
  material_type: string
  diamond_shape_id: string | null
  diamond_size_id: string | null
  shape_name: string | null
  size_label: string | null
  carats: number
  pieces: number
  reorder_threshold_pieces: number | null
}

const MATERIAL_LABELS: Record<string, string> = {
  gold_24k: 'Gold (24kt net)',
  diamond_lgd: 'Lab Diamond',
  diamond_natural: 'Natural Diamond',
  finding: 'Finding',
}

const GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: 'gold',    label: 'Gold (24kt net)', types: ['gold_24k'] },
  { key: 'diamond', label: 'Diamonds',        types: ['diamond_lgd', 'diamond_natural'] },
  { key: 'finding', label: 'Findings',        types: ['finding'] },
]

function fmtUnit(u: string) {
  if (u === 'grams') return 'g'
  if (u === 'carats') return 'ct'
  return u
}

export default function StockPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [diaGroups, setDiaGroups] = useState<DiamondGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [r, rd] = await Promise.all([
        fetch('/api/stock/balances'),
        fetch('/api/diamonds/stock'),
      ])
      const d = await r.json()
      const dd = await rd.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setBalances(d.balances || [])
      setDiaGroups(dd.groups || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // Diamond rows are rendered from the catalog view, not from `balances`,
  // because the same material_type can fan out into many shape×size groups.
  const diaLowCount = useMemo(
    () => diaGroups.filter(g => g.reorder_threshold_pieces != null && g.pieces <= g.reorder_threshold_pieces).length,
    [diaGroups],
  )

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
    const diaC = diaGroups.reduce((s, g) => s + g.carats, 0)
    const diaPcs = diaGroups.reduce((s, g) => s + g.pieces, 0)
    const negatives = balances.filter(b => b.balance < 0).length
    return { goldG, diaC, diaPcs, negatives }
  }, [balances, diaGroups])

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-stone-800" />
            Stock
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">Live central inventory — every gram in or out</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/partner-trades"
            className="flex items-center gap-1.5 border border-stone-800 text-stone-800 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <Diamond className="w-4 h-4" /> Partner Trades
          </Link>
          <Link href="/stock/movements"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <ClipboardList className="w-4 h-4" /> History
          </Link>
          <Link href="/stock/receive"
            className="flex items-center gap-1.5 border border-stone-200 bg-white text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <ArrowDownToLine className="w-4 h-4" /> Receive
          </Link>
          <Link href="/stock/issue"
            className="flex items-center gap-1.5 bg-stone-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-stone-900">
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
        <Link href="/diamonds/catalog" className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-800 transition-colors">
          <p className="text-xs text-stone-400 flex items-center gap-1"><Diamond className="w-3 h-3" /> Diamonds on hand</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{totals.diaC.toFixed(3)} ct</p>
          <p className="text-[11px] text-stone-400 mt-0.5">{totals.diaPcs} pcs · {diaGroups.length} groups{diaLowCount > 0 && <> · <span className="text-amber-600 font-medium">{diaLowCount} low</span></>}</p>
        </Link>
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
          <Link href="/stock/receive" className="inline-block mt-3 text-sm text-stone-800 hover:underline">
            Record a purchase →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {diaGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700 flex items-center gap-2">
                <Diamond className="w-4 h-4 text-stone-800" /> Diamonds by shape × size
              </h2>
              <Link href="/diamonds/catalog" className="text-xs text-stone-800 hover:underline">Manage catalog →</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {diaGroups.map((g, i) => {
                const low = g.reorder_threshold_pieces != null && g.pieces <= g.reorder_threshold_pieces
                const negative = g.carats < 0 || g.pieces < 0
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${low ? 'bg-amber-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900">
                        {MATERIAL_LABELS[g.material_type] || g.material_type}
                        <span className="text-stone-500 font-normal"> — {g.shape_name || 'Unspecified shape'} · {g.size_label || 'Unspecified size'}</span>
                        {low && <span className="ml-2 text-[10px] bg-amber-200 text-amber-800 rounded px-1.5 py-0.5 font-medium">LOW</span>}
                      </p>
                      {g.reorder_threshold_pieces != null && (
                        <p className="text-[11px] text-stone-400 mt-0.5">Reorder when ≤ {g.reorder_threshold_pieces} pcs</p>
                      )}
                    </div>
                    <div className={`text-right shrink-0 ${negative ? 'text-red-500' : 'text-stone-900'}`}>
                      <p className="text-sm font-semibold">{g.pieces} pcs</p>
                      <p className="text-xs text-stone-400">{g.carats.toFixed(3)} ct</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {GROUPS.filter(g => g.key !== 'diamond').map(g => {
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
