'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, Bot, Cpu, Globe, Search, Layers, TrendingUp, Compass, Target, Package, FileText, Activity, ArrowRight, ShieldCheck, Zap, Database
} from 'lucide-react'

const WORKSPACES = [
  { id: 'copilot', name: 'Founder Copilot', desc: 'Conversational CIO Orchestrator & Context-Aware Assistant', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'workforce', name: 'AI Workforce Monitor', desc: 'Live telemetry, execution logs, latency & health for 17 AI Agents', icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'research', name: 'Research Centre', desc: 'Global luxury jewelry discovery & visual web scraper extracts', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'competitors', name: 'Competitor Intelligence', desc: 'Brand positioning maps, launch tracking & competitor price shifts', icon: Search, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'design', name: 'Design Intelligence', desc: 'Design DNA fingerprints, geometry analysis & originality scoring', icon: Layers, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  { id: 'consumer', name: 'Consumer Intelligence', desc: 'D2C inquiry sentiment, buying triggers & objection matrices', icon: Target, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'trends', name: 'Trend Centre', desc: 'Growth velocity forecasting & regional luxury demand maps', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { id: 'graph', name: 'Knowledge Graph', desc: 'Visual explorer for Jewelry Knowledge Graph entities & relations', icon: Database, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  { id: 'packs', name: 'Knowledge Packs', desc: 'Curated domain knowledge bundles & seasonal digests', icon: Package, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'opportunities', name: 'Opportunity Engine', desc: 'High-margin market whitespace alerts & underserved price tiers', icon: Compass, color: 'text-lime-400', bg: 'bg-lime-500/10 border-lime-500/20' },
  { id: 'builder', name: 'Collection Builder', desc: 'Assortment mix balance, set completion & SKU optimization', icon: Layers, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  { id: 'reports', name: 'Intelligence Reports', desc: 'Conversational deep-dive report generator & PDF artifacts', icon: FileText, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { id: 'overview', name: 'System Overview', desc: 'High-level architecture topology & active system status', icon: Activity, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
]

export default function AuroraHubPage() {
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/aurora/insights')
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(() => {})
  }, [])

  return (
    <div className="p-4 lg:p-8 bg-stone-950 min-h-screen text-stone-100 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-6 lg:p-8 border border-stone-800 shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mb-3">
            <Sparkles className="w-3.5 h-3.5" /> AURORA AI Operating System (AIOS) v1.0
          </div>
          <h1 className="text-2xl lg:text-4xl font-serif font-bold text-white tracking-tight">
            Shewah Intelligence Engine
          </h1>
          <p className="text-stone-400 text-sm mt-2 max-w-2xl leading-relaxed">
            AURORA is the continuous background AI workforce powering strategic decision-making across Shewah Admin. 17 specialized AI agents autonomously research global markets, build the Jewelry Knowledge Graph, evaluate CAD risks, and optimize commercial positioning.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-stone-900/80 px-4 py-2.5 rounded-xl border border-stone-800 flex items-center gap-3">
              <Bot className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-[10px] uppercase font-mono text-stone-400">Active Workforce</p>
                <p className="text-sm font-semibold text-white">17 AI Agents Operational</p>
              </div>
            </div>

            <div className="bg-stone-900/80 px-4 py-2.5 rounded-xl border border-stone-800 flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-[10px] uppercase font-mono text-stone-400">Knowledge Graph</p>
                <p className="text-sm font-semibold text-white">1,420 Graph Nodes Synchronized</p>
              </div>
            </div>

            <div className="bg-stone-900/80 px-4 py-2.5 rounded-xl border border-stone-800 flex items-center gap-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-[10px] uppercase font-mono text-stone-400">Execution Bus</p>
                <p className="text-sm font-semibold text-white">120ms Avg Latency</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspaces Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" /> Intelligence Workspaces
        </h2>
        <p className="text-xs text-stone-400 mb-4">
          Visualisation windows into underlying AI agent task pipelines and Knowledge Graph modules.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKSPACES.map(ws => {
            const Icon = ws.icon
            return (
              <Link
                key={ws.id}
                href={`/aurora/${ws.id}`}
                className="bg-stone-900 hover:bg-stone-800 p-5 rounded-2xl border border-stone-800 hover:border-stone-700 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${ws.bg} border`}>
                      <Icon className={`w-5 h-5 ${ws.color}`} />
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {ws.name}
                  </h3>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                    {ws.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-[10px] font-mono text-stone-500">
                  <span>AIOS Module</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
