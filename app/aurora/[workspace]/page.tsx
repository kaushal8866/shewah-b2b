'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Bot, Cpu, Sparkles, Activity, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Clock, Database, Layers, Terminal
} from 'lucide-react'

export default function AuroraWorkspacePage() {
  const params = useParams()
  const workspace = (params.workspace as string) || 'overview'
  const [agents, setAgents] = useState<any[]>([])
  const [taskLogs, setTaskLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/aurora/insights')
      .then(r => r.json())
      .then(d => {
        setAgents(d.agents || [])
        setTaskLogs(d.taskLogs || [])
      })
      .finally(() => setLoading(false))
  }, [workspace])

  const workspaceTitles: Record<string, string> = {
    copilot: 'Founder Copilot Workspace',
    workforce: 'AI Workforce Monitor & Telemetry',
    research: 'Global Research Centre',
    competitors: 'Competitor Intelligence Centre',
    design: 'Design Intelligence & DNA Workspace',
    consumer: 'Consumer Intelligence & Intent Explorer',
    trends: 'Trend Velocity & Forecasting Centre',
    graph: 'Knowledge Graph Visual Explorer',
    packs: 'Knowledge Packs Library',
    opportunities: 'Opportunity Engine & Whitespace Matrix',
    builder: 'Collection Strategy Builder',
    reports: 'Conversational Intelligence Reports',
    overview: 'AURORA System Overview',
  }

  const title = workspaceTitles[workspace] || 'AURORA Workspace'

  return (
    <div className="p-4 lg:p-8 bg-[#0B0F17] min-h-screen text-stone-100 font-sans">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/aurora" className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono">
            <Sparkles className="w-3.5 h-3.5" /> AURORA AIOS Workspace
          </div>
          <h1 className="text-xl lg:text-2xl font-semibold text-white mt-0.5">{title}</h1>
        </div>
      </div>

      {/* Main Workspace View */}
      {workspace === 'workforce' ? (
        <div className="space-y-6">
          <div className="bg-[#161F30] rounded-2xl p-6 border border-stone-800">
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" /> Active AI Workforce Telemetry (17 Agents)
            </h2>
            <p className="text-xs text-stone-400 mb-6">Real-time execution status, task throughput, latency, and confidence scoring.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((ag: any) => (
                <div key={ag.id} className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-amber-300 font-mono">{ag.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {ag.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed mb-3 line-clamp-2">{ag.mission}</p>

                  <div className="pt-2 border-t border-stone-800 text-[10px] font-mono text-stone-500 flex items-center justify-between">
                    <span>Tasks: {ag.executionStats.totalTasksRun}</span>
                    <span>Success: {ag.executionStats.successRate}%</span>
                    <span>Avg: {ag.executionStats.avgLatencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : workspace === 'graph' ? (
        <div className="bg-[#161F30] rounded-2xl p-6 border border-stone-800 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" /> Jewelry Knowledge Graph Explorer
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">Entity relationship network connecting products, brands, motifs, gems, and trends.</p>
            </div>
            <div className="flex gap-2 font-mono text-xs text-stone-400">
              <span className="bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800">1,420 Nodes</span>
              <span className="bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-800">3,890 Edges</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
              <p className="text-xs font-semibold text-amber-300 mb-3">Sample Graph Entities</p>
              <div className="space-y-2 text-xs">
                <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Hidden Halo Oval Solitaire Ring</p>
                    <p className="text-[10px] text-stone-400">Type: Product · Style: Modern Minimalist</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">94% Confidence</span>
                </div>

                <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Art Deco Revival</p>
                    <p className="text-[10px] text-stone-400">Type: Motif · Growth Velocity: +42% QoQ</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">91% Confidence</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
              <p className="text-xs font-semibold text-indigo-300 mb-3">Graph Edge Relationships</p>
              <div className="space-y-2 text-xs">
                <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800 font-mono text-[11px]">
                  <span className="text-amber-300">Hidden Halo Oval Solitaire</span>
                  <span className="text-stone-500 font-sans mx-2">── DRIVES_DEMAND_FOR ──►</span>
                  <span className="text-emerald-300">Indian Bridal Shift</span>
                </div>
                <div className="bg-stone-900 p-2.5 rounded-lg border border-stone-800 font-mono text-[11px]">
                  <span className="text-amber-300">Hidden Halo Oval Solitaire</span>
                  <span className="text-stone-500 font-sans mx-2">── INCORPORATES_MOTIF ──►</span>
                  <span className="text-indigo-300">Art Deco Revival</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#161F30] rounded-2xl p-6 border border-stone-800 space-y-4 text-xs">
          <div className="flex items-center gap-3 bg-stone-900/80 p-4 rounded-xl border border-stone-800 text-stone-300">
            <Terminal className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-white text-sm">AIRuntime Agent Workforce Active</p>
              <p className="text-stone-400 mt-0.5">
                This workspace visualization connects to live task streams managed by the CIO Agent and 17 AI Workforce agents. All strategic insights are synchronized into the Knowledge Graph.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
              <p className="text-stone-400 font-mono text-[10px]">WORKFLOW STATUS</p>
              <p className="text-base font-semibold text-emerald-400 mt-1">100% Operational</p>
            </div>
            <div className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
              <p className="text-stone-400 font-mono text-[10px]">EVENT BUS QUEUE</p>
              <p className="text-base font-semibold text-amber-400 mt-1">0 Tasks Pending</p>
            </div>
            <div className="bg-[#0F172A] p-4 rounded-xl border border-stone-800">
              <p className="text-stone-400 font-mono text-[10px]">CONFIDENCE GATE</p>
              <p className="text-base font-semibold text-blue-400 mt-1">&ge; 85% Verified</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
