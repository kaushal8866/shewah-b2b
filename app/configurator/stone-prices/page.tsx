'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Diamond, Plus, Trash2, AlertTriangle, Percent, Loader2, Check, X, Wand2,
} from 'lucide-react'

type Bucket = { id: string; label: string; sort_order: number; active: boolean }
type Shape  = { id: string; name: string; sort_order: number; active: boolean }
type Size   = { id: string; shape_id: string; label: string; approx_carats: number | null; sort_order: number; active: boolean }
type Cell   = {
  id: string
  shape_id: string
  size_id: string
  quality_bucket_id: string
  color_bucket_id: string
  type: string
  price_per_piece: number
  updated_by: string | null
  updated_at: string
}

// Build "shape_id|size_id|qb_id|cb_id|type" cell key.
const k = (shapeId: string, sizeId: string, qbId: string, cbId: string, type = 'lgd') =>
  `${shapeId}|${sizeId}|${qbId}|${cbId}|${type}`

export default function ConfiguratorStonePricesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isMaster = session?.user?.role === 'master'

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/login'); return }
    if (!isMaster) { router.replace('/') }
  }, [status, session, isMaster, router])

  const [shapes, setShapes] = useState<Shape[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [qualities, setQualities] = useState<Bucket[]>([])
  const [colors, setColors] = useState<Bucket[]>([])
  const [cellsByKey, setCellsByKey] = useState<Record<string, Cell>>({})
  const [migrationPending, setMigrationPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const [edits, setEdits] = useState<Record<string, string>>({})

  // Bulk-percent adjuster
  const [bulkPct, setBulkPct] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  // Bulk-fill-blanks modal state
  const [fillOpen, setFillOpen] = useState(false)
  const [fillQuality, setFillQuality] = useState('')
  const [fillColor, setFillColor] = useState('')
  const [fillRate, setFillRate] = useState('')
  const [fillShape, setFillShape] = useState('')        // '' = all shapes
  const [fillOverwrite, setFillOverwrite] = useState(false)
  const [fillBusy, setFillBusy] = useState(false)
  const [fillMsg, setFillMsg] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [s, z, q, c, m] = await Promise.all([
        fetch('/api/diamonds/shapes').then(r => r.json()),
        fetch('/api/diamonds/sizes').then(r => r.json()),
        fetch('/api/diamonds/quality-buckets').then(r => r.json()),
        fetch('/api/diamonds/color-buckets').then(r => r.json()),
        fetch('/api/configurator/stone-prices').then(r => r.json()),
      ])
      setShapes((s.shapes || []).filter((x: Shape) => x.active))
      setSizes((z.sizes || []).filter((x: Size) => x.active))
      setQualities(q.buckets || [])
      setColors(c.buckets || [])
      const map: Record<string, Cell> = {}
      for (const cell of (m.cells || []) as Cell[]) {
        map[k(cell.shape_id, cell.size_id, cell.quality_bucket_id, cell.color_bucket_id, cell.type)] = cell
      }
      setCellsByKey(map)
      setMigrationPending(!!(q.migration_pending || c.migration_pending || m.migration_pending))
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function addBucket(kind: 'quality' | 'color', label: string) {
    const trimmed = label.trim()
    if (!trimmed) return
    const url = kind === 'quality' ? '/api/diamonds/quality-buckets' : '/api/diamonds/color-buckets'
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: trimmed }) })
    const j = await r.json()
    if (!r.ok) { setError(j.error || 'Failed to add'); return }
    if (kind === 'quality') setQualities(prev => [...prev, j.bucket].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)))
    else setColors(prev => [...prev, j.bucket].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)))
  }

  async function removeBucket(kind: 'quality' | 'color', id: string) {
    if (!confirm('Remove this bucket? Any matrix cells using it will also be deleted.')) return
    const url = kind === 'quality' ? `/api/diamonds/quality-buckets/${id}` : `/api/diamonds/color-buckets/${id}`
    const r = await fetch(url, { method: 'DELETE' })
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error || 'Failed to delete'); return }
    load()
  }

  async function saveCell(shapeId: string, sizeId: string, qbId: string, cbId: string, raw: string) {
    const key = k(shapeId, sizeId, qbId, cbId)
    const value = raw.trim() === '' ? 0 : Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      setSavingKey(prev => ({ ...prev, [key]: 'error' }))
      return
    }
    setSavingKey(prev => ({ ...prev, [key]: 'saving' }))
    const r = await fetch('/api/configurator/stone-prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shape_id: shapeId, size_id: sizeId,
        quality_bucket_id: qbId, color_bucket_id: cbId,
        type: 'lgd',
        price_per_piece: value,
      }),
    })
    if (!r.ok) {
      setSavingKey(prev => ({ ...prev, [key]: 'error' }))
      return
    }
    const j = await r.json()
    setCellsByKey(prev => {
      const next = { ...prev }
      if (j.cleared) delete next[key]
      else if (j.cell) next[key] = j.cell
      return next
    })
    setEdits(prev => { const n = { ...prev }; delete n[key]; return n })
    setSavingKey(prev => ({ ...prev, [key]: 'saved' }))
    setTimeout(() => setSavingKey(prev => {
      if (prev[key] !== 'saved') return prev
      const n = { ...prev }; delete n[key]; return n
    }), 1200)
  }

  async function applyBulkFill() {
    const rate = Number(fillRate)
    if (!fillQuality || !fillColor) { setFillMsg('Pick a quality and color bucket.'); return }
    if (!Number.isFinite(rate) || rate <= 0) { setFillMsg('Enter a positive ₹/ct rate.'); return }
    if (fillOverwrite) {
      const scope = fillShape ? (shapes.find(s => s.id === fillShape)?.name || 'this shape') : 'every shape'
      if (!confirm(`Overwrite existing prices for ${scope} in this quality × color combo? Hand-tuned values will be replaced.`)) return
    }
    setFillBusy(true); setFillMsg('')
    const r = await fetch('/api/configurator/stone-prices/bulk-fill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quality_bucket_id: fillQuality,
        color_bucket_id: fillColor,
        type: 'lgd',
        rate_per_carat: rate,
        shape_id: fillShape || undefined,
        overwrite: fillOverwrite,
      }),
    })
    setFillBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setFillMsg(j.error || 'Bulk fill failed.'); return }
    const parts: string[] = []
    if (j.inserted) parts.push(`Filled ${j.inserted} blank${j.inserted === 1 ? '' : 's'}.`)
    if (j.updated) parts.push(`Updated ${j.updated} existing price${j.updated === 1 ? '' : 's'}.`)
    if (!j.inserted && !j.updated) parts.push('Nothing to change.')
    if (j.skipped_existing) parts.push(`${j.skipped_existing} already had prices (overwrite was off).`)
    if (j.skipped_no_carats) parts.push(`${j.skipped_no_carats} size${j.skipped_no_carats === 1 ? '' : 's'} had no carat weight.`)
    setFillMsg(parts.join(' '))
    if (j.inserted > 0 || j.updated > 0) load()
  }

  async function applyBulk() {
    const p = Number(bulkPct)
    if (!Number.isFinite(p) || p === 0) { setBulkMsg('Enter a non-zero percent.'); return }
    if (Math.abs(p) > 50) { setBulkMsg('Use ±50% or less per adjustment.'); return }
    if (!confirm(`Apply ${p > 0 ? '+' : ''}${p}% to every diamond price? This rewrites the whole matrix.`)) return
    setBulkBusy(true); setBulkMsg('')
    const r = await fetch('/api/configurator/stone-prices/bulk-adjust', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent: p, type: 'lgd' }),
    })
    setBulkBusy(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setBulkMsg(j.error || 'Bulk adjust failed.'); return }
    setBulkPct('')
    setBulkMsg(`Updated ${j.updated} cell${j.updated === 1 ? '' : 's'} by ${p > 0 ? '+' : ''}${p}%.`)
    load()
  }

  const colHeaders = useMemo(
    () => qualities.flatMap(q => colors.map(c => ({ key: `${q.id}|${c.id}`, qb: q, cb: c }))),
    [qualities, colors],
  )

  if (status === 'loading' || !session || !isMaster) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-4 lg:p-7 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/diamonds/catalog" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Diamond className="w-5 h-5 text-[#1E3A5F]" />
            Configurator Stone Prices <span className="text-xs px-2 py-0.5 bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-full font-medium">LGD</span>
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Unified price per piece for configurator elements and inventory costs. Edits save automatically.
          </p>
        </div>
        <button
          onClick={() => { setFillOpen(true); setFillMsg('') }}
          className="px-3 py-2 rounded-lg bg-white border border-stone-200 hover:border-[#1E3A5F] text-stone-700 text-sm font-medium inline-flex items-center gap-1.5 shrink-0"
          title="Auto-fill blank cells from a single ₹/ct rate"
        >
          <Wand2 className="w-3.5 h-3.5 text-[#1E3A5F]" /> Bulk fill blanks
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Database migration not applied yet.</strong> Run <code className="px-1 py-0.5 bg-amber-100 rounded">scripts/migrate_merge_stone_prices.sql</code> in the Supabase SQL Editor, then reload this page.
        </div>
      )}

      {/* Bucket management + bulk adjuster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BucketCard title="Quality buckets" hint="e.g. VVS, VS, SI" buckets={qualities}
          onAdd={(label) => addBucket('quality', label)}
          onRemove={(id) => removeBucket('quality', id)} />
        <BucketCard title="Color buckets" hint="e.g. DEF, GH, IJ" buckets={colors}
          onAdd={(label) => addBucket('color', label)}
          onRemove={(id) => removeBucket('color', id)} />

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-[#1E3A5F]" />
            <h3 className="font-semibold text-stone-900">Bulk price adjust</h3>
          </div>
          <p className="text-xs text-stone-500 mb-3">Increase or decrease every cell by a percentage. Range ±50% per click.</p>
          <div className="flex items-center gap-2">
            <input
              type="number" step="0.5" min="-50" max="50"
              className="w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
              placeholder="±%"
              value={bulkPct}
              onChange={e => setBulkPct(e.target.value)}
              disabled={bulkBusy}
            />
            <span className="text-sm text-stone-500">%</span>
            <button
              onClick={applyBulk}
              disabled={bulkBusy || !bulkPct}
              className="ml-auto px-3 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Apply
            </button>
          </div>
          {bulkMsg && <p className="text-xs text-stone-600 mt-2">{bulkMsg}</p>}
        </div>
      </div>

      {/* Per-shape matrices */}
      {loading && <p className="text-sm text-stone-400">Loading matrix…</p>}
      {!loading && qualities.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-sm text-stone-500">
          Add a quality bucket above to start pricing.
        </div>
      )}
      {!loading && qualities.length > 0 && colors.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-sm text-stone-500">
          Add a color bucket above to start pricing.
        </div>
      )}
      {!loading && qualities.length > 0 && colors.length > 0 && shapes.map(shape => {
        const sizesForShape = sizes.filter(z => z.shape_id === shape.id)
        if (sizesForShape.length === 0) return null
        return (
          <div key={shape.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center gap-2">
              <Diamond className="w-4 h-4 text-[#1E3A5F]" />
              <h2 className="font-semibold text-stone-900">{shape.name}</h2>
              <span className="text-xs text-stone-400">{sizesForShape.length} size{sizesForShape.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/60 border-b border-stone-100">
                    <th className="text-left font-medium text-stone-500 px-3 py-2 sticky left-0 bg-stone-50/60 z-10">Size</th>
                    {colHeaders.map(h => (
                      <th key={h.key} className="text-right font-medium text-stone-500 px-2 py-2 whitespace-nowrap">
                        <div>{h.qb.label}</div>
                        <div className="text-[10px] text-stone-400 font-normal">{h.cb.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizesForShape.map(size => (
                    <tr key={size.id} className="border-b border-stone-100 last:border-b-0">
                      <td className="px-3 py-2 font-medium text-stone-700 sticky left-0 bg-white z-10 whitespace-nowrap">
                        {size.label}
                        {size.approx_carats != null && (
                          <span className="text-[10px] text-stone-400 ml-1">({size.approx_carats}ct)</span>
                        )}
                      </td>
                      {colHeaders.map(h => {
                        const ck = k(shape.id, size.id, h.qb.id, h.cb.id)
                        const cell = cellsByKey[ck]
                        const editing = ck in edits
                        const value = editing ? edits[ck] : (cell ? String(cell.price_per_piece) : '')
                        const status = savingKey[ck]
                        return (
                          <td key={h.key} className="px-1 py-1">
                            <div className="relative">
                              <input
                                type="number" inputMode="decimal" min="0" step="1"
                                className={
                                  'w-24 text-right border rounded px-2 py-1.5 text-sm outline-none transition-colors ' +
                                  (status === 'error' ? 'border-red-300 bg-red-50' :
                                   status === 'saving' ? 'border-amber-300 bg-amber-50/50' :
                                   status === 'saved' ? 'border-emerald-300 bg-emerald-50/50' :
                                   cell ? 'border-stone-200 hover:border-stone-300' :
                                   'border-stone-200 bg-stone-50/50 text-stone-400')
                                }
                                placeholder="—"
                                value={value}
                                onChange={e => setEdits(prev => ({ ...prev, [ck]: e.target.value }))}
                                onBlur={() => {
                                  if (!editing) return
                                  const cur = edits[ck]
                                  const prev = cell ? String(cell.price_per_piece) : ''
                                  if (cur === prev) {
                                    setEdits(p => { const n = { ...p }; delete n[ck]; return n })
                                    return
                                  }
                                  saveCell(shape.id, size.id, h.qb.id, h.cb.id, cur)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                  if (e.key === 'Escape') setEdits(p => { const n = { ...p }; delete n[ck]; return n })
                                }}
                              />
                              {status === 'saved' && (
                                <Check className="w-3 h-3 text-emerald-600 absolute -right-4 top-1/2 -translate-y-1/2" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {fillOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !fillBusy && setFillOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-4 h-4 text-[#1E3A5F]" />
              <h3 className="font-semibold text-stone-900">Bulk fill blank cells</h3>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Sets every cell in the chosen scope to{' '}
              <span className="font-medium text-stone-700">approx_carats × ₹/ct</span>.
              By default existing prices are kept; flip <em>Overwrite existing</em> to replace them too.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Shape</label>
                <select
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
                  value={fillShape}
                  onChange={e => setFillShape(e.target.value)}
                  disabled={fillBusy}
                >
                  <option value="">All shapes</option>
                  {shapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Quality bucket</label>
                <select
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
                  value={fillQuality}
                  onChange={e => setFillQuality(e.target.value)}
                  disabled={fillBusy}
                >
                  <option value="">Select…</option>
                  {qualities.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Color bucket</label>
                <select
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
                  value={fillColor}
                  onChange={e => setFillColor(e.target.value)}
                  disabled={fillBusy}
                >
                  <option value="">Select…</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Base rate (₹ per carat)</label>
                <input
                  type="number" min="1" step="100"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
                  placeholder="e.g. 25000"
                  value={fillRate}
                  onChange={e => setFillRate(e.target.value)}
                  disabled={fillBusy}
                />
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#1E3A5F]"
                  checked={fillOverwrite}
                  onChange={e => setFillOverwrite(e.target.checked)}
                  disabled={fillBusy}
                />
                <span className="text-sm text-stone-700">
                  Overwrite existing prices
                  <span className="text-xs text-stone-400 ml-1">(replace hand-tuned values too)</span>
                </span>
              </label>
            </div>

            {fillMsg && <p className="text-xs text-stone-700 mt-3">{fillMsg}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setFillOpen(false)}
                disabled={fillBusy}
                className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-sm hover:bg-stone-50 disabled:opacity-50"
              >Close</button>
              <button
                onClick={applyBulkFill}
                disabled={fillBusy || !fillQuality || !fillColor || !fillRate}
                className="px-3 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {fillBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Fill blanks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BucketCard({
  title, hint, buckets, onAdd, onRemove,
}: {
  title: string; hint: string; buckets: Bucket[];
  onAdd: (label: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('')
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <span className="text-xs text-stone-400">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
        {buckets.length === 0 && <span className="text-xs text-stone-400">No buckets yet.</span>}
        {buckets.map(b => (
          <span key={b.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-xs">
            {b.label}
            <button onClick={() => onRemove(b.id)} className="text-stone-400 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
          placeholder="Add a bucket"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onAdd(draft); setDraft('') } }}
        />
        <button
          onClick={() => { if (draft.trim()) { onAdd(draft); setDraft('') } }}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg bg-[#1E3A5F] text-white text-sm disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  )
}
