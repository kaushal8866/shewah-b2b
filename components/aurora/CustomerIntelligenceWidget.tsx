'use client'

import { useState } from 'react'
import { Heart, MessageSquare, Target, UserCheck, Sparkles } from 'lucide-react'

export default function CustomerIntelligenceWidget({ customerId }: { customerId?: string }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 border border-stone-800 shadow-xl my-6 font-sans">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-stone-950">
            <Heart className="w-4 h-4 text-stone-950" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              AURORA Consumer Intelligence
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 border border-purple-500/30">Persona Decoded</span>
            </h3>
            <p className="text-xs text-stone-400">Customer #{customerId || 'CUST-882'} · Sentiment Agent Active</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-stone-800 rounded-xl p-3.5 border border-stone-800">
              <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Primary Buying Motivations
              </p>
              <ul className="space-y-1.5 text-stone-300 text-[11px]">
                <li className="flex items-center gap-1.5">• Timeless Bridal Elegance with Custom Touch</li>
                <li className="flex items-center gap-1.5">• High Concern for Diamond Certification & Clarity</li>
                <li className="flex items-center gap-1.5">• Prefers 18K Yellow Gold with Oval Solitaires</li>
              </ul>
            </div>

            <div className="bg-stone-800 rounded-xl p-3.5 border border-stone-800">
              <p className="text-xs font-semibold text-stone-300 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Common Objections & Solutions
              </p>
              <div className="space-y-1 text-[11px] text-stone-400">
                <p className="text-stone-300 font-medium">Turnaround Time Anxiety:</p>
                <p className="bg-stone-900/60 p-2 rounded border border-stone-800">
                  Reassure with 48-hour CAD SLA & WhatsApp stage updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
