'use client'

import { useEffect, useState } from 'react'
import { supabase, GoldRate, calculateGoldRates, calculateTradePrice, recomputeCatalogPrices } from '@/lib/supabase'
import { SELLABLE_KARATS, KARAT_FACTORS } from '@/lib/karat'
import { formatDate, formatCurrency } from '@/lib/utils'
import { TrendingUp, Plus, Calculator, Save, RefreshCw, Wrench } from 'lucide-react'

export default function GoldRatesPage() {
  const [rates, setRates] = useState<GoldRate[]>([])
  const [latest, setLatest] = useState<GoldRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [lastRecalc, setLastRecalc] = useState<{ updated: number; skipped: number; failed: number; error?: string } | null>(null)

  const [newRate24k, setNewRate24k] = useState('')
  const [rateNotes, setRateNotes] = useState('')
  const [retailLabour, setRetailLabour] = useState<Record<number, string>>({ 22: '', 18: '', 14: '', 10: '', 9: '' })
  const [silverRateB2B, setSilverRateB2B] = useState('')
  const [silverRateD2C, setSilverRateD2C] = useState('')

  // Labour rates state
  const [labourRates, setLabourRates] = useState<{ id?: string; karat: number; rate_per_gram: number }[]>([])
  const [savingLabour, setSavingLabour] = useState(false)

  // Calculator state
  const [calcDiamond, setCalcDiamond] = useState('8000')
  const [calcGoldKarat, setCalcGoldKarat] = useState('18')
  const [calcGoldWeight, setCalcGoldWeight] = useState('3')
  const [calcMaking, setCalcMaking] = useState('2500')
  const [calcIGI, setCalcIGI] = useState('1500')
  const [calcMargin, setCalcMargin] = useState('28')

  useEffect(() => { loadRates() }, [])

  async function loadRates() {
    setLoading(true)
    const [resRates, resSettings, resLabour] = await Promise.all([
      supabase.from('gold_rates').select('*').order('recorded_at', { ascending: false }).limit(30),
      supabase.from('settings').select('key, value').in('key', ['silver_rate_b2b', 'silver_rate_d2c']),
      supabase.from('labour_rates').select('*').order('karat')
    ])
    
    const all = resRates.data || []
    setRates(all)
    if (all.length > 0) {
      const top = all[0]
      setLatest(top)
      setNewRate24k(String(top.rate_24k))
      setRetailLabour({
        22: top.retail_labour_22k != null ? String(top.retail_labour_22k) : '',
        18: top.retail_labour_18k != null ? String(top.retail_labour_18k) : '',
        14: top.retail_labour_14k != null ? String(top.retail_labour_14k) : '',
        10: top.retail_labour_10k != null ? String(top.retail_labour_10k) : '',
        9:  top.retail_labour_9k  != null ? String(top.retail_labour_9k)  : '',
      })
    }

    if (resSettings.data) {
      const b2b = resSettings.data.find(s => s.key === 'silver_rate_b2b')?.value
      const d2c = resSettings.data.find(s => s.key === 'silver_rate_d2c')?.value
      if (b2b) setSilverRateB2B(b2b)
      if (d2c) setSilverRateD2C(d2c)
    }
    // Initialize labour rates with defaults if empty
    const existingRates = resLabour.data || []
    if (existingRates.length === 0) {
      setLabourRates([
        { karat: 14, rate_per_gram: 900 },
        { karat: 18, rate_per_gram: 1200 },
        { karat: 22, rate_per_gram: 1500 },
      ])
    } else {
      setLabourRates(existingRates)
    }
    setLoading(false)
  }

  async function saveRate() {
    const rate = parseFloat(newRate24k)
    if (!rate || rate < 1000) { alert('Enter a valid gold rate (₹/gram)'); return }
    setSaving(true)

    // Save silver rates to settings
    const b2bVal = parseFloat(silverRateB2B)
    const d2cVal = parseFloat(silverRateD2C)
    if (isNaN(b2bVal) || isNaN(d2cVal) || b2bVal <= 0 || d2cVal <= 0) {
      setSaving(false)
      alert('Enter valid silver rates (₹/gram)')
      return
    }

    const silverUpserts = [
      { key: 'silver_rate_b2b', value: String(b2bVal), updated_at: new Date().toISOString() },
      { key: 'silver_rate_d2c', value: String(d2cVal), updated_at: new Date().toISOString() }
    ]
    const { error: settingsErr } = await supabase.from('settings').upsert(silverUpserts, { onConflict: 'key' })
    if (settingsErr) {
      setSaving(false)
      alert('Error saving silver rates: ' + settingsErr.message)
      return
    }

    const computed = calculateGoldRates(rate)
    const labourPayload: Record<string, number | null> = {}
    for (const k of SELLABLE_KARATS) {
      const v = parseFloat(retailLabour[k])
      labourPayload[`retail_labour_${k}k`] = isFinite(v) && v >= 0 ? v : null
    }
    const { error } = await supabase.from('gold_rates').insert([{
      ...computed,
      rate_10k: Math.round(rate * KARAT_FACTORS[10]),
      rate_9k:  Math.round(rate * KARAT_FACTORS[9]),
      ...labourPayload,
      source: 'manual', notes: rateNotes,
    }])
    if (error) { setSaving(false); alert('Error: ' + error.message); return }
    setRateNotes('')
    const result = await recomputeCatalogPrices(rate)
    setLastRecalc(result)
    setSaving(false)
    loadRates()
    alert(formatRecalcResult('Rates saved successfully.', result))
  }

  async function recalcNow() {
    if (!latest) { alert('No gold rate recorded yet.'); return }
    if (!confirm(`Recalculate trade price for every active catalog product using the current rate of ₹${latest.rate_24k}/g (24K)?`)) return
    setRecalcing(true)
    const result = await recomputeCatalogPrices(latest.rate_24k)
    setLastRecalc(result)
    setRecalcing(false)
    alert(formatRecalcResult('Recalculated.', result))
  }

  function formatRecalcResult(prefix: string, r: { updated: number; skipped: number; failed: number; pricedAt?: string; error?: string }) {
    if (r.error) return `${prefix} Could not refresh catalog prices: ${r.error}`
    const parts = [`${r.updated} repriced`, `${r.skipped} unchanged`]
    if (r.failed > 0) parts.push(`${r.failed} failed (check console)`)
    const stamp = r.pricedAt ? ` (priced at ${new Date(r.pricedAt).toLocaleString('en-IN')})` : ''
    return `${prefix} Catalog prices: ${parts.join(' · ')}${stamp}.`
  }

  const computed = newRate24k ? calculateGoldRates(parseFloat(newRate24k) || 0) : null

  // Labour rate handlers
  function updateLabourRate(karat: number, value: string) {
    setLabourRates(prev =>
      prev.map(r => r.karat === karat ? { ...r, rate_per_gram: parseFloat(value) || 0 } : r)
    )
  }

  async function saveLabourRates() {
    setSavingLabour(true)
    for (const rate of labourRates) {
      if (rate.id) {
        await supabase.from('labour_rates').update({ rate_per_gram: rate.rate_per_gram }).eq('id', rate.id)
      } else {
        await supabase.from('labour_rates').upsert({ karat: rate.karat, rate_per_gram: rate.rate_per_gram }, { onConflict: 'karat' })
      }
    }
    setSavingLabour(false)
    loadRates()
  }

  const tradePrice = calculateTradePrice(
    parseFloat(calcDiamond) || 0,
    parseInt(calcGoldKarat) || 18,
    parseFloat(calcGoldWeight) || 0,
    latest?.rate_24k || 0,
    parseFloat(calcMaking) || 0,
    parseFloat(calcIGI) || 0,
    1 + (parseFloat(calcMargin) || 28) / 100
  )

  const goldCost = latest
    ? parseFloat(calcGoldWeight) * latest.rate_24k * ((KARAT_FACTORS as Record<number, number>)[parseInt(calcGoldKarat)] || KARAT_FACTORS[18])
    : 0

  const cogs = (parseFloat(calcDiamond) || 0) + goldCost + (parseFloat(calcMaking) || 0) + (parseFloat(calcIGI) || 0)

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none"

  return (
    <div className="p-4 lg:p-7">
      <div className="mb-5 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Metal Rates</h1>
        <p className="text-stone-500 text-sm mt-0.5">Track metal rates and calculate trade pricing</p>
      </div>

      {/* Current rates banner */}
      {latest && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              <span className="headline-md">Current gold rates</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-yellow-700">{formatDate(latest.recorded_at)} · {latest.source}</span>
              <button onClick={recalcNow} disabled={recalcing}
                className="flex items-center gap-1.5 bg-white border border-yellow-300 text-yellow-800 hover:bg-yellow-100 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40">
                <RefreshCw className={`w-3.5 h-3.5 ${recalcing ? 'animate-spin' : ''}`} />
                {recalcing ? 'Recalculating…' : 'Recalculate catalog prices'}
              </button>
            </div>
          </div>
          {lastRecalc && (
            <p className="text-xs text-yellow-700 mb-2">
              Last refresh: {lastRecalc.updated} product(s) repriced · {lastRecalc.skipped} unchanged.
            </p>
          )}
          <p className="text-xs text-yellow-700 mb-2">
            Note: only catalog products are repriced. Orders already placed keep the gold rate that was locked when the order was created.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { karat: '24K', rate: latest.rate_24k, purity: `${(KARAT_FACTORS[24] * 100).toFixed(1)}%` },
              { karat: '22K', rate: latest.rate_22k, purity: `${(KARAT_FACTORS[22] * 100).toFixed(1)}%` },
              { karat: '18K', rate: latest.rate_18k, purity: `${(KARAT_FACTORS[18] * 100).toFixed(0)}%` },
              { karat: '14K', rate: latest.rate_14k, purity: `${(KARAT_FACTORS[14] * 100).toFixed(0)}%` },
              { karat: '10K', rate: latest.rate_10k, purity: `${(KARAT_FACTORS[10] * 100).toFixed(0)}%` },
              { karat: '9K',  rate: latest.rate_9k,  purity: `${(KARAT_FACTORS[9]  * 100).toFixed(0)}%` },
            ].map(r => (
              <div key={r.karat} className="bg-surface-lowest hover:bg-surface-highest transition-colors flex flex-col justify-center items-center py-6 px-4">
                <p className="label-md mb-2 text-outline-variant">{r.karat} <span className="lowercase">({r.purity})</span></p>
                <p className="display-sm text-primary">₹{r.rate?.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">per gram</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-yellow-200/50">
            <div className="text-center bg-white rounded-lg p-3 border border-yellow-200">
              <p className="text-xs text-stone-400 font-medium text-amber-800">Silver B2B Rate</p>
              <p className="text-xl font-semibold text-stone-900">₹{parseFloat(silverRateB2B || '0').toLocaleString('en-IN')}</p>
              <p className="text-xs text-stone-400">per gram</p>
            </div>
            <div className="text-center bg-white rounded-lg p-3 border border-yellow-200">
              <p className="text-xs text-stone-400 font-medium text-amber-800">Silver D2C Rate</p>
              <p className="text-xl font-semibold text-stone-900">₹{parseFloat(silverRateD2C || '0').toLocaleString('en-IN')}</p>
              <p className="text-xs text-stone-400">per gram</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Update rate */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-stone-800" />
              Update today's rate
            </h2>
            <div className="space-y-6">
              <div>
                <label className="label-md block mb-2">24K gold rate (₹ per gram) *</label>
                <input type="number"
                  value={newRate24k} onChange={e => setNewRate24k(e.target.value)}
                  placeholder="e.g. 7350" />
                <p className="text-xs text-secondary mt-2">Check: IBJA, MCX, or your local market</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Silver B2B Rate (₹/g) *</label>
                  <input type="number" className={input}
                    value={silverRateB2B} onChange={e => setSilverRateB2B(e.target.value)}
                    placeholder="e.g. 80" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Silver D2C Rate (₹/g) *</label>
                  <input type="number" className={input}
                    value={silverRateD2C} onChange={e => setSilverRateD2C(e.target.value)}
                    placeholder="e.g. 120" />
                </div>
              </div>

              {/* Live preview */}
              {computed && computed.rate_24k > 0 && (
                <div className="bg-stone-50 rounded-lg p-3 space-y-1">
                  {SELLABLE_KARATS.map(k => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-stone-500">{k}K auto-calculated</span>
                      <span className="font-medium text-stone-700">
                        ₹{Math.round(computed.rate_24k * KARAT_FACTORS[k]).toLocaleString('en-IN')}/g
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-stone-200 rounded-lg p-3 bg-white">
                <p className="text-xs font-medium text-stone-700 mb-1">Retail labour (₹/g) per karat</p>
                <p className="text-[11px] text-stone-400 mb-2">
                  Used to price every catalog SKU in each karat. Leave blank to skip a karat.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {SELLABLE_KARATS.map(k => (
                    <div key={k}>
                      <label className="block text-[10px] font-medium text-stone-400 mb-0.5 text-center">{k}kt</label>
                      <input
                        type="number" inputMode="decimal" step="1" min="0"
                        className="w-full border border-stone-200 rounded-md px-1.5 py-1 text-xs text-center focus:border-stone-800 outline-none"
                        value={retailLabour[k]}
                        onChange={e => setRetailLabour(prev => ({ ...prev, [k]: e.target.value }))}
                        placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-md block mb-2">Notes (optional)</label>
                <input type="text" value={rateNotes} onChange={e => setRateNotes(e.target.value)}
                  placeholder="e.g. post-budget rate" />
              </div>

              <button onClick={saveRate} disabled={saving || !newRate24k}
                className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 disabled:opacity-40 transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save rate'}
              </button>
            </div>
          </div>

          {/* Labour Rate Management */}
          <div className="card bg-surface-low">
            <h2 className="headline-md mb-6 flex items-center gap-3">
              <Wrench className="w-5 h-5 text-secondary" />
              Labour rates (₹/gram)
            </h2>
            <p className="text-sm text-secondary mb-6">
              Global per-gram labour charges. Used in manufacturing order costing and catalog pricing. Partner-specific overrides take priority.
            </p>
            <div className="space-y-4">
              {labourRates.map(r => (
                <div key={r.karat} className="flex items-center gap-4">
                  <span className="label-md w-16">{r.karat}K</span>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">₹</span>
                    <input
                      type="number"
                      value={r.rate_per_gram || ''}
                      onChange={e => updateLabourRate(r.karat, e.target.value)}
                      className="w-full pl-7"
                      placeholder="per gram"
                    />
                  </div>
                  <span className="text-xs text-secondary w-24 text-right">/gram</span>
                </div>
              ))}
            </div>
            <button onClick={saveLabourRates} disabled={savingLabour}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-primary text-surface-lowest py-3 text-sm font-medium hover:bg-surface-highest hover:text-primary disabled:opacity-40 transition-colors">
              <Save className="w-4 h-4" />
              {savingLabour ? 'Saving...' : 'Save labour rates'}
            </button>
          </div>

          {/* Rate history */}
          <div className="card bg-surface-low !p-0">
            <div className="px-6 py-5 border-b ghost-border">
              <h2 className="headline-md">Rate history</h2>
            </div>
            <div className="divide-y divide-outline-variant/20 max-h-[500px] overflow-y-auto hide-scrollbar">
              {loading ? (
                <div className="px-6 py-6 text-sm text-secondary">Loading...</div>
              ) : rates.length === 0 ? (
                <div className="px-6 py-6 text-sm text-secondary">No rates recorded yet</div>
              ) : (
                rates.map((r, i) => (
                  <div key={r.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-highest transition-colors">
                    <div>
                      <p className="text-base font-medium text-primary flex items-center gap-3">
                        ₹{r.rate_24k?.toLocaleString('en-IN')}/g <span className="text-secondary font-normal">(24K)</span>
                        {i === 0 && <span className="status-pill success ml-2">current</span>}
                      </p>
                      <p className="text-xs text-secondary mt-1">{formatDate(r.recorded_at)} · {r.source}</p>
                    </div>
                    <div className="text-right text-sm text-secondary">
                      <p>18K: ₹{r.rate_18k?.toLocaleString('en-IN')}</p>
                      <p className="mt-0.5">14K: ₹{r.rate_14k?.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Trade price calculator */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-stone-800" />
            Trade price calculator
          </h2>
          {!latest && (
            <div className="bg-surface-highest border border-outline-variant/30 p-4 text-sm text-primary mb-6">
              Update today's gold rate first to get accurate pricing.
            </div>
          )}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Diamond cost (₹)</label>
                <input type="number" inputMode="decimal" className={input} value={calcDiamond} onChange={e => setCalcDiamond(e.target.value)} />
              </div>
              <div>
                <label className="label-md block mb-2">Gold karat</label>
                <select value={calcGoldKarat} onChange={e => setCalcGoldKarat(e.target.value)}>
                  <option value="14">14K</option>
                  <option value="18">18K</option>
                  <option value="22">22K</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Gold weight (g)</label>
                <input type="number" inputMode="decimal" className={input} value={calcGoldWeight} onChange={e => setCalcGoldWeight(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Making charges (₹)</label>
                <input type="number" inputMode="decimal" className={input} value={calcMaking} onChange={e => setCalcMaking(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">IGI cert cost (₹)</label>
                <input type="number" inputMode="decimal" className={input} value={calcIGI} onChange={e => setCalcIGI(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Margin above COGS (%)</label>
                <input type="number" inputMode="decimal" className={input} value={calcMargin} onChange={e => setCalcMargin(e.target.value)} />
              </div>
            </div>

            {/* Result */}
            <div className="bg-surface-lowest ghost-border p-6 mt-8 space-y-3">
              <div className="flex justify-between text-sm text-secondary">
                <span>Diamond cost</span>
                <span>₹{parseFloat(calcDiamond).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Gold cost ({calcGoldKarat}K, {calcGoldWeight}g)</span>
                <span>₹{Math.round(goldCost).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Making charges</span>
                <span>₹{parseFloat(calcMaking).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>IGI certification</span>
                <span>₹{parseFloat(calcIGI).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="border-t ghost-border pt-4 mt-2 flex justify-between text-base font-medium text-primary">
                <span>COGS</span>
                <span>₹{Math.round(cogs).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary mb-4">
                <span>Margin ({calcMargin}%)</span>
                <span>₹{Math.round(cogs * parseFloat(calcMargin) / 100).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-stone-800 rounded-lg p-3 flex justify-between items-center">
                <span className="text-white font-medium">Trade price</span>
                <span className="text-white text-2xl font-semibold">₹{tradePrice.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="flex justify-between text-sm text-secondary pt-2">
                <span>Suggested MRP (retail +40%)</span>
                <span className="font-medium text-primary">₹{Math.round(tradePrice * 1.40).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Retailer's margin</span>
                <span className="font-medium text-primary">₹{Math.round(tradePrice * 0.40).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
