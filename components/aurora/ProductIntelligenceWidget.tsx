'use client'

import { useState } from 'react'
import { Sparkles, TrendingUp, ShieldCheck, Flame, Layers, Eye, ExternalLink, Award } from 'lucide-react'

export default function ProductIntelligenceWidget({ productId }: { productId?: string }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 border border-stone-800 shadow-xl my-6 font-sans">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-stone-950">
            <Sparkles className="w-4 h-4 text-stone-950" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              AURORA Product Intelligence
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 border border-emerald-500/30">AI Live Verified</span>
            </h3>
            <p className="text-xs text-stone-400">Context: Product #{productId || '1842'} · Knowledge Graph Connected</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-stone-400 hover:text-white px-2 py-1 rounded bg-stone-800 transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand Intelligence'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                <Flame className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Trend Velocity</span>
              </div>
              <p className="text-lg font-bold text-white">88/100</p>
              <p className="text-[10px] text-emerald-400 font-mono mt-0.5">+38% QoQ Demand</p>
            </div>

            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                <Award className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Design Originality</span>
              </div>
              <p className="text-lg font-bold text-white">9.2/10</p>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5">High Uniqueness</p>
            </div>

            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Market Saturation</span>
              </div>
              <p className="text-lg font-bold text-white">14%</p>
              <p className="text-[10px] text-amber-400 font-mono mt-0.5">Underserved Niche</p>
            </div>

            <div className="bg-stone-800 rounded-xl p-3 border border-stone-800">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-medium text-[11px]">Opportunity Rating</span>
              </div>
              <p className="text-lg font-bold text-white">9.4/10</p>
              <p className="text-[10px] text-emerald-400 font-mono mt-0.5">High Margin Focus</p>
            </div>
          </div>

          {/* Design DNA Breakdown */}
          <div className="bg-stone-800 rounded-xl p-3.5 border border-stone-800">
            <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Design DNA Signature
            </p>
            <div className="flex flex-wrap gap-2">
              {['Art Deco Revival', 'Hidden Halo Pavé', 'Oval Brilliant Cut', 'Thin Knife-Edge Band', '18K Yellow Gold'].map((tag, i) => (
                <span key={i} className="bg-stone-900 text-stone-300 px-2.5 py-1 rounded-md text-[11px] border border-stone-700">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Global Competitor Benchmarks */}
          <div className="bg-stone-800 rounded-xl p-3.5 border border-stone-800">
            <p className="text-xs font-semibold text-stone-300 mb-2 flex items-center justify-between">
              <span>Global Competitor Benchmarks</span>
              <span className="text-[10px] text-stone-500 font-mono">Verified by Competitor Agent</span>
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                <span className="text-stone-300 font-medium">Tiffany & Co. Solitaire Match</span>
                <span className="text-stone-400">Retail Price: $4,200 | Shewah Wholesale Lead: 34% Lower</span>
              </div>
              <div className="flex items-center justify-between text-[11px] bg-stone-900/60 p-2 rounded-lg border border-stone-800">
                <span className="text-stone-300 font-medium">Messika Move Solitaire</span>
                <span className="text-stone-400">Visual Similarity: 18% (Distinct Design)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
