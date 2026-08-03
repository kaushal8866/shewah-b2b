'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Diamond, Plus, Trash2, ArrowLeft, AlertTriangle, Save, X, ChevronRight, Copy,
} from 'lucide-react'

// Group shapes by category in the left rail so the catalog stays legible
// once we go from 10 → 25+ shapes (task 88). Categories are name-based so
// shapes a master adds later automatically fall into "Other".
const SHAPE_CATEGORIES: { label: string; names: string[] }[] = [
  { label: 'Round',                names: ['round'] },
  { label: 'Square / cushion',     names: ['princess','asscher','cushion','rectangular cushion','radiant','rectangular radiant','carre'] },
  { label: 'Fancy elongated',      names: ['oval','pear','marquise','emerald','heart','trillion'] },
  { label: 'Side stones / calibre', names: ['baguette','tapered baguette','half moon','calf','bullet','tapered bullet','shield','kite','trapezoid','hexagon','epaulette'] },
  { label: 'Antique / specialty',  names: ['rose cut'] },
]
function categoryFor(name: string): string {
  const n = name.toLowerCase()
  for (const c of SHAPE_CATEGORIES) if (c.names.includes(n)) return c.label
  return 'Other'
}

type Shape = { id: string; name: string; sort_order: number; active: boolean }
type Size = {
  id: string
  shape_id: string
  label: string
  approx_carats: number | null
  reorder_threshold_pieces: number | null
  sort_order: number
  active: boolean
}
type Group = {
  diamond_shape_id: string | null
  diamond_size_id: string | null
  carats: number
  pieces: number
  reorder_threshold_pieces: number | null
}

