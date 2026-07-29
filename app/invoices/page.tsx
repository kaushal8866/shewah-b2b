'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { FileText, Search, X, AlertTriangle, Download, Trash2, Calendar, FileCheck2, User, Plus, Edit2, Save, ArrowRight } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function InvoicesPage() {
  const { data: session } = useSession()
  const isMaster = session?.user?.role === 'master'

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Details and edit states
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Standalone creation states
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<any>({
    invoice_date: new Date().toISOString().split('T')[0],
    buyer_name: '',
    buyer_gstin: '',
    buyer_address: '',
    buyer_state: 'Gujarat',
    invoice_type: 'order',
    tax_treatment: 'inclusive',
    items: [{ description: '', hsn_code: '7113', qty: 1, unit: 'pcs', rate: 0, amount: 0 }]
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Cancel invoice states
  const [cancelTarget, setCancelTarget] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Hard delete states
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/invoices')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to fetch invoices')
      setInvoices(d.invoices || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle Edit/Update
  async function handleUpdateInvoice() {
    if (!editForm.buyer_name || !editForm.buyer_state || !editForm.invoice_date) {
      setEditError('Recipient Name, State, and Date are required.')
      return
    }

    setSavingEdit(true)
    setEditError('')
    try {
      const r = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: editForm.buyer_name,
          buyer_address: editForm.buyer_address || null,
          buyer_gstin: editForm.buyer_gstin || null,
          buyer_state: editForm.buyer_state,
          invoice_date: editForm.invoice_date,
        })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to update invoice')

      setSelectedInvoice(null)
      setEditForm(null)
      load()
    } catch (e: any) {
      setEditError(e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle Void/Cancel
  async function handleCancelInvoice() {
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason.')
      return
    }

    setCancelling(true)
    setCancelError('')
    try {
      const r = await fetch(`/api/invoices/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to cancel invoice')
      
      setCancelTarget(null)
      setCancelReason('')
      load()
    } catch (e: any) {
      setCancelError(e.message)
    } finally {
      setCancelling(false)
    }
  }

  // Handle Hard Delete
  async function handleDeleteInvoice() {
    setDeleting(true)
    setDeleteError('')
    try {
      const r = await fetch(`/api/invoices/${deleteTarget.id}`, {
        method: 'DELETE'
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to delete invoice')

      setDeleteTarget(null)
      setSelectedInvoice(null)
      load()
    } catch (e: any) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  // Handle Standalone Create
  async function handleCreateStandalone() {
    if (!createForm.buyer_name || !createForm.buyer_state || !createForm.invoice_date) {
      setCreateError('Recipient Name, State, and Date are required.')
      return
    }

    const validItems = createForm.items.filter((it: any) => it.description.trim() && Number(it.qty) > 0)
    if (validItems.length === 0) {
      setCreateError('Please add at least one item with description and quantity.')
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      const processedItems = validItems.map((it: any) => ({
        description: it.description,
        hsn_code: it.hsn_code,
        qty: Number(it.qty),
        unit: it.unit,
        rate: Number(it.rate),
        amount: Number(it.qty) * Number(it.rate)
      }))

      const r = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_type: createForm.invoice_type,
          target_id: 'standalone',
          tax_treatment: createForm.tax_treatment,
          items: processedItems,
          buyer_details: {
            buyer_name: createForm.buyer_name,
            buyer_address: createForm.buyer_address || null,
            buyer_gstin: createForm.buyer_gstin || null,
            buyer_state: createForm.buyer_state,
          },
          invoice_date: createForm.invoice_date,
        })
      })

      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to generate standalone invoice')

      setCreateOpen(false)
      setCreateForm({
        invoice_date: new Date().toISOString().split('T')[0],
        buyer_name: '',
        buyer_gstin: '',
        buyer_address: '',
        buyer_state: 'Gujarat',
        invoice_type: 'order',
        tax_treatment: 'inclusive',
        items: [{ description: '', hsn_code: '7113', qty: 1, unit: 'pcs', rate: 0, amount: 0 }]
      })
      load()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const filtered = invoices.filter(inv => {
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.buyer_gstin && inv.buyer_gstin.toLowerCase().includes(search.toLowerCase()))

    const matchType = typeFilter === 'all' || inv.invoice_type === typeFilter
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter

    return matchSearch && matchType && matchStatus
  })

  // Calculation summaries
  const summaries = filtered.reduce((acc, inv) => {
    if (inv.status === 'active') {
      acc.subtotal += Number(inv.subtotal_amount)
      acc.tax += Number(inv.total_tax)
      acc.total += Number(inv.grand_total)
    }
    return acc
  }, { subtotal: 0, tax: 0, total: 0 })

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white text-stone-800"

  return (
    <div className="p-4 lg:p-7 relative min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-stone-800" />
            GST Tax Invoices
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">Audit log of all tax invoices generated for retail partners and customers</p>
        </div>
        {isMaster && (
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-stone-800 text-white hover:bg-stone-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Create Standalone Invoice
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Active Taxable Subtotal</p>
          <p className="text-xl font-semibold mt-0.5 text-stone-900">₹{summaries.subtotal.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Active Total GST Collected</p>
          <p className="text-xl font-semibold mt-0.5 text-green-600">₹{summaries.tax.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-400">Active Invoice Total (Incl. Taxes)</p>
          <p className="text-xl font-semibold mt-0.5 text-stone-800">₹{summaries.total.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search by invoice no, store/buyer name, or GSTIN..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white outline-none text-stone-800" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none text-stone-800">
          <option value="all">All types</option>
          <option value="order">Jewellery Order</option>
          <option value="diamond_trade">Loose Diamond Trade</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none text-stone-800">
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-stone-400">Loading invoices...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-stone-400">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-xs text-stone-400 font-medium uppercase">
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Buyer (Recipient)</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Taxable Amt</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total (Incl. Tax)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50 text-sm">
                {filtered.map(inv => {
                  const isCancelled = inv.status === 'cancelled'
                  return (
                    <tr key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv)
                        setEditForm({
                          buyer_name: inv.buyer_name,
                          buyer_address: inv.buyer_address || '',
                          buyer_gstin: inv.buyer_gstin || '',
                          buyer_state: inv.buyer_state,
                          invoice_date: inv.invoice_date,
                        })
                      }}
                      className={`hover:bg-stone-50 transition-colors cursor-pointer ${isCancelled ? 'opacity-60 bg-stone-50/50' : ''}`}>
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-stone-900">{inv.invoice_number}</p>
                          {isCancelled && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              CANCELLED
                            </span>
                          )}
                        </div>
                        {inv.invoice_type === 'order' && (
                          <p className="text-[10px] text-stone-400 font-mono">Order: {inv.orders?.order_number || '—'}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-stone-600">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-stone-900">{inv.buyer_name}</p>
                        <p className="text-xs text-stone-400">
                          {inv.buyer_gstin ? `GST: ${inv.buyer_gstin}` : 'Consumer / Unregistered'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${inv.invoice_type === 'diamond_trade' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                          {inv.invoice_type === 'diamond_trade' ? 'Loose Diamond' : 'Jewellery'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-stone-700">
                        ₹{Number(inv.subtotal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-stone-600">
                        <p>₹{Number(inv.total_tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {inv.igst_amount > 0 ? (
                          <p className="text-[10px] text-stone-400">IGST {inv.igst_rate}%</p>
                        ) : (
                          <p className="text-[10px] text-stone-400">CGST/SGST {inv.cgst_rate}%</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-stone-950">
                        ₹{Number(inv.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1 text-xs border border-stone-200 bg-white">
                            <Download className="w-3.5 h-3.5" /> PDF
                          </a>
                          {!isCancelled && (
                            <button onClick={() => setCancelTarget(inv)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs border border-red-200 bg-white">
                              <Trash2 className="w-3.5 h-3.5" /> Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selectedInvoice && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-semibold text-stone-900 text-lg">Tax Invoice Details</h3>
                <p className="text-xs text-stone-500">Invoice Reference: {selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => { setSelectedInvoice(null); setEditForm(null); setEditError('') }}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View vs Edit form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Recipient Name (Buyer)</label>
                {isMaster ? (
                  <input type="text" className={inp} value={editForm.buyer_name}
                    onChange={e => setEditForm({ ...editForm, buyer_name: e.target.value })} />
                ) : (
                  <p className="text-sm text-stone-800 font-medium py-1.5">{selectedInvoice.buyer_name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Invoice Date</label>
                {isMaster ? (
                  <input type="date" className={inp} value={editForm.invoice_date}
                    onChange={e => setEditForm({ ...editForm, invoice_date: e.target.value })} />
                ) : (
                  <p className="text-sm text-stone-800 py-1.5">{formatDate(selectedInvoice.invoice_date)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Buyer GSTIN</label>
                {isMaster ? (
                  <input type="text" className={inp} value={editForm.buyer_gstin}
                    onChange={e => setEditForm({ ...editForm, buyer_gstin: e.target.value })} placeholder="Consumer / Unregistered" />
                ) : (
                  <p className="text-sm text-stone-800 py-1.5">{selectedInvoice.buyer_gstin || 'Consumer / Unregistered'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Buyer State</label>
                {isMaster ? (
                  <input type="text" className={inp} value={editForm.buyer_state}
                    onChange={e => setEditForm({ ...editForm, buyer_state: e.target.value })} />
                ) : (
                  <p className="text-sm text-stone-800 py-1.5">{selectedInvoice.buyer_state}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1">Billing Address</label>
                {isMaster ? (
                  <textarea className={`${inp} resize-none`} rows={2} value={editForm.buyer_address}
                    onChange={e => setEditForm({ ...editForm, buyer_address: e.target.value })} />
                ) : (
                  <p className="text-sm text-stone-800 py-1.5 whitespace-pre-wrap">{selectedInvoice.buyer_address || '—'}</p>
                )}
              </div>
            </div>

            {/* Line Items Snapshot */}
            <div className="border border-stone-200 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                  <tr>
                    <th className="px-3 py-2">Item Description</th>
                    <th className="px-3 py-2 text-center">HSN</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-center">Unit</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {selectedInvoice.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 font-medium">{it.description}</td>
                      <td className="px-3 py-2.5 text-center font-mono">{it.hsn_code}</td>
                      <td className="px-3 py-2.5 text-right">{it.qty}</td>
                      <td className="px-3 py-2.5 text-center">{it.unit}</td>
                      <td className="px-3 py-2.5 text-right">₹{Number(it.rate).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right">₹{Number(it.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Preview */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs grid grid-cols-2 gap-y-2">
              <span className="text-stone-500">Taxable Subtotal:</span>
              <span className="text-right font-medium text-stone-800">₹{Number(selectedInvoice.subtotal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              
              {selectedInvoice.igst_amount > 0 ? (
                <>
                  <span className="text-stone-500">IGST ({selectedInvoice.igst_rate}%):</span>
                  <span className="text-right font-medium text-stone-800">₹{Number(selectedInvoice.igst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </>
              ) : (
                <>
                  <span className="text-stone-500">CGST ({selectedInvoice.cgst_rate}%):</span>
                  <span className="text-right font-medium text-stone-800">₹{Number(selectedInvoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-stone-500">SGST ({selectedInvoice.sgst_rate}%):</span>
                  <span className="text-right font-medium text-stone-800">₹{Number(selectedInvoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </>
              )}

              <span className="font-bold text-stone-900 border-t border-stone-200 pt-2 mt-1">Invoice Grand Total:</span>
              <span className="text-right font-bold text-stone-800 border-t border-stone-200 pt-2 mt-1 text-sm">₹{Number(selectedInvoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}

            <div className="flex flex-wrap gap-3 pt-3 border-t border-stone-100">
              {isMaster && (
                <>
                  <button onClick={() => setDeleteTarget(selectedInvoice)}
                    className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Delete Permanently
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => { setSelectedInvoice(null); setEditForm(null); setEditError('') }}
                    className="px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-sm hover:bg-stone-50">
                    Cancel
                  </button>
                  <button onClick={handleUpdateInvoice} disabled={savingEdit}
                    className="px-5 py-2 bg-stone-800 text-white rounded-xl text-sm font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    <Save className="w-4 h-4" /> {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel/Void Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Cancel Tax Invoice?</h3>
                <p className="text-sm text-stone-500 mt-1">
                  You are about to cancel invoice <strong>{cancelTarget.invoice_number}</strong>. This action marks the invoice as voided for auditing but keeps the record in the logs.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Reason for cancellation *</label>
              <textarea className={`${inp} resize-none`} rows={3} placeholder="e.g. Typo in values, customer return"
                value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>

            {cancelError && <p className="text-xs text-red-600 font-medium">{cancelError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(''); setCancelError('') }}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Back
              </button>
              <button onClick={handleCancelInvoice} disabled={cancelling}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Delete Invoice Permanently?</h3>
                <p className="text-sm text-stone-500 mt-1 font-medium text-red-600">
                  Warning: Deleting invoice {deleteTarget.invoice_number} will completely remove it from the database and release the sequence number slot. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && <p className="text-xs text-red-600 font-medium">{deleteError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={handleDeleteInvoice} disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Standalone Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-semibold text-stone-900 text-lg">Create Standalone Custom Invoice</h3>
              <button onClick={() => setCreateOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Recipient Name (Buyer) *</label>
                <input type="text" className={inp} value={createForm.buyer_name}
                  onChange={e => setCreateForm({ ...createForm, buyer_name: e.target.value })} placeholder="e.g. Sat Jewels" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Invoice Date *</label>
                <input type="date" className={inp} value={createForm.invoice_date}
                  onChange={e => setCreateForm({ ...createForm, invoice_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Buyer GSTIN (Optional)</label>
                <input type="text" className={inp} value={createForm.buyer_gstin}
                  onChange={e => setCreateForm({ ...createForm, buyer_gstin: e.target.value })} placeholder="Leave blank for unregistered" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Buyer State *</label>
                <input type="text" className={inp} value={createForm.buyer_state}
                  onChange={e => setCreateForm({ ...createForm, buyer_state: e.target.value })} placeholder="e.g. Gujarat" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1">Billing Address</label>
                <textarea className={`${inp} resize-none`} rows={2} value={createForm.buyer_address}
                  onChange={e => setCreateForm({ ...createForm, buyer_address: e.target.value })} placeholder="Full billing address..." />
              </div>
            </div>

            {/* Invoicing configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Invoice Type</label>
                <select value={createForm.invoice_type}
                  onChange={e => setCreateForm({ ...createForm, invoice_type: e.target.value })}
                  className={inp}>
                  <option value="order">Jewellery Invoice (3% GST)</option>
                  <option value="diamond_trade">Loose Diamond Invoice (0.25% GST)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Tax Treatment</label>
                <select value={createForm.tax_treatment}
                  onChange={e => setCreateForm({ ...createForm, tax_treatment: e.target.value })}
                  className={inp}>
                  <option value="inclusive">Tax Inclusive (Prices include GST)</option>
                  <option value="exclusive">Tax Exclusive (GST added on top)</option>
                </select>
              </div>
            </div>

            {/* Items Editor */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-stone-500">Line Items</label>
                <button type="button"
                  onClick={() => setCreateForm({
                    ...createForm,
                    items: [...createForm.items, { description: '', hsn_code: createForm.invoice_type === 'diamond_trade' ? '7102' : '7113', qty: 1, unit: 'pcs', rate: 0, amount: 0 }]
                  })}
                  className="text-xs text-stone-800 hover:underline flex items-center gap-1 font-semibold">
                  + Add Line Item
                </button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-stone-200 rounded-xl p-3 bg-stone-50">
                {createForm.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input type="text" placeholder="Description of goods..." className="flex-2 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-stone-800 outline-none focus:border-stone-800"
                      value={it.description} onChange={e => {
                        const newItems = [...createForm.items]
                        newItems[idx].description = e.target.value
                        setCreateForm({ ...createForm, items: newItems })
                      }} />
                    
                    <input type="text" placeholder="HSN" className="w-16 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-stone-800 text-center outline-none focus:border-stone-800"
                      value={it.hsn_code} onChange={e => {
                        const newItems = [...createForm.items]
                        newItems[idx].hsn_code = e.target.value
                        setCreateForm({ ...createForm, items: newItems })
                      }} />
                    
                    <input type="number" placeholder="Qty" className="w-16 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-stone-800 text-right outline-none focus:border-stone-800"
                      value={it.qty} onChange={e => {
                        const newItems = [...createForm.items]
                        newItems[idx].qty = Number(e.target.value) || 0
                        newItems[idx].amount = newItems[idx].qty * newItems[idx].rate
                        setCreateForm({ ...createForm, items: newItems })
                      }} />
                    
                    <select className="w-20 border border-stone-200 rounded-lg px-2 py-1.5 text-xs bg-white text-stone-800 outline-none focus:border-stone-800"
                      value={it.unit} onChange={e => {
                        const newItems = [...createForm.items]
                        newItems[idx].unit = e.target.value
                        setCreateForm({ ...createForm, items: newItems })
                      }}>
                      <option value="pcs">pcs</option>
                      <option value="grams">grams</option>
                      <option value="carats">carats</option>
                    </select>

                    <input type="number" placeholder="Rate" className="w-24 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-stone-800 text-right outline-none focus:border-stone-800"
                      value={it.rate} onChange={e => {
                        const newItems = [...createForm.items]
                        newItems[idx].rate = Number(e.target.value) || 0
                        newItems[idx].amount = newItems[idx].qty * newItems[idx].rate
                        setCreateForm({ ...createForm, items: newItems })
                      }} />
                    
                    <span className="w-24 text-right text-xs font-semibold text-stone-800">
                      ₹{Math.round((it.qty * it.rate) * 100) / 100}
                    </span>

                    {createForm.items.length > 1 && (
                      <button type="button" onClick={() => {
                        const newItems = createForm.items.filter((_: any, i: number) => i !== idx)
                        setCreateForm({ ...createForm, items: newItems })
                      }}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-stone-100 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Calculations Preview */}
            {(() => {
              const standardRate = createForm.invoice_type === 'diamond_trade' ? 0.25 : 3.0
              const isSameState = createForm.buyer_state?.toLowerCase().trim() === 'gujarat'
              const subTotalSum = createForm.items.reduce((sum: number, it: any) => sum + (Number(it.qty) * Number(it.rate)), 0)

              let subtotalAmount = subTotalSum
              let totalTax = 0
              let grandTotal = subTotalSum

              if (createForm.tax_treatment === 'inclusive') {
                grandTotal = subTotalSum
                subtotalAmount = subTotalSum / (1 + standardRate / 100)
                totalTax = grandTotal - subtotalAmount
              } else {
                subtotalAmount = subTotalSum
                totalTax = subtotalAmount * (standardRate / 100)
                grandTotal = subTotalSum + totalTax
              }

              subtotalAmount = Math.round(subtotalAmount * 100) / 100
              totalTax = Math.round(totalTax * 100) / 100
              grandTotal = Math.round(grandTotal * 100) / 100

              const taxLabel = isSameState
                ? `CGST (${standardRate / 2}%) + SGST (${standardRate / 2}%)`
                : `IGST (${standardRate}%)`

              return (
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between text-stone-500">
                    <span>Taxable Subtotal:</span>
                    <span>₹{subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>{taxLabel}:</span>
                    <span>₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-1 text-sm">
                    <span>Grand Total:</span>
                    <span className="text-stone-800">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )
            })()}

            {createError && <p className="text-xs text-red-600 font-medium">{createError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={handleCreateStandalone} disabled={creating}
                className="flex-1 bg-stone-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> {creating ? 'Generating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
