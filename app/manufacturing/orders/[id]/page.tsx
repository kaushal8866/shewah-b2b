'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, getStatusColor } from '@/lib/utils'
import { ArrowLeft, Save, Trash2, Edit2, X, Printer, Send, Copy, RefreshCw, FileDown, Check, Clock, Link2 } from 'lucide-react'
import Link from 'next/link'

const MFG_STATUSES = ['issued', 'in_progress', 'quality_check', 'completed', 'returned', 'cancelled']

export default function ManufacturingOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [form, setForm] = useState<any>({})
  const [shareLink, setShareLink] = useState<any>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { load() }, [id])
  useEffect(() => { loadShareLink() }, [id])

  async function loadShareLink() {
    try {
      const r = await fetch(`/api/manufacturing/orders/${id}/share-link`)
      const j = await r.json()
      const links = (j.links || []) as any[]
      const active = links.find(l => !l.revoked && new Date(l.expires_at).getTime() > Date.now())
      setShareLink(active || null)
    } catch { /* ignore */ }
  }

  async function createOrRefreshLink(sendWhatsapp: boolean, reuseActive = false) {
    setShareBusy(true)
    setShareToast(null)
    try {
      const r = await fetch(`/api/manufacturing/orders/${id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendWhatsapp, reuseActive }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      setShareLink(j.link)
      if (sendWhatsapp) {
        if (j.send?.ok) {
          setShareToast('WhatsApp message sent to karigar.')
        } else {
          const reason = j.send?.reason || `status ${j.send?.status || '?'}`
          setShareToast(`Link created, but WhatsApp send failed (${reason}). Copy the link to share manually.`)
        }
      } else {
        setShareToast('Fresh link generated.')
      }
    } catch (e: any) {
      setShareToast(e?.message || 'Failed to generate link')
    }
    setShareBusy(false)
  }

  async function revokeLink() {
    if (!shareLink?.token) return
    if (!confirm('Revoke this link? The karigar will lose access immediately.')) return
    setShareBusy(true)
    await fetch(`/api/manufacturing/orders/${id}/share-link?token=${shareLink.token}`, { method: 'DELETE' })
    setShareLink(null)
    setShareToast('Link revoked.')
    setShareBusy(false)
  }

  function shareUrl(token: string): string {
    if (typeof window === 'undefined') return `/m/${token}`
    return `${window.location.origin}/m/${token}`
  }

  async function copyLink() {
    if (!shareLink?.token) return
    try {
      await navigator.clipboard.writeText(shareUrl(shareLink.token))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('manufacturing_orders')
      .select('*, manufacturing_partners(name, city), orders(order_number, partners(store_name))')
      .eq('id', id)
      .single()
    if (!data) { router.push('/manufacturing'); return }
    setOrder(data)
    setForm(data)
    setLoading(false)
  }

  function set(k: string, v: string | boolean) { setForm((prev: any) => ({ ...prev, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const goldWeight = parseFloat(form.gold_weight_actual || form.gold_weight_required || '0')
    const effectiveWeight = Math.max(goldWeight, 1)
    const labourAmount = effectiveWeight * (parseFloat(form.labour_per_gram) || 0)
    const otherCharges = parseFloat(form.other_charges) || 0
    const totalMfgCost = labourAmount + otherCharges
    const prevStatus: string | undefined = order?.status
    const newStatus: string = form.status

    const { error } = await supabase.from('manufacturing_orders').update({
      status: form.status,
      description: form.description,
      quantity: parseInt(form.quantity) || 1,
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      gold_karat: parseInt(form.gold_karat) || null,
      gold_weight_required: parseFloat(form.gold_weight_required) || null,
      gold_weight_actual: parseFloat(form.gold_weight_actual) || null,
      diamond_weight: parseFloat(form.diamond_weight) || null,
      material_from_float: form.material_from_float,
      material_notes: form.material_notes || null,
      labour_per_gram: parseFloat(form.labour_per_gram) || null,
      other_charges: otherCharges,
      labour_amount: labourAmount || null,
      total_manufacturing_cost: totalMfgCost || null,
      expected_date: form.expected_date || null,
      completed_date: form.completed_date || null,
      internal_notes: form.internal_notes || null,
    }).eq('id', id)
    if (error) { setSaving(false); alert('Error: ' + error.message); return }

    // Float lifecycle transitions for the pending consumption row that was
    // created when this order was issued from float:
    //   • → completed → flip to lifecycle='final' (use actual weight if entered)
    //   • → cancelled → delete the reservation, gold returns to Available
    if (prevStatus !== newStatus && order?.material_from_float) {
      try {
        if (newStatus === 'completed') {
          const finalQty = parseFloat(form.gold_weight_actual) || null
          const upd: any = { lifecycle: 'final' }
          if (finalQty && finalQty > 0) upd.quantity = finalQty
          await supabase.from('material_transactions')
            .update(upd)
            .eq('manufacturing_order_id', id)
            .eq('transaction_type', 'consumption')
            .eq('lifecycle', 'pending')
        } else if (prevStatus === 'completed' && newStatus !== 'completed' && newStatus !== 'cancelled') {
          // Reverting from completed → revert the finalised consumption back
          // to a pending reservation so the gold is no longer counted as Used.
          // Restore the originally-required quantity.
          const restoreQty = parseFloat(order.gold_weight_required) || null
          const upd: any = { lifecycle: 'pending' }
          if (restoreQty && restoreQty > 0) upd.quantity = restoreQty
          await supabase.from('material_transactions')
            .update(upd)
            .eq('manufacturing_order_id', id)
            .eq('transaction_type', 'consumption')
            .eq('lifecycle', 'final')
        } else if (newStatus === 'cancelled') {
          // Cancellation drops both pending reservations AND a finalised one
          // (because the order itself has been declared void).
          await supabase.from('material_transactions')
            .delete()
            .eq('manufacturing_order_id', id)
            .eq('transaction_type', 'consumption')
        }
      } catch (e) {
        console.error('lifecycle transition failed', e)
      }
    }

    setSaving(false)
    setEditing(false)
    load()
  }

  async function handleDelete() {
    const { error } = await supabase.from('manufacturing_orders').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/manufacturing')
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>

  const goldWeight = parseFloat(form.gold_weight_actual || form.gold_weight_required || '0')
  const effectiveWeight = Math.max(goldWeight, 1)
  const labourAmount = effectiveWeight * (parseFloat(form.labour_per_gram) || 0)
  const otherCharges = parseFloat(form.other_charges) || 0
  const totalMfgCost = labourAmount + otherCharges

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/manufacturing" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-stone-900">{order.order_number}</h1>
          <p className="text-stone-400 text-sm">
            {order.manufacturing_partners?.name} · {order.manufacturing_partners?.city}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50 print:hidden">
            <Printer className="w-4 h-4" />
          </button>
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(order) }}
                className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-stone-900 mb-2">Delete this order?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Permanently delete <strong>{order.order_number}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <span className={`status-pill ${getStatusColor(order.status)}`}>
              {order.status?.replace(/_/g, ' ')}
            </span>
            {order.material_from_float && (
              <span className="status-pill bg-amber-100 text-amber-700">Float material</span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['Manufacturing partner', order.manufacturing_partners?.name],
                ['Linked customer order', order.orders ? order.orders.order_number : '—'],
                ['Description', order.description],
                ['Quantity', order.quantity],
                ['Ring size', order.ring_size || '—'],
                ['Issued date', formatDate(order.issued_date)],
                ['Expected date', order.expected_date ? formatDate(order.expected_date) : '—'],
                ['Completed date', order.completed_date ? formatDate(order.completed_date) : '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5">{String(v || '—')}</p>
                </div>
              ))}
              {order.special_notes && (
                <div className="col-span-2">
                  <p className="text-xs text-stone-400">Special notes</p>
                  <p className="text-stone-800 mt-0.5">{order.special_notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Material</h2>
            <div className="grid grid-cols-3 gap-y-3 gap-x-6 text-sm">
              {[
                ['Gold karat', order.gold_karat ? `${order.gold_karat}K` : '—'],
                ['Weight required', order.gold_weight_required ? `${order.gold_weight_required}g` : '—'],
                ['Weight actual', order.gold_weight_actual ? `${order.gold_weight_actual}g` : '—'],
                ['Diamond weight', order.diamond_weight ? `${order.diamond_weight}ct` : '—'],
                ['Material from float', order.material_from_float ? 'Yes' : 'No'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-xs text-stone-400">{k}</p>
                  <p className="text-stone-800 mt-0.5">{String(v)}</p>
                </div>
              ))}
            </div>
            {order.material_notes && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Material notes</p>
                <p className="text-sm text-stone-700">{order.material_notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-3">Labour charges</h2>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>Labour rate</span>
                <span>₹{order.labour_per_gram || '—'}/g</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Effective weight (min 1g)</span>
                <span>{Math.max(order.gold_weight_actual || order.gold_weight_required || 0, 1)}g</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Labour amount</span>
                <span>₹{order.labour_amount?.toLocaleString('en-IN') || '—'}</span>
              </div>
              {(order.other_charges > 0) && (
                <div className="flex justify-between text-stone-500">
                  <span>Other charges</span>
                  <span>₹{order.other_charges?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-stone-900 pt-2 border-t border-stone-200">
                <span>Total manufacturing cost</span>
                <span className="text-[#1E3A5F]">₹{order.total_manufacturing_cost?.toLocaleString('en-IN') || '—'}</span>
              </div>
            </div>
          </div>

          {/* Karigar pack — WhatsApp share link */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 print:hidden">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div>
                <h2 className="font-medium text-stone-900 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#1E3A5F]" />
                  Karigar pack link
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Send the assets to {order.manufacturing_partners?.name || 'the karigar'} on WhatsApp. Link auto-expires in 48 hours.</p>
              </div>
            </div>

            {shareLink ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2 text-emerald-800 text-sm font-medium">
                  <Check className="w-4 h-4" /> Active link
                </div>
                <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2 mb-2 text-xs text-stone-700 font-mono break-all">
                  {shareUrl(shareLink.token)}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={copyLink}
                    className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a href={shareUrl(shareLink.token)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg">
                    Preview as karigar
                  </a>
                </div>
                <div className="grid grid-cols-3 text-xs text-emerald-800 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600">Expires</p>
                    <p className="font-medium">{formatDate(shareLink.expires_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600">Last opened</p>
                    <p className="font-medium">{shareLink.last_accessed_at ? formatDate(shareLink.last_accessed_at) : 'Not yet'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600">Downloads</p>
                    <p className="font-medium">{shareLink.download_count || 0}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => createOrRefreshLink(true, true)} disabled={shareBusy}
                    className="flex items-center gap-1.5 text-xs bg-[#1E3A5F] hover:bg-[#162B47] text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    <Send className="w-3.5 h-3.5" /> Re-send same link
                  </button>
                  <button onClick={() => createOrRefreshLink(false, false)} disabled={shareBusy}
                    className="flex items-center gap-1.5 text-xs bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Generate fresh 48h link
                  </button>
                  <button onClick={revokeLink} disabled={shareBusy}
                    className="flex items-center gap-1.5 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => createOrRefreshLink(true)} disabled={shareBusy}
                className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                <Send className="w-4 h-4" />
                {shareBusy ? 'Sending...' : 'Send karigar pack on WhatsApp'}
              </button>
            )}
            {shareToast && (
              <p className="text-xs mt-2 text-stone-600">{shareToast}</p>
            )}
          </div>

          {order.cad_files && order.cad_files.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">CAD &amp; design files</h2>
              <ul className="divide-y divide-stone-100">
                {order.cad_files.map((url: string, i: number) => {
                  const name = (order.cad_file_names || [])[i] || `file-${i + 1}`
                  return (
                    <li key={i} className="py-2 flex items-center gap-3">
                      <FileDown className="w-4 h-4 text-stone-400 shrink-0" />
                      <span className="flex-1 text-sm text-stone-700 truncate">{name}</span>
                      <a href={url} download={name} target="_blank" rel="noreferrer"
                        className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1 rounded-md">
                        Download
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {order.reference_images && order.reference_images.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-3">Reference images</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {order.reference_images.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden border border-stone-200 block">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {order.internal_notes && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-medium text-stone-900 mb-2">Internal notes</h2>
              <p className="text-sm text-stone-600 leading-relaxed">{order.internal_notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4">Update order</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={lbl}>Status</label>
                <select className={inp} value={form.status || ''} onChange={e => set('status', e.target.value)}>
                  {MFG_STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Description</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.description || ''} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Quantity</label>
                <input type="number" inputMode="decimal" min="1" className={inp} value={form.quantity || ''} onChange={e => set('quantity', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Ring size</label>
                <input className={inp} value={form.ring_size || ''} onChange={e => set('ring_size', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Gold karat</label>
                <select className={inp} value={form.gold_karat || '18'} onChange={e => set('gold_karat', e.target.value)}>
                  {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Gold weight required (g)</label>
                <input type="number" inputMode="decimal" step="0.01" className={inp} value={form.gold_weight_required || ''} onChange={e => set('gold_weight_required', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Gold weight actual (g)</label>
                <input type="number" inputMode="decimal" step="0.01" className={inp} value={form.gold_weight_actual || ''} onChange={e => set('gold_weight_actual', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Diamond weight (ct)</label>
                <input type="number" inputMode="decimal" step="0.01" className={inp} value={form.diamond_weight || ''} onChange={e => set('diamond_weight', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Labour rate (₹/g)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.labour_per_gram || ''} onChange={e => set('labour_per_gram', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Other charges (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.other_charges || '0'} onChange={e => set('other_charges', e.target.value)} />
              </div>

              {/* Cost preview */}
              {(labourAmount > 0 || otherCharges > 0) && (
                <div className="sm:col-span-2 bg-stone-50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between text-stone-500 mb-1">
                    <span>Labour ({effectiveWeight}g × ₹{form.labour_per_gram}/g)</span>
                    <span>₹{labourAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-stone-900">
                    <span>Total manufacturing cost</span>
                    <span className="text-[#1E3A5F]">₹{totalMfgCost.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <div>
                <label className={lbl}>Expected date</label>
                <input type="date" className={inp} value={form.expected_date || ''} onChange={e => set('expected_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Completed date</label>
                <input type="date" className={inp} value={form.completed_date || ''} onChange={e => set('completed_date', e.target.value)} />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
                  <input type="checkbox" checked={form.material_from_float || false}
                    onChange={e => set('material_from_float', e.target.checked)}
                    className="w-4 h-4 accent-[#1E3A5F]" />
                  Material from float
                </label>
              </div>
              <div>
                <label className={lbl}>Special notes</label>
                <input className={inp} value={form.special_notes || ''} onChange={e => set('special_notes', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Material notes</label>
                <input className={inp} value={form.material_notes || ''} onChange={e => set('material_notes', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Internal notes</label>
                <textarea className={`${inp} resize-none`} rows={2} value={form.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
