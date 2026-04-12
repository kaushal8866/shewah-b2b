'use client'

import { useEffect, useState } from 'react'
import { supabase, GoldRate, calculateGoldRates, calculateTradePrice } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { TrendingUp, Plus, Calculator, Save } from 'lucide-react'

export default function GoldRatesPage() {
  const [rates, setRates] = useState<GoldRate[]>([])
  const [latest, setLatest] = useState<GoldRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newRate24k, setNewRate24k] = useState('')
  const [rateNotes, setRateNotes] = useState('')

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
    const { data } = await supabase
      .from('gold_rates')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(30)
    const all = data || []
    setRates(all)
    if (all.length > 0) {
      setLatest(all[0])
      setNewRate24k(String(all[0].rate_24k))
    }
    setLoading(false)
  }

  async function saveRate() {
    const rate = parseFloat(newRate24k)
    if (!rate || rate < 1000) { alert('Enter a valid gold rate (₹/gram)'); return }
    setSaving(true)
    const computed = calculateGoldRates(rate)
    const { error } = await supabase.from('gold_rates').insert([{
      ...computed, source: 'manual', notes: rateNotes
    }])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setRateNotes('')
    loadRates()
  }

  const computed = newRate24k ? calculateGoldRates(parseFloat(newRate24k) || 0) : null

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
    ? parseFloat(calcGoldWeight) * latest.rate_24k * ({ 14: 0.585, 18: 0.750, 22: 0.916, 24: 1 }[parseInt(calcGoldKarat)] || 0.75)
    : 0

  const cogs = (parseFloat(calcDiamond) || 0) + goldCost + (parseFloat(calcMaking) || 0) + (parseFloat(calcIGI) || 0)

  return (
    <div className="p-4 sm:p-6 lg:p-16 lg:pr-32">
      <div className="mb-8 lg:mb-12">
        <h1 className="display-sm">Gold Rates</h1>
        <p className="text-secondary tracking-wide mt-2">Track rates and calculate trade pricing</p>
      </div>

      {/* Current rates banner */}
      {latest && (
        <div className="bg-surface-low p-6 mb-8 lg:mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              <span className="headline-md">Current gold rates</span>
            </div>
            <span className="label-md">{formatDate(latest.recorded_at)} · {latest.source}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
            {[
              { karat: '24K', rate: latest.rate_24k, purity: '99.9%' },
              { karat: '22K', rate: latest.rate_22k, purity: '91.6%' },
              { karat: '18K', rate: latest.rate_18k, purity: '75.0%' },
              { karat: '14K', rate: latest.rate_14k, purity: '58.5%' },
            ].map(r => (
              <div key={r.karat} className="bg-surface-lowest hover:bg-surface-highest transition-colors flex flex-col justify-center items-center py-6 px-4">
                <p className="label-md mb-2 text-outline-variant">{r.karat} <span className="lowercase">({r.purity})</span></p>
                <p className="display-sm text-primary">₹{r.rate?.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">per gram</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12">
        {/* Update rate */}
        <div className="space-y-8">
          <div className="card bg-surface-low">
            <h2 className="headline-md mb-6 flex items-center gap-3">
              <Plus className="w-5 h-5 text-secondary" />
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

              {/* Live preview */}
              {computed && computed.rate_24k > 0 && (
                <div className="bg-surface-lowest p-4 space-y-2 ghost-border">
                  {[
                    { k: '22K', r: computed.rate_22k },
                    { k: '18K', r: computed.rate_18k },
                    { k: '14K', r: computed.rate_14k },
                  ].map(({ k, r }) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-secondary">{k} auto-calculated</span>
                      <span className="font-medium text-primary">₹{r?.toLocaleString('en-IN')}/g</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="label-md block mb-2">Notes (optional)</label>
                <input type="text" value={rateNotes} onChange={e => setRateNotes(e.target.value)}
                  placeholder="e.g. post-budget rate" />
              </div>

              <button onClick={saveRate} disabled={saving || !newRate24k}
                className="w-full flex items-center justify-center gap-2 bg-primary text-surface-lowest py-4 text-sm font-medium hover:bg-surface-highest hover:text-primary disabled:opacity-40 transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save rate'}
              </button>
            </div>
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
        <div className="card bg-surface-low self-start">
          <h2 className="headline-md mb-6 flex items-center gap-3">
            <Calculator className="w-5 h-5 text-secondary" />
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
                <label className="label-md block mb-2">Diamond cost (₹)</label>
                <input type="number" value={calcDiamond} onChange={e => setCalcDiamond(e.target.value)} />
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
                <label className="label-md block mb-2">Gold weight (g)</label>
                <input type="number" value={calcGoldWeight} onChange={e => setCalcGoldWeight(e.target.value)} />
              </div>
              <div>
                <label className="label-md block mb-2">Making charges (₹)</label>
                <input type="number" value={calcMaking} onChange={e => setCalcMaking(e.target.value)} />
              </div>
              <div>
                <label className="label-md block mb-2">IGI cert cost (₹)</label>
                <input type="number" value={calcIGI} onChange={e => setCalcIGI(e.target.value)} />
              </div>
              <div>
                <label className="label-md block mb-2">Margin above COGS (%)</label>
                <input type="number" value={calcMargin} onChange={e => setCalcMargin(e.target.value)} />
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
              
              <div className="bg-primary text-surface-lowest p-5 flex justify-between items-end my-4 shadow-ambient">
                <span className="headline-md !text-surface-lowest">Trade price</span>
                <span className="display-sm !text-surface-lowest leading-none">₹{tradePrice.toLocaleString('en-IN')}</span>
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
