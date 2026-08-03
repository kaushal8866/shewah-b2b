'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFileToCloudinary } from '@/lib/cloudinaryUpload'
import { X, AlertTriangle, ArrowRightCircle, Package, FileUp, Trash2 } from 'lucide-react'

type Branch = 'choose' | 'not_started' | 'reassign' | 'receive'

type Partner = { id: string; name: string; city: string | null }

export default function CancelMfgOrderModal(props: {
  mfgOrderId: string
  currentPartnerId: string | null
  currentPartnerName: string | null
  goldKarat: number | null
  goldWeightRequired: number | null
  productCode?: string | null
  productName?: string | null
  defaultListPrice?: number | null
  onClose: () => void
  onDone: (action: 'not_started' | 'reassign' | 'receive', payload?: Record<string, unknown>) => void
}) {
  const { mfgOrderId, currentPartnerId, currentPartnerName, goldKarat, goldWeightRequired,
    productCode, productName, defaultListPrice, onClose, onDone } = props

  const [branch, setBranch] = useState<Branch>('choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  // reassign state
  const [partners, setPartners] = useState<Partner[]>([])
  const [newPartnerId, setNewPartnerId] = useState('')

  // receive state
  const [pure24, setPure24] = useState('')
  const [diamondCt, setDiamondCt] = useState('')
  const [diamondNotes, setDiamondNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [listPrice, setListPrice] = useState(defaultListPrice ? String(defaultListPrice) : '')

  useEffect(() => {
    if (branch === 'reassign' && partners.length === 0) {
      supabase.from('manufacturing_partners')
        .select('id, name, city')
        .eq('status', 'active')
        .order('name')
        .then((r: { data: Partner[] | null }) => setPartners(r.data || []))
    }
  }, [branch, partners.length])

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const r = await uploadFileToCloudinary(file)
      setPhotos(p => [...p, r.url])
    } catch (e) {
      alert('Upload failed: ' + (e as Error).message)
    }
    setUploading(false)
  }

  async function submit(action: 'not_started' | 'reassign' | 'receive') {
    setBusy(true); setError(null)
    const body: Record<string, unknown> = { action, reason: reason || null }
    if (action === 'reassign') {
      if (!newPartnerId) { setError('Pick a partner'); setBusy(false); return }
      body.new_partner_id = newPartnerId
    }
    if (action === 'receive') {
      const pure = Number(pure24)
      const list = Number(listPrice)
      if (!pure || pure <= 0) { setError('Actual pure-gold weight (24kt) is required'); setBusy(false); return }
      if (!list || list <= 0) { setError('A list price is required'); setBusy(false); return }
      body.actual_pure_24kt_g = pure
      body.actual_diamond_ct = Number(diamondCt) || 0
      body.diamond_specs = diamondNotes ? { notes: diamondNotes, total_carats: Number(diamondCt) || 0 } : (Number(diamondCt) > 0 ? { total_carats: Number(diamondCt) } : {})
      body.photos = photos
      body.list_price = list
      body.receive_notes = reason || null
    }
    try {
      const r = await fetch(`/api/manufacturing/orders/${mfgOrderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      onDone(action, j)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const factor: Record<number, number> = { 24: 1, 22: 0.916, 18: 0.75, 14: 0.6, 10: 0.42, 9: 0.38 }
  const f = factor[goldKarat || 22] || 0.916
  const grossPreview = Number(pure24) > 0 ? (Number(pure24) / f).toFixed(4) : '—'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-stone-900">Cancel manufacturing order</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-3">{error}</div>}

        {branch === 'choose' && (
          <div className="space-y-2">
            <p className="text-sm text-stone-600 mb-3">What stage is this with <strong>{currentPartnerName || 'the karigar'}</strong>?</p>
            <button onClick={() => setBranch('not_started')}
              className="w-full text-left border border-stone-200 hover:border-stone-800 rounded-xl p-3 flex items-start gap-3">
              <ArrowRightCircle className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-900 text-sm">Not started yet</p>
                <p className="text-xs text-stone-500">Release the float reservation, close the order.</p>
              </div>
            </button>
            <button onClick={() => setBranch('reassign')}
              className="w-full text-left border border-stone-200 hover:border-stone-800 rounded-xl p-3 flex items-start gap-3">
              <ArrowRightCircle className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-900 text-sm">In making — karigar refuses</p>
                <p className="text-xs text-stone-500">Move the float reservation to another karigar. Order stays open.</p>
              </div>
            </button>
            <button onClick={() => setBranch('receive')}
              className="w-full text-left border border-stone-200 hover:border-stone-800 rounded-xl p-3 flex items-start gap-3">
              <Package className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-stone-900 text-sm">Already completed (not received)</p>
                <p className="text-xs text-stone-500">Capture the actual gold + diamonds, photos, and price — moves into Ready-to-Ship.</p>
              </div>
            </button>
          </div>
        )}

        {branch !== 'choose' && (
          <div className="space-y-3">
            <button onClick={() => setBranch('choose')} className="text-xs text-stone-500 hover:underline">← Back</button>

            <label className="block text-xs font-medium text-stone-500">Reason / note (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Karigar said..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />

            {branch === 'reassign' && (
              <>
                <label className="block text-xs font-medium text-stone-500">Reassign to</label>
                <select value={newPartnerId} onChange={e => setNewPartnerId(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">— pick a karigar —</option>
                  {partners.filter(p => p.id !== currentPartnerId).map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.city ? `(${p.city})` : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-stone-400">
                  The pending {goldWeightRequired ? `${goldWeightRequired}g` : ''} reservation moves to this karigar's float.
                </p>
              </>
            )}

            {branch === 'receive' && (
              <>
                <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-600 mb-2">
                  {productCode || productName ? (
                    <p>Product: <strong className="text-stone-800">{productName || ''} {productCode ? `(${productCode})` : ''}</strong></p>
                  ) : null}
                  <p>Karat used: <strong className="text-stone-800">{goldKarat || 22}kt</strong> · expected gross {goldWeightRequired || 0}g</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Actual pure 24kt (g) *</label>
                    <input type="number" step="0.0001" value={pure24} onChange={e => setPure24(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                    <p className="text-[10px] text-stone-400 mt-0.5">≈ {grossPreview}g at {goldKarat || 22}kt</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">List price (₹) *</label>
                    <input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Diamond carats</label>
                    <input type="number" step="0.01" value={diamondCt} onChange={e => setDiamondCt(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Diamond notes</label>
                    <input value={diamondNotes} onChange={e => setDiamondNotes(e.target.value)}
                      placeholder="LGD VS, etc."
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Photos of finished piece</label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
                        <img src={p} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-800 cursor-pointer">
                      <FileUp className="w-4 h-4" />
                      <input type="file" accept="image/*" className="hidden"
                        disabled={uploading}
                        onChange={async e => {
                          const f = e.target.files?.[0]
                          if (f) await uploadPhoto(f)
                          e.target.value = ''
                        }} />
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm">
                Cancel
              </button>
              <button onClick={() => submit(branch as 'not_started' | 'reassign' | 'receive')} disabled={busy}
                className="flex-1 bg-stone-800 hover:bg-stone-900 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {busy ? 'Working...' :
                  branch === 'not_started' ? 'Cancel & release float' :
                  branch === 'reassign' ? 'Reassign' :
                  'Receive into Ready-to-Ship'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
