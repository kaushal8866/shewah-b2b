'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Filter } from 'lucide-react'

type Movement = {
  id: string
  movement_type: string
  material_type: string
  item_label: string | null
  unit: string
  quantity: number
  reference: string | null
  notes: string | null
  movement_date: string
  vendors: { id: string; name: string } | null
  manufacturing_partners: { id: string; name: string } | null
}

const TYPE_LABEL: Record<string, { label: string; tone: string; sign: '+' | '-' }> = {
  purchase:        { label: 'Purchase',          tone: 'bg-emerald-50 text-emerald-700', sign: '+' },
  issue:           { label: 'Issued to karigar', tone: 'bg-blue-50 text-blue-700',       sign: '-' },
  return_in:       { label: 'Returned',          tone: 'bg-emerald-50 text-emerald-700', sign: '+' },
  adjustment_in:   { label: 'Adjustment +',      tone: 'bg-stone-100 text-stone-700',    sign: '+' },
  adjustment_out:  { label: 'Adjustment -',      tone: 'bg-stone-100 text-stone-700',    sign: '-' },
}

const MATERIAL_LABEL: Record<string, string> = {
  gold_14k: 'Gold 14K', gold_18k: 'Gold 18K', gold_22k: 'Gold 22K',
  diamond_lgd: 'Lab Diamond', diamond_natural: 'Natural Diamond', finding: 'Finding',
}

function fmtUnit(u: string) { return u === 'grams' ? 'g' : u === 'carats' ? 'ct' : u }

export default function StockMovementsPage() {
  const [rows, setRows] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [material, setMaterial] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const url = new URL('/api/stock/movements', window.location.origin)
      if (material) url.searchParams.set('material_type', material)
      const r = await fetch(url.toString())
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setRows(d.movements || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [material])

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/stock" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Stock movements</h1>
          <p className="text-stone-500 text-sm mt-0.5">Every movement, newest first</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 items-center">
        <Filter className="w-4 h-4 text-stone-400" />
        <select className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          value={material} onChange={e => setMaterial(e.target.value)}>
          <option value="">All materials</option>
          {Object.entries(MATERIAL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-stone-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <p className="text-stone-400 text-sm">No movements recorded yet.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2 bg-stone-50 border-b border-stone-100 text-xs text-stone-400 font-medium">
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Material</div>
            <div className="col-span-2">Counterparty</div>
            <div className="col-span-2 text-right">Quantity</div>
            <div className="col-span-1">Ref</div>
          </div>
          <div className="divide-y divide-stone-50">
            {rows.map(r => {
              const meta = TYPE_LABEL[r.movement_type] || { label: r.movement_type, tone: 'bg-stone-100 text-stone-700', sign: '' }
              const counterparty = r.vendors?.name || r.manufacturing_partners?.name || '—'
              return (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center">
                  <div className="col-span-12 lg:col-span-2 text-stone-500 text-xs lg:text-sm">
                    {new Date(r.movement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </div>
                  <div className="col-span-6 lg:col-span-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${meta.tone}`}>{meta.label}</span>
                  </div>
                  <div className="col-span-6 lg:col-span-3 text-stone-700">
                    {MATERIAL_LABEL[r.material_type] || r.material_type}
                    {r.item_label && <span className="text-stone-400"> — {r.item_label}</span>}
                  </div>
                  <div className="col-span-6 lg:col-span-2 text-stone-500 text-xs lg:text-sm truncate">
                    {counterparty}
                  </div>
                  <div className="col-span-3 lg:col-span-2 text-right font-semibold tabular-nums">
                    <span className={meta.sign === '-' ? 'text-blue-600' : 'text-emerald-600'}>
                      {meta.sign}{r.quantity} {fmtUnit(r.unit)}
                    </span>
                  </div>
                  <div className="col-span-3 lg:col-span-1 text-xs text-stone-400 truncate">
                    {r.reference || ''}
                  </div>
                  {r.notes && (
                    <div className="col-span-12 text-xs text-stone-400 -mt-1">↳ {r.notes}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
