'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { ArrowLeft, Save, ArrowDown, ArrowUp, Package, Trash2 } from 'lucide-react'
import Link from 'next/link'

type InventoryTx = {
  id: string
  created_at: string
  transaction_type: string
  quantity: number
  rate_per_unit?: number
  total_value?: number
  reference?: string
  invoice_number?: string
  notes?: string
  date: string
  vendors?: { name: string }
  manufacturing_partners?: { name: string }
}

export default function InventoryItemPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

  const [item, setItem] = useState<any>(null)
  const [vendor, setVendor] = useState<any>(null)
  const [transactions, setTransactions] = useState<InventoryTx[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string; gstin?: string }[]>([])
  const [mfgPartners, setMfgPartners] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'receipt' | 'issue'>('receipt')
  const [editing, setEditing] = useState(false)
  const [computedStock, setComputedStock] = useState(0)

  const [form, setForm] = useState({
    quantity: '',
    rate_per_unit: '',
    vendor_id: '',
    manufacturing_partner_id: '',
    reference: '',
    invoice_number: '',
    invoice_date: '',
    hsn_code: '',
    gst_percentage: '3',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })

  const [editForm, setEditForm] = useState({
    name: '', category: '', unit: '', low_stock_alert: '',
    diamond_shape: '', diamond_quality: '', diamond_color: '', notes: '',
  })

  useEffect(() => { load() }, [itemId])

  async function load() {
    setLoading(true)
    const [{ data: i }, { data: txs }, { data: v }, { data: mp }] = await Promise.all([
      supabase.from('inventory').select('*, vendors(name, gstin, city)').eq('id', itemId).single(),
      supabase.from('inventory_transactions')
        .select('*, vendors(name), manufacturing_partners(name)')
        .eq('inventory_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('vendors').select('id, name, gstin').order('name'),
      supabase.from('manufacturing_partners').select('id, name').eq('status', 'active').order('name'),
    ])
    setItem(i)
    setVendor(i?.vendors)
    setTransactions(txs || [])
    setVendors(v || [])
    setMfgPartners(mp || [])

    // Compute stock from transactions
    const receipts = (txs || []).filter(t => ['receipt', 'return', 'adjustment'].includes(t.transaction_type))
      .reduce((sum, t) => sum + (t.quantity || 0), 0)
    const issues = (txs || []).filter(t => t.transaction_type === 'issue')
      .reduce((sum, t) => sum + (t.quantity || 0), 0)
    setComputedStock(receipts - issues)

    if (i) {
      setEditForm({
        name: i.name || '', category: i.category || '', unit: i.unit || '',
        low_stock_alert: String(i.low_stock_alert || ''),
        diamond_shape: i.diamond_shape || '', diamond_quality: i.diamond_quality || '',
        diamond_color: i.diamond_color || '', notes: i.notes || '',
      })
    }
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleTransaction() {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) { alert('Enter a valid quantity'); return }
    if (activeTab === 'receipt' && !form.vendor_id) { alert('Vendor is mandatory for receipts'); return }
    if (activeTab === 'issue' && qty > computedStock) {
      alert(`Cannot issue ${qty} — only ${computedStock.toFixed(3)} in stock`)
      return
    }

    setSaving(true)

    const rate = parseFloat(form.rate_per_unit) || 0
    const totalValue = qty * rate
    const gstPct = parseFloat(form.gst_percentage) || 0
    const gstAmount = totalValue * (gstPct / 100)
    const isInterstate = false // Simplified — can be enhanced with vendor state comparison

    const { error } = await supabase.from('inventory_transactions').insert([{
      inventory_id: itemId,
      transaction_type: activeTab,
      quantity: qty,
      rate_per_unit: rate || null,
      total_value: totalValue || null,
      vendor_id: form.vendor_id || null,
      manufacturing_partner_id: form.manufacturing_partner_id || null,
      reference: form.reference || null,
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      hsn_code: form.hsn_code || null,
      gst_percentage: gstPct || null,
      cgst_amount: !isInterstate ? gstAmount / 2 : null,
      sgst_amount: !isInterstate ? gstAmount / 2 : null,
      igst_amount: isInterstate ? gstAmount : null,
      total_with_gst: totalValue + gstAmount,
      notes: form.notes || null,
      date: form.date,
    }])

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Update avg purchase price if receipt
    if (activeTab === 'receipt' && rate > 0) {
      const newAvg = item.avg_purchase_price
        ? ((item.avg_purchase_price * (item.quantity_in_stock || 0)) + totalValue) / ((item.quantity_in_stock || 0) + qty)
        : rate
      await supabase.from('inventory').update({
        quantity_in_stock: computedStock + qty,
        avg_purchase_price: Math.round(newAvg * 100) / 100,
      }).eq('id', itemId)
    } else {
      // Update quantity for issues
      await supabase.from('inventory').update({
        quantity_in_stock: Math.max(0, computedStock - qty),
      }).eq('id', itemId)
    }

    setSaving(false)
    setForm(prev => ({ ...prev, quantity: '', reference: '', invoice_number: '', notes: '' }))
    load()
  }

  async function handleUpdateItem() {
    setSaving(true)
    await supabase.from('inventory').update({
      name: editForm.name,
      category: editForm.category,
      unit: editForm.unit,
      low_stock_alert: parseFloat(editForm.low_stock_alert) || null,
      diamond_shape: editForm.diamond_shape || null,
      diamond_quality: editForm.diamond_quality || null,
      diamond_color: editForm.diamond_color || null,
      notes: editForm.notes || null,
    }).eq('id', itemId)
    setSaving(false)
    setEditing(false)
    load()
  }

  async function handleDelete() {
    if (!confirm('Delete this inventory item and all its transaction history? This cannot be undone.')) return
    await supabase.from('inventory_transactions').delete().eq('inventory_id', itemId)
    await supabase.from('inventory').delete().eq('id', itemId)
    router.push('/vendors')
  }

  const isLow = item?.low_stock_alert && computedStock <= item.low_stock_alert
  const unitLabel = item?.unit === 'carats' ? 'ct' : item?.unit === 'grams' ? 'g' : ` ${item?.unit || ''}`

  if (loading) return <div className="p-4 sm:p-6 lg:p-16 text-secondary">Loading...</div>
  if (!item) return <div className="p-4 sm:p-6 lg:p-16 text-secondary">Item not found</div>

  return (
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32 max-w-3xl">
      <div className="flex items-center gap-4 mb-10">
        <Link href="/vendors" className="text-secondary hover:text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="display-sm">{item.name}</h1>
          <p className="text-secondary mt-1">
            {vendor?.name} · {item.category?.replace(/_/g, ' ')} · SKU: {item.sku || '—'}
          </p>
        </div>
        <button onClick={handleDelete} className="text-secondary hover:text-red-500 transition-colors p-2">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Stock summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
        <div className={`px-6 py-5 ${isLow ? 'bg-red-50' : 'bg-surface-low'}`}>
          <p className="label-md">Current stock</p>
          <p className={`display-sm mt-2 ${isLow ? 'text-red-600' : ''}`}>{computedStock.toFixed(3)}{unitLabel}</p>
          {isLow && <p className="text-xs text-red-500 mt-1">Below alert threshold</p>}
        </div>
        <div className="bg-surface-low px-6 py-5">
          <p className="label-md">Avg price</p>
          <p className="display-sm mt-2">₹{item.avg_purchase_price?.toFixed(0) || '—'}</p>
        </div>
        <div className="bg-surface-low px-6 py-5">
          <p className="label-md">Stock value</p>
          <p className="display-sm mt-2">₹{Math.round(computedStock * (item.avg_purchase_price || 0)).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-surface-low px-6 py-5">
          <p className="label-md">Transactions</p>
          <p className="display-sm mt-2">{transactions.length}</p>
        </div>
      </div>

      {/* Receipt / Issue form */}
      <div className="bg-surface-low p-6 mb-8">
        <div className="flex gap-0 mb-6 bg-surface-lowest">
          <button onClick={() => setActiveTab('receipt')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'receipt' ? 'bg-primary text-surface-lowest' : 'text-secondary hover:bg-surface-highest'}`}>
            Record Receipt (Purchase)
          </button>
          <button onClick={() => setActiveTab('issue')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'issue' ? 'bg-primary text-surface-lowest' : 'text-secondary hover:bg-surface-highest'}`}>
            Record Issue (to Mfg)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-md block mb-2">Quantity ({unitLabel}) *</label>
            <input type="number" step="0.001" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} placeholder="e.g. 5.000" />
            {activeTab === 'issue' && parseFloat(form.quantity) > computedStock && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Cannot exceed available stock ({computedStock.toFixed(3)}{unitLabel})
              </p>
            )}
          </div>
          <div>
            <label className="label-md block mb-2">Rate per {unitLabel} (₹)</label>
            <input type="number" value={form.rate_per_unit}
              onChange={e => set('rate_per_unit', e.target.value)} placeholder="Purchase rate" />
          </div>

          {activeTab === 'receipt' ? (
            <>
              <div>
                <label className="label-md block mb-2">Vendor *</label>
                <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.gstin ? ` (${v.gstin.substring(0,4)}...)` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label-md block mb-2">Invoice number</label>
                <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)}
                  placeholder="Vendor's invoice no." />
              </div>
              <div>
                <label className="label-md block mb-2">HSN code</label>
                <input value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)}
                  placeholder={item.category === 'gold' ? '7108' : item.category?.includes('diamond') ? '7102' : '—'} />
              </div>
              <div>
                <label className="label-md block mb-2">GST %</label>
                <select value={form.gst_percentage} onChange={e => set('gst_percentage', e.target.value)}>
                  <option value="0">0% (Exempt)</option>
                  <option value="0.25">0.25% (Rough diamonds)</option>
                  <option value="1.5">1.5% (Cut & polished diamonds)</option>
                  <option value="3">3% (Gold / precious metals)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18% (Making charges / services)</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="label-md block mb-2">Issued to (Mfg partner)</label>
              <select value={form.manufacturing_partner_id} onChange={e => set('manufacturing_partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {mfgPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label-md block mb-2">Reference</label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)}
              placeholder="Voucher / challan no." />
          </div>
          <div>
            <label className="label-md block mb-2">Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label-md block mb-2">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any additional details..." />
          </div>
        </div>

        {activeTab === 'receipt' && parseFloat(form.quantity) > 0 && parseFloat(form.rate_per_unit) > 0 && (
          <div className="bg-surface-lowest ghost-border p-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm text-secondary">
              <span>Subtotal ({form.quantity} × ₹{form.rate_per_unit})</span>
              <span>₹{(parseFloat(form.quantity) * parseFloat(form.rate_per_unit)).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm text-secondary">
              <span>GST ({form.gst_percentage}%)</span>
              <span>₹{Math.round(parseFloat(form.quantity) * parseFloat(form.rate_per_unit) * parseFloat(form.gst_percentage) / 100).toLocaleString('en-IN')}</span>
            </div>
            <div className="border-t ghost-border pt-2 flex justify-between text-sm font-medium text-primary">
              <span>Total with GST</span>
              <span>₹{Math.round(parseFloat(form.quantity) * parseFloat(form.rate_per_unit) * (1 + parseFloat(form.gst_percentage) / 100)).toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        <button onClick={handleTransaction} disabled={saving}
          className="w-full mt-6 bg-primary text-surface-lowest py-4 text-sm font-medium hover:bg-surface-highest hover:text-primary disabled:opacity-40 transition-colors">
          {saving ? 'Saving...' : activeTab === 'receipt' ? 'Record purchase receipt' : 'Record issue'}
        </button>
      </div>

      {/* Transaction history */}
      <div className="bg-surface-lowest ghost-border overflow-hidden">
        <div className="px-6 py-4 border-b ghost-border bg-surface-low">
          <h2 className="headline-md">Transaction ledger</h2>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-sm text-secondary text-center">No transactions yet — record a procurement receipt to start</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-low transition-colors">
                <div className="w-8 h-8 bg-surface-low flex items-center justify-center shrink-0">
                  {t.transaction_type === 'receipt' && <ArrowDown className="w-4 h-4 text-green-600" />}
                  {t.transaction_type === 'issue' && <ArrowUp className="w-4 h-4 text-red-500" />}
                  {t.transaction_type === 'return' && <ArrowDown className="w-4 h-4 text-blue-500" />}
                  {t.transaction_type === 'adjustment' && <Package className="w-4 h-4 text-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary capitalize">{t.transaction_type}</p>
                  <p className="text-xs text-secondary truncate">
                    {t.transaction_type === 'receipt' && t.vendors?.name}
                    {t.transaction_type === 'issue' && t.manufacturing_partners?.name}
                    {t.invoice_number && ` · Inv: ${t.invoice_number}`}
                    {t.reference && ` · ${t.reference}`}
                    {t.notes && ` · ${t.notes}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    t.transaction_type === 'issue' ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {t.transaction_type === 'issue' ? '-' : '+'}{t.quantity?.toFixed(3)}{unitLabel}
                  </p>
                  <p className="text-xs text-secondary">{formatDate(t.date)}</p>
                  {t.total_value && <p className="text-xs text-outline-variant">₹{Math.round(t.total_value).toLocaleString('en-IN')}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
