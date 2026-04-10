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

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#C49C64] outline-none"

  return (
    <div className="p-4 lg:p-7">
      <div className="mb-5 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Gold Rates</h1>
        <p className="text-stone-500 text-sm mt-0.5">Track rates and calculate trade pricing</p>
      </div>

      {/* Current rates banner */}
      {latest && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Current gold rates</span>
            </div>
            <span className="text-xs text-yellow-600">{formatDate(latest.recorded_at)} · {latest.source}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { karat: '24K', rate: latest.rate_24k, purity: '99.9%' },
              { karat: '22K', rate: latest.rate_22k, purity: '91.6%' },
              { karat: '18K', rate: latest.rate_18k, purity: '75.0%' },
              { karat: '14K', rate: latest.rate_14k, purity: '58.5%' },
            ].map(r => (
              <div key={r.karat} className="text-center bg-white rounded-lg p-3 border border-yellow-200">
                <p className="text-xs text-stone-400">{r.karat} ({r.purity})</p>
                <p className="text-xl font-semibold text-stone-900">₹{r.rate?.toLocaleString('en-IN')}</p>
                <p className="text-xs text-stone-400">per gram</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Update rate */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#C49C64]" />
              Update today's rate
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">24K gold rate (₹ per gram) *</label>
                <input type="number" className={input}
                  value={newRate24k} onChange={e => setNewRate24k(e.target.value)}
                  placeholder="e.g. 7350" />
                <p className="text-xs text-stone-400 mt-1">Check: IBJA, MCX, or your local market</p>
              </div>

              {/* Live preview */}
              {computed && computed.rate_24k > 0 && (
                <div className="bg-stone-50 rounded-lg p-3 space-y-1">
                  {[
                    { k: '22K', r: computed.rate_22k },
                    { k: '18K', r: computed.rate_18k },
                    { k: '14K', r: computed.rate_14k },
                  ].map(({ k, r }) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-stone-500">{k} auto-calculated</span>
                      <span className="font-medium text-stone-700">₹{r?.toLocaleString('en-IN')}/g</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Notes (optional)</label>
                <input className={input} value={rateNotes} onChange={e => setRateNotes(e.target.value)}
                  placeholder="e.g. post-budget rate" />
              </div>

              <button onClick={saveRate} disabled={saving || !newRate24k}
                className="w-full flex items-center justify-center gap-2 bg-[#C49C64] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#9B7A40] disabled:opacity-40 transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save rate'}
              </button>
            </div>
          </div>

          {/* Rate history */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100">
              <h2 className="font-medium text-stone-900">Rate history</h2>
            </div>
            <div className="divide-y divide-stone-50">
              {loading ? (
                <div className="px-5 py-4 text-sm text-stone-400">Loading...</div>
              ) : rates.length === 0 ? (
                <div className="px-5 py-4 text-sm text-stone-400">No rates recorded yet</div>
              ) : (
                rates.map((r, i) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        ₹{r.rate_24k?.toLocaleString('en-IN')}/g (24K)
                        {i === 0 && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">current</span>}
                      </p>
                      <p className="text-xs text-stone-400">{formatDate(r.recorded_at)} · {r.source}</p>
                    </div>
                    <div className="text-right text-xs text-stone-400">
                      <p>18K: ₹{r.rate_18k?.toLocaleString('en-IN')}</p>
                      <p>14K: ₹{r.rate_14k?.toLocaleString('en-IN')}</p>
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
            <Calculator className="w-4 h-4 text-[#C49C64]" />
            Trade price calculator
          </h2>
          {!latest && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              Update today's gold rate first to get accurate pricing.
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Diamond cost (₹)</label>
                <input type="number" className={input} value={calcDiamond} onChange={e => setCalcDiamond(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Gold karat</label>
                <select className={input} value={calcGoldKarat} onChange={e => setCalcGoldKarat(e.target.value)}>
                  <option value="14">14K</option>
                  <option value="18">18K</option>
                  <option value="22">22K</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Gold weight (g)</label>
                <input type="number" className={input} value={calcGoldWeight} onChange={e => setCalcGoldWeight(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Making charges (₹)</label>
                <input type="number" className={input} value={calcMaking} onChange={e => setCalcMaking(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">IGI cert cost (₹)</label>
                <input type="number" className={input} value={calcIGI} onChange={e => setCalcIGI(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Margin above COGS (%)</label>
                <input type="number" className={input} value={calcMargin} onChange={e => setCalcMargin(e.target.value)} />
              </div>
            </div>

            {/* Result */}
            <div className="bg-stone-50 rounded-xl p-4 mt-2 space-y-2">
              <div className="flex justify-between text-xs text-stone-500">
                <span>Diamond cost</span>
                <span>₹{parseFloat(calcDiamond).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Gold cost ({calcGoldKarat}K, {calcGoldWeight}g)</span>
                <span>₹{Math.round(goldCost).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Making charges</span>
                <span>₹{parseFloat(calcMaking).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>IGI certification</span>
                <span>₹{parseFloat(calcIGI).toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-medium text-stone-700">
                <span>COGS</span>
                <span>₹{Math.round(cogs).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-stone-500">
                <span>Margin ({calcMargin}%)</span>
                <span>₹{Math.round(cogs * parseFloat(calcMargin) / 100).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-[#C49C64] rounded-lg p-3 flex justify-between items-center">
                <span className="text-white font-medium">Trade price</span>
                <span className="text-white text-2xl font-semibold">₹{tradePrice.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Suggested MRP (jeweler +40%)</span>
                <span className="font-medium">₹{Math.round(tradePrice * 1.40).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Jeweler's margin</span>
                <span className="text-green-600 font-medium">₹{Math.round(tradePrice * 0.40).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
