'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Layers, Plus, Activity, Search, Calendar, Coins, CheckCircle, Info,
  TrendingUp, TrendingDown, RefreshCw, AlertCircle, AlertTriangle, HelpCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { KARAT_FACTORS } from '@/lib/karat'

export default function PurchaseLotsPage() {
  const { data: session } = useSession()
  const role = session?.user?.role || 'sub'
  const isMaster = role === 'master'

  const [activeTab, setActiveTab] = useState<'add' | 'inventory' | 'replenishment'>('add')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Latest 24K Rate
  const [rate24k, setRate24k] = useState<number>(6000)

  // Recent Cash Transactions for linking
  const [cashTxns, setCashTxns] = useState<any[]>([])

  // --- Add Lot Form State ---
  const [form, setForm] = useState({
    material_type: 'gold_24k',
    purchase_date: new Date().toLocaleDateString('en-CA'),
    total_qty: '', // weight/carats/pcs
    unit_cost: '', // cost per unit
    total_paid: '', // calculated or entered
    gold_karat: '22K',
    diamond_shape: 'Round',
    diamond_color: 'G',
    diamond_clarity: 'VS2',
    diamond_size_carat: '',
    diamond_is_certified: false,
    diamond_cert_number: '',
    diamond_cert_lab: 'IGI',
    diamond_piece_count: '',
    finding_type: 'clasp',
    finding_description: '',
    supplier_name: '',
    invoice_reference: '',
    notes: '',
    linked_cash_txn_id: ''
  })

  // --- Replenishment Offset Modal State ---
  const [showOffsetModal, setShowOffsetModal] = useState(false)
  const [newLotId, setNewLotId] = useState<string | null>(null)
  const [offsetPreview, setOffsetPreview] = useState<any>(null)
  const [confirmingOffset, setConfirmingOffset] = useState(false)

  // --- Lot Inventory State ---
  const [lots, setLots] = useState<any[]>([])
  const [loadingLots, setLoadingLots] = useState(false)

  // --- Replenishment State ---
  const [obligations, setObligations] = useState<any[]>([])
  const [offsets, setOffsets] = useState<any[]>([])
  const [mtdVariance, setMtdVariance] = useState(0)
  const [loadingReplenishment, setLoadingReplenishment] = useState(false)

  // Fetch today's gold rate
  useEffect(() => {
    async function fetchRate() {
      const { data, error } = await supabase
        .from('gold_rates')
        .select('rate_24k')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data && data.rate_24k) {
        setRate24k(Number(data.rate_24k))
      }
    }
    fetchRate()
  }, [])

  // Fetch recent cash transactions to populate linking dropdown
  useEffect(() => {
    async function fetchCash() {
      const { data } = await supabase
        .from('cash_transactions')
        .select('id, txn_number, amount, txn_date, txn_type, note')
        .eq('is_void', false)
        .order('txn_date', { ascending: false })
        .limit(30)
      if (data) setCashTxns(data)
    }
    fetchCash()
  }, [activeTab])

  // Calculate Unit Cost / Total Paid automatically in Form
  useEffect(() => {
    const qty = parseFloat(form.total_qty) || 0
    const paid = parseFloat(form.total_paid) || 0
    const cost = parseFloat(form.unit_cost) || 0

    // Auto-calculate unit_cost if paid is provided, and vice versa
    if (form.material_type.startsWith('gold_') || form.material_type.startsWith('silver_')) {
      if (qty > 0 && paid > 0 && document.activeElement?.id === 'total_paid') {
        const computedCost = parseFloat((paid / qty).toFixed(4))
        setForm(f => ({ ...f, unit_cost: computedCost.toString() }))
      } else if (qty > 0 && cost > 0 && document.activeElement?.id === 'unit_cost') {
        const computedPaid = parseFloat((qty * cost).toFixed(2))
        setForm(f => ({ ...f, total_paid: computedPaid.toString() }))
      }
    } else {
      // For diamonds & findings
      if (qty > 0 && cost > 0) {
        const computedPaid = parseFloat((qty * cost).toFixed(2))
        if (form.total_paid !== computedPaid.toString()) {
          setForm(f => ({ ...f, total_paid: computedPaid.toString() }))
        }
      }
    }
  }, [form.total_qty, form.total_paid, form.unit_cost, form.material_type])

  // Load active lots
  const loadLots = async () => {
    setLoadingLots(true)
    try {
      const res = await fetch('/api/purchase-lots?status=active')
      if (res.ok) {
        const payload = await res.json()
        setLots(payload.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLots(false)
    }
  }

  // Load replenishment dashboard data
  const loadReplenishment = async () => {
    if (!isMaster) return
    setLoadingReplenishment(true)
    try {
      const res = await fetch('/api/replenishment')
      if (res.ok) {
        const payload = await res.json()
        setObligations(payload.obligations || [])
        setOffsets(payload.offsets || [])
        setMtdVariance(payload.mtd_variance || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReplenishment(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadLots()
    } else if (activeTab === 'replenishment') {
      loadReplenishment()
    }
  }, [activeTab])

  // Handle Lot Submission
  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.total_qty || !form.unit_cost) {
      setErrorMsg('Please input quantity and unit cost.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/purchase-lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save purchase lot.')
      }

      // If replenishment offset preview returned
      if (payload.preview && isMaster) {
        setNewLotId(payload.lot.id)
        setOffsetPreview(payload.preview)
        setShowOffsetModal(true)
      } else {
        setSuccessMsg(`Lot created successfully: ${payload.lot.lot_number}`)
        resetForm()
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Confirm Replenishment Offset
  const handleConfirmOffset = async () => {
    if (!newLotId) return
    setConfirmingOffset(true)
    try {
      const res = await fetch(`/api/purchase-lots/${newLotId}/offset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true })
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to complete offset')
      
      setSuccessMsg(`Lot created and replenishment offset executed! Realized Variance: ${formatCurrency(payload.total_delta)}`)
      setShowOffsetModal(false)
      resetForm()
    } catch (err: any) {
      setErrorMsg(`Lot saved, but offset execution failed: ${err.message}`)
      setShowOffsetModal(false)
    } finally {
      setConfirmingOffset(false)
    }
  }

  const resetForm = () => {
    setForm(f => ({
      ...f,
      total_qty: '',
      unit_cost: '',
      total_paid: '',
      notes: '',
      linked_cash_txn_id: '',
      supplier_name: '',
      invoice_reference: ''
    }))
  }

  // Group inventory lots by material type
  const goldLots = lots.filter(l => l.material_type === 'gold_24k')
  const silverLots = lots.filter(l => ['silver_925', 'silver_999'].includes(l.material_type))
  const diamondLots = lots.filter(l => ['diamond_lgd', 'diamond_natural'].includes(l.material_type))
  const findingLots = lots.filter(l => l.material_type === 'finding')

  // Sums for Inventory overview
  const totalGoldPureQty = goldLots.reduce((sum, l) => sum + Number(l.remaining_qty), 0)
  const totalGoldBookValue = goldLots.reduce((sum, l) => sum + Number(l.remaining_qty) * Number(l.unit_cost), 0)
  const totalGoldMarketValue = totalGoldPureQty * rate24k
  const goldUnrealizedGain = totalGoldMarketValue - totalGoldBookValue

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-200 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1E3A5F] to-[#2E5E8A] flex items-center justify-center text-white shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Purchase Lots Ledger</h1>
            <p className="text-stone-500 text-sm mt-0.5">Manage material costs, FIFO issuances, and gold replacement variances</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border border-stone-200 rounded-lg p-0.5 bg-stone-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('add')}
            className={cn("px-4 py-1.5 rounded-md transition-colors", activeTab === 'add' ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900")}
          >
            Add Lot
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={cn("px-4 py-1.5 rounded-md transition-colors", activeTab === 'inventory' ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900")}
          >
            Lot Inventory
          </button>
          {isMaster && (
            <button
              onClick={() => setActiveTab('replenishment')}
              className={cn("px-4 py-1.5 rounded-md transition-colors", activeTab === 'replenishment' ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900")}
            >
              Gold Replenishment
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- TAB 1: ADD LOT --- */}
      {activeTab === 'add' && (
        <form onSubmit={handleSaveLot} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs max-w-4xl space-y-6">
          <h2 className="text-base font-bold text-stone-900">Record New Purchase Lot</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Material Type</label>
              <select
                value={form.material_type}
                onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}
                className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
              >
                <option value="gold_24k">Gold (24K equivalent)</option>
                <option value="silver_925">Silver 925</option>
                <option value="silver_999">Silver 999</option>
                <option value="diamond_lgd">Lab Grown Diamond (LGD)</option>
                <option value="diamond_natural">Natural Diamond</option>
                <option value="finding">Finding / Accessory</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">Purchase Date</label>
              <input
                type="date"
                required
                value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
              />
            </div>
          </div>

          {/* DYNAMIC FORM SEGMENTS */}
          {/* 1. Gold Segment */}
          {form.material_type === 'gold_24k' && (
            <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/10 space-y-4">
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Gold Costing Inputs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Original Karat</label>
                  <select
                    value={form.gold_karat}
                    onChange={e => setForm(f => ({ ...f, gold_karat: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  >
                    <option value="24K">24K (99.9%)</option>
                    <option value="22K">22K (91.6%)</option>
                    <option value="18K">18K (75.0%)</option>
                    <option value="14K">14K (60.0%)</option>
                    <option value="9K">9K (38.0%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    placeholder="0.0000"
                    value={form.total_qty}
                    onChange={e => setForm(f => ({ ...f, total_qty: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Total Paid (₹)</label>
                  <input
                    id="total_paid"
                    type="number"
                    step="0.01"
                    required
                    placeholder="₹ Paid"
                    value={form.total_paid}
                    onChange={e => setForm(f => ({ ...f, total_paid: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none font-semibold text-stone-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Gross Unit Cost (₹/g)</label>
                  <input
                    id="unit_cost"
                    type="number"
                    step="0.0001"
                    placeholder="Auto-calculated"
                    value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 text-stone-500 outline-none"
                  />
                </div>
              </div>

              {form.total_qty && (
                <div className="text-xs text-amber-700 flex items-center gap-1.5 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Purity Lens:</strong> Karat purity factor is <strong>{KARAT_FACTORS[parseInt(form.gold_karat.replace(/[^\d]/g, '')) || 24]}</strong>. Original gross weight <strong>{form.total_qty}g</strong> converts to <strong>{(Number(form.total_qty) * (KARAT_FACTORS[parseInt(form.gold_karat.replace(/[^\d]/g, '')) || 24])).toFixed(4)}g</strong> of 24K equivalent, costed at <strong>{formatCurrency(Number(form.total_paid) / (Number(form.total_qty) * (KARAT_FACTORS[parseInt(form.gold_karat.replace(/[^\d]/g, '')) || 24])))}/g (pure)</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 2. Silver Segment */}
          {['silver_925', 'silver_999'].includes(form.material_type) && (
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/20 space-y-4">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Silver Costing Inputs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Weight (g)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    placeholder="0.0000"
                    value={form.total_qty}
                    onChange={e => setForm(f => ({ ...f, total_qty: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Total Paid (₹)</label>
                  <input
                    id="total_paid"
                    type="number"
                    step="0.01"
                    required
                    placeholder="₹ Paid"
                    value={form.total_paid}
                    onChange={e => setForm(f => ({ ...f, total_paid: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none font-semibold text-stone-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Unit Cost (₹/g)</label>
                  <input
                    id="unit_cost"
                    type="number"
                    step="0.0001"
                    placeholder="Auto-calculated"
                    value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 text-stone-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Diamond Segment */}
          {['diamond_lgd', 'diamond_natural'].includes(form.material_type) && (
            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/10 space-y-4">
              <h3 className="text-xs font-bold text-sky-800 uppercase tracking-wider">Diamond FIFO Parameters</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Shape</label>
                  <select
                    value={form.diamond_shape}
                    onChange={e => setForm(f => ({ ...f, diamond_shape: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  >
                    <option value="Round">Round</option>
                    <option value="Oval">Oval</option>
                    <option value="Princess">Princess</option>
                    <option value="Cushion">Cushion</option>
                    <option value="Emerald">Emerald</option>
                    <option value="Pear">Pear</option>
                    <option value="Marquise">Marquise</option>
                    <option value="Radiant">Radiant</option>
                    <option value="Asscher">Asscher</option>
                    <option value="Heart">Heart</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Color</label>
                  <select
                    value={form.diamond_color}
                    onChange={e => setForm(f => ({ ...f, diamond_color: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  >
                    {['D','E','F','G','H','I','J','K'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Clarity</label>
                  <select
                    value={form.diamond_clarity}
                    onChange={e => setForm(f => ({ ...f, diamond_clarity: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  >
                    {['IF','VVS1','VVS2','VS1','VS2','SI1','SI2','I1'].map(cl => <option key={cl} value={cl}>{cl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Single Stone Size (ct)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.35"
                    value={form.diamond_size_carat}
                    onChange={e => setForm(f => ({ ...f, diamond_size_carat: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Total Carat Weight</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.000"
                    value={form.total_qty}
                    onChange={e => setForm(f => ({ ...f, total_qty: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Piece Count (Stones)</label>
                  <input
                    type="number"
                    placeholder="Stones count"
                    value={form.diamond_piece_count}
                    onChange={e => setForm(f => ({ ...f, diamond_piece_count: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Price per Carat (₹/ct)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Price per carat"
                    value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none font-semibold text-stone-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Total Paid (₹)</label>
                  <input
                    type="number"
                    readOnly
                    placeholder="Auto-calculated"
                    value={form.total_paid}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 text-stone-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 border-t border-sky-100/50 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.diamond_is_certified}
                    onChange={e => setForm(f => ({ ...f, diamond_is_certified: e.target.checked }))}
                    className="w-4 h-4 rounded border-stone-300 text-sky-600 focus:ring-sky-500 bg-white"
                  />
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Certified Diamond (Overrides FIFO)</span>
                </label>

                {form.diamond_is_certified && (
                  <div className="flex gap-4 flex-1">
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        placeholder="Certificate Number"
                        value={form.diamond_cert_number}
                        onChange={e => setForm(f => ({ ...f, diamond_cert_number: e.target.value }))}
                        className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                      />
                    </div>
                    <div>
                      <select
                        value={form.diamond_cert_lab}
                        onChange={e => setForm(f => ({ ...f, diamond_cert_lab: e.target.value }))}
                        className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                      >
                        <option value="IGI">IGI</option>
                        <option value="GIA">GIA</option>
                        <option value="IGI-LGD">IGI-LGD</option>
                        <option value="HRD">HRD</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Finding Segment */}
          {form.material_type === 'finding' && (
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/20 space-y-4">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Finding Specifications</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Finding Type</label>
                  <select
                    value={form.finding_type}
                    onChange={e => setForm(f => ({ ...f, finding_type: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  >
                    <option value="clasp">Clasp</option>
                    <option value="bail">Bail</option>
                    <option value="prong">Prong</option>
                    <option value="chain">Chain</option>
                    <option value="hook">Hook</option>
                    <option value="other">Other / Accessory</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-3">
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Description / Spec</label>
                  <input
                    type="text"
                    placeholder="e.g. 18K yellow gold lobster clasp, 0.5g"
                    value={form.finding_description}
                    onChange={e => setForm(f => ({ ...f, finding_description: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Quantity (pcs)</label>
                  <input
                    type="number"
                    required
                    placeholder="Pieces count"
                    value={form.total_qty}
                    onChange={e => setForm(f => ({ ...f, total_qty: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Price per Piece (₹/pc)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Unit cost"
                    value={form.unit_cost}
                    onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none font-semibold text-stone-850"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Total Paid (₹)</label>
                  <input
                    type="number"
                    readOnly
                    placeholder="Auto-calculated"
                    value={form.total_paid}
                    className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 text-stone-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* COMMON METADATA & SOURCE */}
          <div className="border-t border-stone-100 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Purchase Source & References</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bhavya Bullion, MMtc"
                  value={form.supplier_name}
                  onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                  className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Invoice Reference</label>
                <input
                  type="text"
                  placeholder="e.g. INV-1004"
                  value={form.invoice_reference}
                  onChange={e => setForm(f => ({ ...f, invoice_reference: e.target.value }))}
                  className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Link to Cash Transaction (Optional)</label>
                <select
                  value={form.linked_cash_txn_id}
                  onChange={e => setForm(f => ({ ...f, linked_cash_txn_id: e.target.value }))}
                  className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium"
                >
                  <option value="">-- No link --</option>
                  {cashTxns.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.txn_number} ({t.txn_type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}) - {t.note || 'No notes'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Notes / Description</label>
              <textarea
                rows={2}
                placeholder="Additional notes about purchase, quality, delivery, etc."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-stone-250 rounded-lg px-3 py-2 text-sm outline-none bg-white font-medium resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-5">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-stone-200 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#1E3A5F] text-white hover:bg-[#162B47] rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Lot
            </button>
          </div>
        </form>
      )}

      {/* --- TAB 2: INVENTORY --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-8">
          {/* Gold Unrealized Gain Summary */}
          {goldLots.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Grams in Stock (24K Pure)</span>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{totalGoldPureQty.toFixed(4)}g</h3>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Book Value (Paid)</span>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{formatCurrency(totalGoldBookValue)}</h3>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Market Value Today</span>
                <h3 className="text-2xl font-extrabold text-stone-900 mt-1">{formatCurrency(totalGoldMarketValue)}</h3>
                <span className="text-[11px] text-stone-400 font-semibold block mt-1">Today's 24K rate: {formatCurrency(rate24k)}/g</span>
              </div>
              <div className={cn(
                "border rounded-2xl p-6 shadow-xs flex flex-col justify-between",
                goldUnrealizedGain >= 0 ? "bg-emerald-50/30 border-emerald-250 text-emerald-900" : "bg-rose-50/30 border-rose-250 text-rose-900"
              )}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-65">Unrealised Gain/Loss</span>
                  <h3 className="text-2xl font-extrabold mt-1">
                    {goldUnrealizedGain >= 0 ? '+' : ''}{formatCurrency(goldUnrealizedGain)}
                  </h3>
                </div>
                <span className="text-[10px] font-semibold opacity-60 block mt-1">Informational, based on book avg vs spot</span>
              </div>
            </div>
          )}

          {loadingLots && lots.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-sm">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <span>Loading lot inventory...</span>
            </div>
          ) : lots.length === 0 ? (
            <div className="text-center p-16 border border-stone-200 rounded-2xl bg-stone-50/50 text-stone-400 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-stone-300" />
              <h3 className="text-sm font-bold text-stone-700">No active lots</h3>
              <p className="text-xs">Add a new lot in the "Add Lot" tab to begin tracking costs.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Gold Group */}
              {goldLots.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-[#1E3A5F]/5 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-[#1E3A5F] uppercase tracking-wider flex items-center gap-2">
                      <Coins className="w-4 h-4" /> Gold Lots (24K Pure Equivalent)
                    </h3>
                    <span className="text-xs text-stone-500 font-semibold">{goldLots.length} Active Lots</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                          <th className="p-4">Lot Number</th>
                          <th className="p-4">Karat</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Supplier</th>
                          <th className="p-4 text-right">Pure Qty / Gross Qty</th>
                          <th className="p-4 text-right">Unit Cost (₹/g pure)</th>
                          <th className="p-4 text-right">Book Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-750">
                        {goldLots.map(l => {
                          const grossQty = l.gold_purity_factor ? Number(l.total_qty) / Number(l.gold_purity_factor) : Number(l.total_qty)
                          return (
                            <tr key={l.id} className="hover:bg-stone-50/50">
                              <td className="p-4 font-bold text-[#1E3A5F]">{l.lot_number}</td>
                              <td className="p-4 font-semibold"><span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[10px]">{l.gold_karat}</span></td>
                              <td className="p-4">{formatDate(l.purchase_date)}</td>
                              <td className="p-4 font-medium">{l.supplier_name || 'N/A'}</td>
                              <td className="p-4 text-right font-semibold">
                                {Number(l.remaining_qty).toFixed(4)}g <span className="text-stone-400">/ {grossQty.toFixed(2)}g</span>
                              </td>
                              <td className="p-4 text-right font-medium">{formatCurrency(l.unit_cost)}</td>
                              <td className="p-4 text-right font-bold">{formatCurrency(Number(l.remaining_qty) * Number(l.unit_cost))}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Silver Group */}
              {silverLots.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-stone-100/50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                      <Coins className="w-4 h-4 text-stone-400" /> Silver Lots
                    </h3>
                    <span className="text-xs text-stone-500 font-semibold">{silverLots.length} Active Lots</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                          <th className="p-4">Lot Number</th>
                          <th className="p-4">Grade</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Supplier</th>
                          <th className="p-4 text-right">Remaining Qty (g)</th>
                          <th className="p-4 text-right">Unit Cost (₹/g)</th>
                          <th className="p-4 text-right">Book Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-750">
                        {silverLots.map(l => (
                          <tr key={l.id} className="hover:bg-stone-50/50">
                            <td className="p-4 font-bold text-stone-850">{l.lot_number}</td>
                            <td className="p-4 font-semibold"><span className="bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md text-[10px]">{l.material_type === 'silver_925' ? '925 Sterling' : '999 Fine'}</span></td>
                            <td className="p-4">{formatDate(l.purchase_date)}</td>
                            <td className="p-4 font-medium">{l.supplier_name || 'N/A'}</td>
                            <td className="p-4 text-right font-semibold">{Number(l.remaining_qty).toFixed(4)}g</td>
                            <td className="p-4 text-right font-medium">{formatCurrency(l.unit_cost)}</td>
                            <td className="p-4 text-right font-bold">{formatCurrency(Number(l.remaining_qty) * Number(l.unit_cost))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Diamond Group */}
              {diamondLots.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-sky-50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-sky-900 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-600" /> Diamond Lots
                    </h3>
                    <span className="text-xs text-stone-500 font-semibold">{diamondLots.length} Active Lots</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                          <th className="p-4">Lot Number</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Specs (Shape / Color / Clarity / Size Band)</th>
                          <th className="p-4">Certified</th>
                          <th className="p-4 text-right">Carats Remain</th>
                          <th className="p-4 text-right">Carats Initial</th>
                          <th className="p-4 text-right">Cost (₹/ct)</th>
                          <th className="p-4 text-right">Book Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-750">
                        {diamondLots.map(l => (
                          <tr key={l.id} className="hover:bg-stone-50/50">
                            <td className="p-4 font-bold text-sky-950">{l.lot_number}</td>
                            <td className="p-4 font-semibold"><span className={cn("px-2 py-0.5 rounded-md text-[10px]", l.material_type === 'diamond_lgd' ? "bg-sky-100 text-sky-800" : "bg-purple-100 text-purple-800")}>{l.material_type === 'diamond_lgd' ? 'LGD' : 'Natural'}</span></td>
                            <td className="p-4">{formatDate(l.purchase_date)}</td>
                            <td className="p-4 font-medium">{l.diamond_shape} {l.diamond_color} {l.diamond_clarity} ({l.diamond_size_band} ct)</td>
                            <td className="p-4">
                              {l.diamond_is_certified ? (
                                <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md text-[10px] border border-sky-100">
                                  {l.diamond_cert_lab}: {l.diamond_cert_number}
                                </span>
                              ) : <span className="text-stone-400">No</span>}
                            </td>
                            <td className="p-4 text-right font-semibold text-stone-850">{Number(l.remaining_qty).toFixed(3)} ct</td>
                            <td className="p-4 text-right text-stone-400">{Number(l.total_qty).toFixed(3)} ct</td>
                            <td className="p-4 text-right font-medium">{formatCurrency(l.unit_cost)}</td>
                            <td className="p-4 text-right font-bold">{formatCurrency(Number(l.remaining_qty) * Number(l.unit_cost))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Findings Group */}
              {findingLots.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-stone-100/50 px-6 py-4 border-b border-stone-200 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-stone-400" /> Finding / Accessory Lots
                    </h3>
                    <span className="text-xs text-stone-500 font-semibold">{findingLots.length} Active Lots</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-400 font-bold uppercase border-b border-stone-200">
                          <th className="p-4">Lot Number</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Description</th>
                          <th className="p-4 text-right">Pcs Remain</th>
                          <th className="p-4 text-right">Unit Cost (₹/pc)</th>
                          <th className="p-4 text-right">Book Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-750">
                        {findingLots.map(l => (
                          <tr key={l.id} className="hover:bg-stone-50/50">
                            <td className="p-4 font-bold text-stone-850">{l.lot_number}</td>
                            <td className="p-4 font-semibold capitalize">{l.finding_type}</td>
                            <td className="p-4">{formatDate(l.purchase_date)}</td>
                            <td className="p-4 font-medium text-stone-500">{l.finding_description || 'N/A'}</td>
                            <td className="p-4 text-right font-semibold">{parseInt(l.remaining_qty)} pcs <span className="text-stone-300">/ {parseInt(l.total_qty)}</span></td>
                            <td className="p-4 text-right font-medium">{formatCurrency(l.unit_cost)}</td>
                            <td className="p-4 text-right font-bold">{formatCurrency(Number(l.remaining_qty) * Number(l.unit_cost))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: REPLENISHMENT --- */}
      {activeTab === 'replenishment' && isMaster && (
        <div className="space-y-6">
          {/* MTD Variance Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Realised Replacement Variance (MTD)</span>
                <h3 className={cn(
                  "text-2xl font-extrabold mt-1",
                  mtdVariance > 0 ? "text-rose-600" : mtdVariance < 0 ? "text-emerald-600" : "text-stone-800"
                )}>
                  {mtdVariance > 0 ? '+' : ''}{formatCurrency(mtdVariance)}
                </h3>
                <span className="text-[10px] text-stone-400 mt-1 block">Realized variance posted to P&L from offsets this month</span>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-xs",
                mtdVariance > 0 ? "bg-rose-500" : mtdVariance < 0 ? "bg-emerald-500" : "bg-stone-400"
              )}>
                {mtdVariance > 0 ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Pending Obligations</span>
              <h3 className="text-2xl font-extrabold text-stone-900 mt-1">
                {obligations.filter(o => o.status !== 'fully_offset').length} Active
              </h3>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Total weight: {obligations.reduce((sum, o) => sum + (o.status !== 'fully_offset' ? Number(o.remaining_qty_g) : 0), 0).toFixed(3)}g (pure)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Pending Obligations */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Pending Replenishment Obligations</h2>
              </div>
              <div className="p-4">
                {loadingReplenishment && obligations.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading...
                  </div>
                ) : obligations.filter(o => o.status !== 'fully_offset').length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    No pending replenishment obligations! All gold used is offset.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {obligations.filter(o => o.status !== 'fully_offset').map(ob => (
                      <div key={ob.id} className="border border-stone-150 rounded-xl p-4 flex justify-between items-center hover:bg-stone-50/20">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1E3A5F] text-sm">{ob.obligation_number}</span>
                            <span className="text-stone-400 text-xs">| {ob.manufacturing_orders?.order_number || 'MO-N/A'}</span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase",
                              ob.status === 'pending' ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"
                            )}>
                              {ob.status === 'pending' ? 'Pending' : 'Partial'}
                            </span>
                          </div>
                          <div className="text-xs text-stone-450 mt-1.5 space-y-0.5">
                            <p>Obligated rate: <strong>{formatCurrency(ob.rate_at_completion)}/g</strong></p>
                            <p>Created: <strong>{formatDate(ob.created_at)}</strong></p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-stone-800 block">
                            {Number(ob.remaining_qty_g).toFixed(3)}g <span className="text-xs text-stone-400">/ {Number(ob.gold_qty_g).toFixed(3)}g</span>
                          </span>
                          <span className="text-xs text-stone-400 font-medium mt-0.5 block">
                            Value: {formatCurrency(Number(ob.remaining_qty_g) * Number(ob.rate_at_completion))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Offset Log History */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Offset Transactions (Variance Postings)</h2>
              </div>
              <div className="p-4">
                {loadingReplenishment && offsets.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading...
                  </div>
                ) : offsets.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 text-xs">
                    No offset transactions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {offsets.map(of => (
                      <div key={of.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50/20 text-xs space-y-2 hover:bg-stone-50/50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-stone-700">
                            Lot {of.purchase_lots?.lot_number || 'N/A'} ➔ Obligation {of.replenishment_obligations?.obligation_number || 'N/A'}
                          </span>
                          <span className={cn(
                            "font-bold px-2 py-0.5 rounded-md",
                            of.delta > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                          )}>
                            {of.delta > 0 ? '+' : ''}{formatCurrency(of.delta)} {of.delta > 0 ? 'Loss' : 'Gain'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-stone-500">
                          <div>
                            <p>Offset Qty: <strong>{Number(of.qty_offset_g).toFixed(3)}g</strong></p>
                            <p>Offset Date: <strong>{formatDate(of.offset_date)}</strong></p>
                          </div>
                          <div className="text-right">
                            <p>Obligation Rate: <strong>{formatCurrency(of.obligation_rate)}/g</strong></p>
                            <p>Purchase Rate: <strong>{formatCurrency(of.purchase_rate)}/g</strong></p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- REPLENISHMENT OFFSET CONFIRMATION DIALOG / MODAL --- */}
      {showOffsetModal && offsetPreview && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-3 text-amber-700">
              <Coins className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-extrabold uppercase tracking-wider text-stone-900">Gold Replenishment Matcher</h3>
                <p className="text-xs text-stone-500">New gold purchase lot triggered automatic FIFO offsets</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm bg-stone-50 border border-stone-150 rounded-xl p-4 space-y-1.5 text-stone-700">
                <p>New Purchase Lot: <strong>{offsetPreview.remaining_purchase > 0 ? `${offsetPreview.remaining_purchase}g` : 'Entire quantity'}</strong> costed at <strong>{formatCurrency(form.unit_cost)}/g</strong>.</p>
                <p>Will be used to offset <strong>{offsetPreview.offsets.length}</strong> oldest pending obligations.</p>
              </div>

              {/* Offset list */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {offsetPreview.offsets.map((of: any) => (
                  <div key={of.obligation_id} className="border border-stone-150 rounded-lg p-3 bg-stone-50/10 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-stone-850">{of.obligation_number}</p>
                      <p className="text-stone-400 mt-1">Obligation rate: <strong>{formatCurrency(of.obligation_rate)}/g</strong> ➔ Buy rate: <strong>{formatCurrency(of.purchase_rate)}/g</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-stone-800 block">{of.qty_offset.toFixed(3)}g offset</span>
                      <span className={cn(
                        "font-bold mt-1 inline-block",
                        of.delta > 0 ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {of.delta > 0 ? '+' : ''}{formatCurrency(of.delta)} {of.delta > 0 ? '(Loss)' : '(Gain)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Aggregates */}
              <div className="border-t border-stone-100 pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-stone-400 block font-medium">Gold Replacement Variance</span>
                  <span className={cn(
                    "text-base font-extrabold block",
                    offsetPreview.total_delta > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {offsetPreview.total_delta > 0 ? '+' : ''}{formatCurrency(offsetPreview.total_delta)} {offsetPreview.total_delta > 0 ? 'LOSS' : 'GAIN'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-400 block font-medium">Remaining purchase after offset</span>
                  <span className="text-sm font-bold text-stone-850 block">{offsetPreview.remaining_purchase.toFixed(3)}g</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-stone-100 pt-4">
              <button
                type="button"
                disabled={confirmingOffset}
                onClick={() => {
                  setSuccessMsg(`Lot saved successfully without offsets.`);
                  setShowOffsetModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg text-xs font-semibold"
              >
                Save Lot Only, Skip Offset
              </button>
              <button
                type="button"
                disabled={confirmingOffset}
                onClick={handleConfirmOffset}
                className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                {confirmingOffset && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Offset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
