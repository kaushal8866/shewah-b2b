'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Filter, Pencil, Trash2, X } from 'lucide-react'

type Movement = {
  id: string
  movement_type: string
  material_type: string
  item_label: string | null
  unit: string
  quantity: number
  rate_per_unit?: number | null
  reference: string | null
  notes: string | null
  movement_date: string
  pieces?: number | null
  diamond_shape_id?: string | null
  diamond_size_id?: string | null
  vendor_id?: string | null
  manufacturing_partner_id?: string | null
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
  gold_24k: 'Gold (24kt net)',
  diamond_lgd: 'Lab Diamond', diamond_natural: 'Natural Diamond', finding: 'Finding',
}

const EDITABLE_TYPES = new Set(['purchase', 'adjustment_in', 'adjustment_out'])

function fmtUnit(u: string) { return u === 'grams' ? 'g' : u === 'carats' ? 'ct' : u }

export default function StockMovementsPage() {
  const { data: session } = useSession()
  const isMaster = (session?.user as any)?.role === 'master'

  const [rows, setRows] = useState<Movement[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [material, setMaterial] = useState('')
  const [editing, setEditing] = useState<Movement | null>(null)

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

  // Vendor list — only fetched when we open the editor for a purchase row.
  async function ensureVendors() {
    if (vendors.length > 0) return
    const { data } = await supabase.from('vendors').select('id, name').order('name')
    if (data) setVendors(data)
  }

  async function openEdit(row: Movement) {
    if (!EDITABLE_TYPES.has(row.movement_type)) {
      alert("This entry is linked to a karigar's float ledger and can only be changed " +
            "from the karigar's float page.")
      return
    }
    if (row.movement_type === 'purchase') await ensureVendors()
    setEditing(row)
  }

  async function handleDelete(row: Movement) {
    if (!EDITABLE_TYPES.has(row.movement_type)) {
      alert("This entry is linked to a karigar's float ledger and can only be reversed " +
            "from the karigar's float page.")
      return
    }
    const counterparty = row.vendors?.name || row.manufacturing_partners?.name || ''
    const confirmed = confirm(
      `Delete this ${TYPE_LABEL[row.movement_type]?.label || row.movement_type} entry?\n\n` +
      `${row.quantity} ${fmtUnit(row.unit)} of ${MATERIAL_LABEL[row.material_type] || row.material_type}` +
      (counterparty ? ` (${counterparty})` : '') + `\n\n` +
      `This permanently removes the entry from the ledger and cannot be undone.`,
    )
    if (!confirmed) return

    const r = await fetch(`/api/stock/movements/${row.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      alert(d.message || d.error || 'Could not delete this entry.')
      return
    }
    load()
  }

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
            <div className={isMaster ? 'col-span-3' : 'col-span-3'}>Material</div>
            <div className="col-span-2">Counterparty</div>
            <div className={`col-span-2 text-right`}>Quantity</div>
            <div className={`${isMaster ? 'col-span-1' : 'col-span-1'} text-right`}>{isMaster ? 'Actions' : 'Ref'}</div>
          </div>
          <div className="divide-y divide-stone-50">
            {rows.map(r => {
              const meta = TYPE_LABEL[r.movement_type] || { label: r.movement_type, tone: 'bg-stone-100 text-stone-700', sign: '' }
              const counterparty = r.vendors?.name || r.manufacturing_partners?.name || '—'
              const editable = EDITABLE_TYPES.has(r.movement_type)
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
                  <div className="col-span-3 lg:col-span-1 text-right">
                    {isMaster ? (
                      editable ? (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => openEdit(r)}
                            title="Edit"
                            className="text-stone-400 hover:text-[#1E3A5F] p-1 rounded hover:bg-stone-50">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(r)}
                            title="Delete"
                            className="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-stone-300" title="Linked to a karigar's float ledger">karigar-linked</span>
                      )
                    ) : (
                      <span className="text-xs text-stone-400 truncate">{r.reference || ''}</span>
                    )}
                  </div>
                  {r.notes && (
                    <div className="col-span-12 text-xs text-stone-400 -mt-1">↳ {r.notes}</div>
                  )}
                  {isMaster && r.reference && (
                    <div className="col-span-12 text-[11px] text-stone-300 -mt-1">Ref: {r.reference}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <EditMovementModal
          row={editing}
          vendors={vendors}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function EditMovementModal({
  row, vendors, onClose, onSaved,
}: {
  row: Movement
  vendors: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    quantity: String(row.quantity),
    movement_date: row.movement_date,
    reference: row.reference || '',
    notes: row.notes || '',
    vendor_id: row.vendor_id || '',
    item_label: row.item_label || '',
    pieces: row.pieces != null ? String(row.pieces) : '',
  })
  const [saving, setSaving] = useState(false)
  const isPurchase = row.movement_type === 'purchase'
  const isFinding = row.material_type === 'finding'
  const isDiamond = row.material_type.startsWith('diamond')

  async function save() {
    setSaving(true)
    const patch: Record<string, unknown> = {
      quantity: Number(form.quantity),
      movement_date: form.movement_date,
      reference: form.reference || null,
      notes: form.notes || null,
    }
    if (isPurchase) patch.vendor_id = form.vendor_id || null
    if (isFinding) patch.item_label = form.item_label
    if (isDiamond && form.pieces) patch.pieces = Number(form.pieces)

    const r = await fetch(`/api/stock/movements/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) {
      alert(d.message || d.error || 'Could not save changes.')
      return
    }
    onSaved()
  }

  const lbl = "block text-xs font-medium text-stone-500 mb-1"
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-stone-900">Edit {TYPE_LABEL[row.movement_type]?.label || row.movement_type}</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {MATERIAL_LABEL[row.material_type] || row.material_type}
              {row.item_label && !isFinding && ` — ${row.item_label}`}
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={lbl}>Quantity ({fmtUnit(row.unit)})</label>
            <input type="number" inputMode="decimal" step="0.0001" className={inp}
              value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>

          {isFinding && (
            <div>
              <label className={lbl}>Finding name</label>
              <input className={inp}
                value={form.item_label} onChange={e => setForm({ ...form, item_label: e.target.value })} />
            </div>
          )}

          {isDiamond && row.pieces != null && (
            <div>
              <label className={lbl}>Pieces</label>
              <input type="number" inputMode="numeric" step="1" className={inp}
                value={form.pieces} onChange={e => setForm({ ...form, pieces: e.target.value })} />
            </div>
          )}

          {isPurchase && (
            <div>
              <label className={lbl}>Vendor</label>
              <select className={inp}
                value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}>
                <option value="">— Select —</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <p className="text-[11px] text-stone-400 mt-1">Purchases must always have a vendor for audit.</p>
            </div>
          )}

          <div>
            <label className={lbl}>Date</label>
            <input type="date" className={inp}
              value={form.movement_date} onChange={e => setForm({ ...form, movement_date: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Reference / bill no.</label>
            <input className={inp}
              value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <input className={inp}
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
