'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPricingPage() {
  const [shapes, setShapes] = useState<any[]>([])
  const [sizes, setSizes] = useState<any[]>([])
  const [qualityBuckets, setQualityBuckets] = useState<any[]>([])
  const [colorBuckets, setColorBuckets] = useState<any[]>([])

  // Selection state
  const [selectedShape, setSelectedShape] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedType, setSelectedType] = useState('natural')
  const [selectedQuality, setSelectedQuality] = useState('VS2')
  const [selectedColor, setSelectedColor] = useState('F')
  const [weight, setWeight] = useState('0.005')
  const [pieces, setPieces] = useState('146')

  // Suggestion results
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [matchedPrice, setMatchedPrice] = useState<number | null>(null)
  const [calculatedCost, setCalculatedCost] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('diamond_shapes').select('id, name').order('name'),
      supabase.from('diamond_sizes').select('id, label').order('sort_order', { ascending: true }),
      supabase.from('diamond_quality_buckets').select('*').order('sort_order', { ascending: true }),
      supabase.from('diamond_color_buckets').select('*').order('sort_order', { ascending: true })
    ]).then(([sh, sz, qb, cb]) => {
      setShapes(sh.data || [])
      setSizes(sz.data || [])
      setQualityBuckets(qb.data || [])
      setColorBuckets(cb.data || [])

      // Set defaults
      if (sh.data) {
        const round = sh.data.find((s: any) => s.name.toLowerCase() === 'round')
        if (round) setSelectedShape(round.id)
      }
      if (sz.data) {
        const mm1 = sz.data.find((s: any) => s.label === '1.0mm')
        if (mm1) setSelectedSize(mm1.id)
      }
    })
  }, [])

  const handleTestFetch = async () => {
    if (!selectedShape || !selectedSize) return
    setLoading(true)
    setResult(null)
    setMatchedPrice(null)
    setCalculatedCost(null)

    try {
      const url = new URL('/api/diamonds/latest-cost', window.location.origin)
      url.searchParams.set('shape_id', selectedShape)
      url.searchParams.set('size_id', selectedSize)
      url.searchParams.set('type', selectedType)

      const r = await fetch(url.toString())
      const data = await r.json()
      setResult(data)

      const matrix = data.matrix_options || []

      // Matching algorithm
      const qMatch = matrix.find((m: any) =>
        m.quality_label.toLowerCase().includes(selectedQuality.toLowerCase().slice(0, 2))
      )
      const cMatch = qMatch && matrix.find((m: any) =>
        m.quality_label === qMatch.quality_label &&
        m.color_label.toLowerCase().includes(selectedColor.toLowerCase().slice(0, 1))
      )

      const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? null
      setMatchedPrice(pick)

      if (pick !== null) {
        const wt = parseFloat(weight) || 0
        const isLgd = selectedType === 'lgd'
        const costVal = isLgd ? pick : Math.round(wt * pick)
        setCalculatedCost(costVal)
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <h1 className="text-xl font-bold text-slate-800">Diamond Cost Suggestions Tester</h1>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Shape</label>
            <select className="w-full border p-2 rounded text-slate-800" value={selectedShape} onChange={e => setSelectedShape(e.target.value)}>
              {shapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Size</label>
            <select className="w-full border p-2 rounded text-slate-800" value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
              {sizes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
            <select className="w-full border p-2 rounded text-slate-800" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
              <option value="lgd">LGD</option>
              <option value="natural">Natural</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Quality</label>
            <select className="w-full border p-2 rounded text-slate-800" value={selectedQuality} onChange={e => setSelectedQuality(e.target.value)}>
              <option value="VVS1">VVS1</option>
              <option value="VVS2">VVS2</option>
              <option value="VS1">VS1</option>
              <option value="VS2">VS2</option>
              <option value="SI1">SI1</option>
              <option value="SI2">SI2</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Color</label>
            <select className="w-full border p-2 rounded text-slate-800" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="G">G</option>
              <option value="H">H</option>
              <option value="I">I</option>
              <option value="J">J</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Weight (ct)</label>
            <input type="number" step="any" className="w-full border p-2 rounded text-slate-800" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Pieces</label>
            <input type="number" className="w-full border p-2 rounded text-slate-800" value={pieces} onChange={e => setPieces(e.target.value)} />
          </div>
        </div>

        <button onClick={handleTestFetch} disabled={loading} className="w-full bg-slate-800 text-white py-2 rounded font-bold hover:bg-slate-700">
          {loading ? 'Fetching...' : 'TEST FETCH'}
        </button>
      </div>

      {result && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-700">Test Results</h3>
          <div className="space-y-1.5 text-sm text-slate-650">
            <p><span className="font-semibold text-slate-400">Match found:</span> {matchedPrice !== null ? `₹${matchedPrice.toLocaleString('en-IN')}` : 'None'}</p>
            <p><span className="font-semibold text-slate-400">Calculated Cost/pc:</span> {calculatedCost !== null ? `₹${calculatedCost.toLocaleString('en-IN')}` : 'None'}</p>
            <p><span className="font-semibold text-slate-400">Total Row Cost:</span> {calculatedCost !== null ? `₹${(calculatedCost * parseInt(pieces)).toLocaleString('en-IN')}` : 'None'}</p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400 mb-2">Matrix Options Returned</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {result.matrix_options?.map((opt: any, i: number) => (
                <div key={i} className="border p-2 rounded bg-slate-50 flex justify-between">
                  <span>{opt.quality_label}·{opt.color_label}</span>
                  <span className="font-bold text-slate-700">₹{opt.price.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
