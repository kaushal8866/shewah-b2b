import React, { useState, useEffect } from 'react'
import {
  computeAllMetalWeights,
  getMetalWeight,
  DENSITY_FACTORS,
  MetalWeights,
  MetalColor,
  GoldKarat
} from '../lib/karat'

interface MetalWeightCalculatorProps {
  metalType: 'gold' | 'silver'
  initialWeights?: MetalWeights
  initialRefKarat?: string
  initialRefColor?: string
  onChange: (data: {
    metalWeights: MetalWeights
    refKarat: string
    refColor: string
    weight22: number // for backward compatibility / pricing reference
  }) => void
}

export default function MetalWeightCalculator({
  metalType,
  initialWeights = {},
  initialRefKarat,
  initialRefColor,
  onChange
}: MetalWeightCalculatorProps) {
  // Determine initial states
  const defaultKarat = metalType === 'gold' ? '22K' : 'silver_925'
  const defaultColor = metalType === 'gold' ? 'yellow' : 'default'

  const [refKarat, setRefKarat] = useState(initialRefKarat || defaultKarat)
  const [refColor, setRefColor] = useState(initialRefColor || defaultColor)
  
  // Find initial weight to display
  const initialWeightVal = (() => {
    if (initialWeights && Object.keys(initialWeights).length > 0) {
      return getMetalWeight(initialWeights, initialRefKarat || defaultKarat, initialRefColor || defaultColor) || ''
    }
    return ''
  })()
  
  const [weightInput, setWeightInput] = useState<string>(initialWeightVal ? String(initialWeightVal) : '')

  // Reset/sync reference karat/color if metalType changes
  useEffect(() => {
    if (metalType === 'gold') {
      if (!refKarat.endsWith('K')) {
        setRefKarat('22K')
        setRefColor('yellow')
      }
    } else {
      if (refKarat.endsWith('K')) {
        setRefKarat('silver_925')
        setRefColor('default')
      }
    }
  }, [metalType])

  const weightNum = parseFloat(weightInput) || 0

  // Calculate all weights dynamically
  const computedWeights = (() => {
    if (weightNum <= 0) return {}
    return computeAllMetalWeights(weightNum, refKarat, refColor)
  })()

  // Trigger change handler
  useEffect(() => {
    const weight22 = getMetalWeight(computedWeights, '22K', 'yellow') || weightNum
    onChange({
      metalWeights: computedWeights,
      refKarat,
      refColor,
      weight22
    })
  }, [weightInput, refKarat, refColor])

  const showColorSelector = metalType === 'gold' && refKarat !== '24K'

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5'
  const inp = 'w-full px-3.5 py-2 rounded-lg border border-stone-200 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all placeholder:text-stone-300'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={lbl}>Reference Karat / Grade *</label>
          <select
            className={inp}
            value={refKarat}
            onChange={(e) => {
              const val = e.target.value
              setRefKarat(val)
              if (val === '24K') {
                setRefColor('yellow')
              }
            }}
          >
            {metalType === 'gold' ? (
              <>
                <option value="24K">24K (Pure Gold)</option>
                <option value="22K">22K Gold</option>
                <option value="18K">18K Gold</option>
                <option value="14K">14K Gold</option>
                <option value="10K">10K Gold</option>
                <option value="9K">9K Gold</option>
              </>
            ) : (
              <>
                <option value="silver_925">Silver 925 (Sterling)</option>
                <option value="silver_999">Silver 999 (Fine)</option>
              </>
            )}
          </select>
        </div>

        {showColorSelector ? (
          <div>
            <label className={lbl}>Reference Alloy Color *</label>
            <select
              className={inp}
              value={refColor}
              onChange={(e) => setRefColor(e.target.value)}
            >
              <option value="yellow">Yellow Gold</option>
              <option value="white">White Gold</option>
              <option value="rose">Rose Gold</option>
            </select>
          </div>
        ) : (
          <div>
            <label className={lbl}>Alloy Color</label>
            <input
              type="text"
              readOnly
              className={`${inp} bg-stone-50 text-stone-400 cursor-not-allowed`}
              value={metalType === 'gold' ? 'Yellow (Pure)' : 'Default (Silver)'}
            />
          </div>
        )}

        <div>
          <label className={lbl}>Weight (grams) *</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            className={inp}
            placeholder="e.g. 5.250"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
        </div>
      </div>

      {weightNum > 0 && (
        <div className="mt-4 rounded-xl border border-stone-100 overflow-hidden">
          <div className="bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100 flex justify-between items-center">
            <span>Alloy-Density Auto-Calculated Weights</span>
            <span className="text-[10px] text-stone-400 font-normal normal-case">Constant volume model (g)</span>
          </div>

          {metalType === 'gold' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-stone-700">
                <thead className="bg-stone-50/50 border-b border-stone-100 text-stone-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Karat</th>
                    <th className="px-4 py-2 text-right font-medium">Yellow</th>
                    <th className="px-4 py-2 text-right font-medium">White</th>
                    <th className="px-4 py-2 text-right font-medium">Rose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {['24K', '22K', '18K', '14K', '10K', '9K'].map((k) => {
                    return (
                      <tr key={k} className="hover:bg-stone-50/30">
                        <td className="px-4 py-2.5 font-medium text-stone-950">{k}</td>
                        {['yellow', 'white', 'rose'].map((c) => {
                          const w = getMetalWeight(computedWeights, k, c)
                          const isRef = refKarat === k && refColor === c
                          const hasValue = w > 0

                          return (
                            <td
                              key={c}
                              className={`px-4 py-2.5 text-right ${
                                isRef
                                  ? 'bg-stone-800/5 font-bold text-stone-800'
                                  : hasValue
                                  ? 'text-stone-850'
                                  : 'text-stone-300 italic'
                              }`}
                            >
                              {hasValue ? `${w.toFixed(3)} g` : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-stone-100 text-center">
              <div className={`px-2 py-3 ${refKarat === 'silver_925' ? 'bg-stone-800/5' : ''}`}>
                <p className="text-xs text-stone-400">Silver 925</p>
                <p className={`text-sm font-semibold ${refKarat === 'silver_925' ? 'text-stone-800' : 'text-stone-850'}`}>
                  {(getMetalWeight(computedWeights, 'silver_925', 'default') || 0).toFixed(3)} g
                </p>
              </div>
              <div className={`px-2 py-3 ${refKarat === 'silver_999' ? 'bg-stone-800/5' : ''}`}>
                <p className="text-xs text-stone-400">Silver 999</p>
                <p className={`text-sm font-semibold ${refKarat === 'silver_999' ? 'text-stone-800' : 'text-stone-850'}`}>
                  {(getMetalWeight(computedWeights, 'silver_999', 'default') || 0).toFixed(3)} g
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
