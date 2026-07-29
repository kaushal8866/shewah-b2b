'use client'

import { useState } from 'react'
import { Cpu, ShieldCheck, AlertTriangle, Lightbulb, Wrench, CheckCircle2, DollarSign } from 'lucide-react'

export default function CadIntelligenceWidget({ cadRequestId }: { cadRequestId?: string }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 border border-stone-800 shadow-xl my-6 font-sans">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-stone-950">
            <Cpu className="w-4 h-4 text-stone-950" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              AURORA CAD & Manufacturing Intelligence
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">48h SLA Evaluated</span>
            </h3>
            <p className="text-xs text-stone-400">CAD Request: #{cadRequestId || 'SH-CAD-2026-004'} · Mfg Agent Active</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-stone-400 hover:text-white px-2 py-1 rounded bg-stone-800 transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand Insights'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Casting Void Risk</span>
              </div>
              <p className="text-lg font-bold text-white">Low Risk (98%)</p>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5">Prong thickness 1.1mm verified</p>
            </div>

            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                <Wrench className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Karigar Setting Time</span>
              </div>
              <p className="text-lg font-bold text-white">4.2 Hours</p>
              <p className="text-[10px] text-amber-400 font-mono mt-0.5">Standard Setting Effort</p>
            </div>

            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Gold Weight Est. (18K)</span>
              </div>
              <p className="text-lg font-bold text-white">3.85 grams</p>
              <p className="text-[10px] text-emerald-400 font-mono mt-0.5">2.88g Pure 24K Mass</p>
            </div>
          </div>

          {/* Design Simplification & Cost Optimization */}
          <div className="bg-stone-800 rounded-xl p-3.5 border border-stone-800">
            <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> AI Design Simplification Recommendation
            </p>
            <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800 space-y-1">
              <p className="text-stone-300 font-medium text-[11px]">
                Reducing micro-pavé count from 24 to 18 stones on the inner bridge saves 1.1 hours setting time without reducing front-facing visual sparkle.
              </p>
              <p className="text-[10px] text-emerald-400 font-mono">
                Estimated Production Savings: ₹2,400 per unit ($29 USD)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