export default function DiamondsCatalogPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isMaster = session?.user?.role === 'master'
  // Master-only admin page. Non-masters get bounced back to the dashboard
  // (mirrors how the rest of the master surfaces protect themselves).
  // Note that all mutating APIs already enforce master-only on the server,
  // so this is the route-level UX gate — not the security boundary.
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/login'); return }
    if (!isMaster) { router.replace('/') }
  }, [status, session, isMaster, router])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [s, z, g] = await Promise.all([
        fetch('/api/diamonds/shapes').then(r => r.json()),
        fetch('/api/diamonds/sizes').then(r => r.json()),
        fetch('/api/diamonds/stock').then(r => r.json()),
      ])
      const shapeList: Shape[] = s.shapes || []
      setShapes(shapeList)
      setSizes(z.sizes || [])
      setGroups(g.groups || [])
      if (!activeShapeId && shapeList.length > 0) setActiveShapeId(shapeList[0].id)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  // Sum on-hand pieces / carats across BOTH lgd + natural so the catalog
  // page tells the operator "do I have any of this size at all?". The
  // Stock dashboard splits the two when the operator needs that breakdown.
  function balanceFor(sizeId: string) {
    let pieces = 0, carats = 0
    for (const g of groups) {
      if (g.diamond_size_id === sizeId) {
        pieces += g.pieces
        carats += g.carats
      }
    }
    return { pieces, carats }
  }

  const activeShape = shapes.find(s => s.id === activeShapeId) || null
  const sizesForActive = sizes.filter(s => s.shape_id === activeShapeId)

  // Suppress the page entirely while the role gate decides — keeps the
  // master-only catalog hidden from a non-master who briefly lands here.
  if (status === 'loading' || !session || !isMaster) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/stock" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Diamond className="w-5 h-5 text-stone-800" />
            Diamond catalog
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            One row per shape × size you stock. Drives pickers everywhere and the shortage alerts on Stock.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <p className="text-sm text-stone-400">Loading catalog...</p>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Shapes column */}
          <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">Shapes</h2>
              {isMaster && <NewShapeRow onCreated={load} />}
            </div>
            <div className="divide-y divide-stone-50 max-h-[60vh] overflow-y-auto">
              {shapes.length === 0 && (
                <p className="px-4 py-6 text-sm text-stone-400">No shapes yet.</p>
              )}
              {(() => {
                // Render shapes grouped by category. Order: predefined
                // categories first, then any catch-all "Other" bucket.
                const order = [...SHAPE_CATEGORIES.map(c => c.label), 'Other']
                const buckets = new Map<string, Shape[]>()
                for (const s of shapes) {
                  const c = categoryFor(s.name)
                  if (!buckets.has(c)) buckets.set(c, [])
                  buckets.get(c)!.push(s)
                }
                return order
                  .filter(label => buckets.has(label))
                  .map(label => (
                    <div key={label}>
                      <div className="px-4 py-1.5 bg-stone-50/60 text-[10px] uppercase tracking-wide text-stone-400 font-semibold border-b border-stone-100">
                        {label}
                      </div>
                      {buckets.get(label)!.map(s => {
                        const count = sizes.filter(z => z.shape_id === s.id).length
                        return (
                          <button
                            key={s.id}
                            onClick={() => setActiveShapeId(s.id)}
                            className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-stone-50 ${
                              activeShapeId === s.id ? 'bg-yellow-50' : ''
                            }`}>
                            <span className="flex-1 text-sm font-medium text-stone-900">
                              {s.name}{!s.active && <span className="ml-2 text-[10px] text-stone-400">(inactive)</span>}
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 font-medium ${
                              count === 0
                                ? 'bg-stone-100 text-stone-400'
                                : 'bg-stone-800/10 text-stone-800'
                            }`}>
                              {count} size{count === 1 ? '' : 's'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-stone-300" />
                          </button>
                        )
                      })}
                    </div>
                  ))
              })()}
            </div>
          </div>

          {/* Sizes column */}
          <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center gap-3">
              <h2 className="text-sm font-medium text-stone-700 flex-1">
                {activeShape ? `Sizes — ${activeShape.name}` : 'Sizes'}
              </h2>
              {isMaster && activeShape && (
                <>
                  <CopySizesAction
                    target={activeShape}
                    shapes={shapes}
                    sizes={sizes}
                    onCopied={load}
                  />
                  <ShapeActions shape={activeShape} onChanged={load} />
                </>
              )}
            </div>

            {!activeShape && (
              <p className="px-4 py-6 text-sm text-stone-400">Pick a shape to see its sizes.</p>
            )}

            {activeShape && (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide border-b border-stone-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Size</th>
                      <th className="px-3 py-2 text-right">Approx ct/pc</th>
                      <th className="px-3 py-2 text-right">Reorder ≤ pcs</th>
                      <th className="px-3 py-2 text-right">On hand</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {sizesForActive.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-stone-400 text-sm text-center">No sizes for this shape yet.</td></tr>
                    )}
                    {sizesForActive.map(z => {
                      const bal = balanceFor(z.id)
                      const low = z.reorder_threshold_pieces != null && bal.pieces <= z.reorder_threshold_pieces
                      return (
                        <SizeRow key={z.id} size={z} balance={bal} low={low} canEdit={isMaster} onChanged={load} />
                      )
                    })}
                  </tbody>
                </table>
                {isMaster && <NewSizeRow shapeId={activeShape.id} onCreated={load} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewShapeRow({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!name.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/diamonds/shapes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Failed'); return }
      setName(''); setOpen(false); onCreated()
    } finally { setBusy(false) }
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs flex items-center gap-1 text-stone-800 hover:underline">
        <Plus className="w-3.5 h-3.5" /> New shape
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <input autoFocus value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Baguette"
        className="text-sm border border-stone-200 rounded px-2 py-1 outline-none focus:border-stone-800 w-32" />
      <button disabled={busy} onClick={save} className="text-xs bg-stone-800 text-white px-2 py-1 rounded disabled:opacity-50">
        {busy ? '...' : 'Save'}
      </button>
      <button onClick={() => { setOpen(false); setName(''); setErr('') }} className="text-stone-400 hover:text-stone-700">
        <X className="w-4 h-4" />
      </button>
      {err && <span className="text-xs text-red-500 ml-2">{err}</span>}
    </div>
  )
}

function ShapeActions({ shape, onChanged }: { shape: Shape; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  async function toggleActive() {
    setBusy(true)
    await fetch(`/api/diamonds/shapes/${shape.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !shape.active }),
    })
    setBusy(false); onChanged()
  }
  async function destroy() {
    if (!confirm(`Delete shape "${shape.name}"? This only works if no stock movements reference it.`)) return
    setBusy(true)
    const r = await fetch(`/api/diamonds/shapes/${shape.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert(d.error || 'Could not delete')
      return
    }
    onChanged()
  }
  return (
    <div className="flex items-center gap-2">
      <button disabled={busy} onClick={toggleActive}
        className="text-xs text-stone-600 hover:text-stone-900 underline">
        {shape.active ? 'Deactivate' : 'Reactivate'}
      </button>
      <button disabled={busy} onClick={destroy} className="text-red-400 hover:text-red-600 p-1">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function SizeRow({
  size, balance, low, canEdit, onChanged,
}: {
  size: Size
  balance: { pieces: number; carats: number }
  low: boolean
  canEdit: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    label: size.label,
    approx_carats: size.approx_carats != null ? String(size.approx_carats) : '',
    reorder_threshold_pieces: size.reorder_threshold_pieces != null ? String(size.reorder_threshold_pieces) : '',
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const r = await fetch(`/api/diamonds/sizes/${size.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: draft.label,
        approx_carats: draft.approx_carats === '' ? null : draft.approx_carats,
        reorder_threshold_pieces: draft.reorder_threshold_pieces === '' ? null : draft.reorder_threshold_pieces,
      }),
    })
    setBusy(false)
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); return }
    setEditing(false); onChanged()
  }
  async function toggleActive() {
    setBusy(true)
    await fetch(`/api/diamonds/sizes/${size.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !size.active }),
    })
    setBusy(false); onChanged()
  }
  async function destroy() {
    if (!confirm(`Delete size "${size.label}"?`)) return
    setBusy(true)
    const r = await fetch(`/api/diamonds/sizes/${size.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not delete'); return }
    onChanged()
  }

  const inp = "border border-stone-200 rounded px-2 py-1 text-sm w-full outline-none focus:border-stone-800"
  if (editing && canEdit) {
    return (
      <tr className="bg-yellow-50">
        <td className="px-3 py-2"><input className={inp} value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} /></td>
        <td className="px-3 py-2"><input type="number" step="0.001" className={inp + ' text-right'} value={draft.approx_carats} onChange={e => setDraft(d => ({ ...d, approx_carats: e.target.value }))} /></td>
        <td className="px-3 py-2"><input type="number" min="0" className={inp + ' text-right'} value={draft.reorder_threshold_pieces} onChange={e => setDraft(d => ({ ...d, reorder_threshold_pieces: e.target.value }))} /></td>
        <td className="px-3 py-2 text-right text-stone-400 text-xs">—</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 justify-end">
            <button disabled={busy} onClick={save} className="text-xs bg-stone-800 text-white px-2 py-1 rounded">{busy ? '...' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-stone-400 hover:text-stone-700"><X className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={low ? 'bg-amber-50' : ''}>
      <td className="px-3 py-2 font-medium text-stone-800">
        {size.label}
        {!size.active && <span className="ml-2 text-[10px] text-stone-400">(inactive)</span>}
      </td>
      <td className="px-3 py-2 text-right text-stone-600">{size.approx_carats != null ? Number(size.approx_carats).toFixed(3) : '—'}</td>
      <td className="px-3 py-2 text-right text-stone-600">{size.reorder_threshold_pieces ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <span className={`font-semibold ${low ? 'text-amber-700' : 'text-stone-900'}`}>{balance.pieces} pcs</span>
        <span className="text-xs text-stone-400 ml-2">({balance.carats.toFixed(3)} ct)</span>
        {low && (
          <span className="ml-2 text-[10px] bg-amber-200 text-amber-800 rounded px-1.5 py-0.5 font-medium">LOW</span>
        )}
      </td>
      <td className="px-3 py-2">
        {canEdit && (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setEditing(true)} className="text-xs text-stone-800 hover:underline">Edit</button>
            <button disabled={busy} onClick={toggleActive} className="text-xs text-stone-500 hover:text-stone-900 underline">
              {size.active ? 'Hide' : 'Show'}
            </button>
            <button disabled={busy} onClick={destroy} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </td>
    </tr>
  )
}

function CopySizesAction({
  target, shapes, sizes, onCopied,
}: {
  target: Shape
  shapes: Shape[]
  sizes: Size[]
  onCopied: () => void
}) {
  // Lightweight inline picker — pick a source shape that has at least
  // one size, then bulk-insert any non-duplicate labels onto the
  // currently-selected target shape. Skipped duplicates are surfaced
  // back so the master can tell what carried over and what didn't.
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const sourceOptions = shapes.filter(s =>
    s.id !== target.id && sizes.some(z => z.shape_id === s.id)
  )

  async function copy() {
    if (!from) { setErr('Pick a source shape'); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/diamonds/sizes/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_shape_id: from, to_shape_id: target.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'Copy failed'); return }
      setOpen(false); setFrom('')
      onCopied()
      alert(`Added ${d.inserted} size(s).${d.skipped ? ` ${d.skipped} duplicate(s) skipped.` : ''}`)
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs flex items-center gap-1 text-stone-800 hover:underline"
        title="Copy sizes from another shape">
        <Copy className="w-3.5 h-3.5" /> Copy sizes
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <select autoFocus value={from} onChange={e => { setFrom(e.target.value); setErr('') }}
        className="text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-stone-800 max-w-[160px]">
        <option value="">Copy from…</option>
        {sourceOptions.map(s => {
          const n = sizes.filter(z => z.shape_id === s.id).length
          return <option key={s.id} value={s.id}>{s.name} ({n})</option>
        })}
      </select>
      <button disabled={busy || !from} onClick={copy}
        className="text-xs bg-stone-800 text-white px-2 py-1 rounded disabled:opacity-50">
        {busy ? '...' : 'Copy'}
      </button>
      <button onClick={() => { setOpen(false); setFrom(''); setErr('') }}
        className="text-stone-400 hover:text-stone-700">
        <X className="w-4 h-4" />
      </button>
      {err && <span className="text-xs text-red-500 ml-1">{err}</span>}
    </div>
  )
}

function NewSizeRow({ shapeId, onCreated }: { shapeId: string; onCreated: () => void }) {
  const [draft, setDraft] = useState({ label: '', approx_carats: '', reorder_threshold_pieces: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!draft.label.trim()) { setErr('Label is required'); return }
    setBusy(true); setErr('')
    const r = await fetch('/api/diamonds/sizes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shape_id: shapeId,
        label: draft.label.trim(),
        approx_carats: draft.approx_carats === '' ? null : draft.approx_carats,
        reorder_threshold_pieces: draft.reorder_threshold_pieces === '' ? null : draft.reorder_threshold_pieces,
      }),
    })
    setBusy(false)
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); return }
    setDraft({ label: '', approx_carats: '', reorder_threshold_pieces: '' })
    onCreated()
  }
  const inp = "border border-stone-200 rounded px-2 py-1 text-sm w-full outline-none focus:border-stone-800"
  return (
    <div className="px-3 py-3 border-t border-stone-100 bg-stone-50/60 flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <label className="block text-[11px] text-stone-500 mb-1">New size label *</label>
        <input className={inp} placeholder="e.g. 2.5mm or 0.10ct" value={draft.label}
          onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
      </div>
      <div className="w-28">
        <label className="block text-[11px] text-stone-500 mb-1">Approx ct/pc</label>
        <input type="number" step="0.001" className={inp} value={draft.approx_carats}
          onChange={e => setDraft(d => ({ ...d, approx_carats: e.target.value }))} />
      </div>
      <div className="w-28">
        <label className="block text-[11px] text-stone-500 mb-1">Reorder ≤ pcs</label>
        <input type="number" min="0" className={inp} value={draft.reorder_threshold_pieces}
          onChange={e => setDraft(d => ({ ...d, reorder_threshold_pieces: e.target.value }))} />
      </div>
      <button disabled={busy} onClick={save}
        className="bg-stone-800 text-white text-sm px-3 py-1.5 rounded flex items-center gap-1.5 disabled:opacity-50">
        <Save className="w-3.5 h-3.5" /> {busy ? 'Saving...' : 'Add size'}
      </button>
      {err && <span className="text-xs text-red-500 w-full">{err}</span>}
    </div>
  )
}
