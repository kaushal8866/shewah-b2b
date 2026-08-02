'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Send, Bot, Cpu, CheckCircle2, ChevronRight, RefreshCw, BrainCircuit, Lightbulb, ExternalLink } from 'lucide-react'

export default function FounderCopilotFloating() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState<
    Array<{
      role: 'user' | 'assistant'
      text: string
      insights?: Array<{ title: string; detail: string; score?: string }>
      suggestedActions?: string[]
      timestamp: string
    }>
  >([])

  // Detect route parameters for context awareness
  const getRouteContext = () => {
    let contextLabel = 'Global Shewah Admin'
    let productId: string | undefined
    let cadRequestId: string | undefined
    let customerId: string | undefined

    if (pathname.includes('/catalog/') || pathname.includes('/products/')) {
      const parts = pathname.split('/')
      productId = parts[parts.length - 1]
      contextLabel = `Product Context (#${productId})`
    } else if (pathname.includes('/cad-requests/')) {
      const parts = pathname.split('/')
      cadRequestId = parts[parts.length - 1]
      contextLabel = `CAD Request Context (#${cadRequestId})`
    } else if (pathname.includes('/customers/')) {
      const parts = pathname.split('/')
      customerId = parts[parts.length - 1]
      contextLabel = `Customer Context (#${customerId})`
    } else if (pathname.includes('/orders/')) {
      contextLabel = `Order Context (${pathname})`
    } else if (pathname.startsWith('/aurora')) {
      contextLabel = `AURORA Intelligence Workspace`
    }

    return { contextLabel, productId, cadRequestId, customerId }
  }

  const { contextLabel, productId, cadRequestId, customerId } = getRouteContext()

  async function handleSend(customQuery?: string) {
    const activeQuery = customQuery || query
    if (!activeQuery.trim() || loading) return

    const userMsg = {
      role: 'user' as const,
      text: activeQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setConversation(prev => [...prev, userMsg])
    if (!customQuery) setQuery('')
    setLoading(true)

    try {
      const res = await fetch('/api/aurora/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          routePath: pathname,
          productId,
          cadRequestId,
          customerId,
          // Without this every message was a cold start — "what about last
          // month?" had nothing to refer back to. Server caps and validates it.
          history: conversation.slice(-8).map(m => ({ role: m.role, text: m.text })),
        }),
      })

      const data = await res.json()
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      // Surface the server's own error text (rate limit, permission, outage)
      // instead of pretending something was answered.
      if (!res.ok || data.error) {
        setConversation(prev => [...prev, {
          role: 'assistant' as const,
          text: data.error || `Request failed (${res.status}).`,
          insights: [], suggestedActions: [], timestamp: stamp,
        }])
        return
      }

      setConversation(prev => [...prev, {
        role: 'assistant' as const,
        text: data.answer || "I didn't get an answer back for that.",
        insights: data.insights || [],
        suggestedActions: data.suggestedActions || [],
        timestamp: stamp,
      }])
    } catch (err) {
      // This branch used to display INVENTED market data on a network error —
      // "Oval & Emerald cuts surging +42% in luxury segments · 88/100",
      // "Design DNA verified against 1,400+ market references · 9.2/10".
      // None of it was measured or fetched. Fabricated figures about the
      // user's own market, shown as if real, are worse than no answer: they
      // are indistinguishable from a genuine reading.
      setConversation(prev => [...prev, {
        role: 'assistant',
        text: "I couldn't reach the server. Check your connection and try again.",
        insights: [],
        suggestedActions: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setLoading(false)
    }
  }

  // Pre-seed greeting on first open
  useEffect(() => {
    if (conversation.length === 0) {
      setConversation([
        {
          role: 'assistant',
          // Was: "Welcome back, Founder. I am your Chief Intelligence Officer…"
          // plus two status cards, one of which asserted "17 AI Agents
          // operational & synchronized — 100%". Nothing measured that; the
          // registry holds specs, not running agents. A greeting that claims a
          // system state it cannot observe is the first thing that makes the
          // whole assistant read as theatre.
          text: `You're on ${contextLabel}. Ask me anything about it, or about the business.`,
          insights: [],
          suggestedActions: [
            'What needs my attention today?',
            'What is outstanding on invoices?',
            'Which CAD requests are overdue?',
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }, [contextLabel])

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-stone-900 text-white px-4 py-3 shadow-2xl border border-amber-500/40 hover:border-amber-400 hover:scale-105 transition-all group"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-stone-950 font-bold shadow-sm">
          <Sparkles className="w-4 h-4 text-stone-950 animate-pulse" />
        </div>
        <span className="text-xs font-semibold tracking-wide pr-1">Founder Copilot</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-stone-900 text-stone-100 shadow-2xl border-l border-stone-800 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-stone-800 bg-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-stone-950 font-bold">
                <BrainCircuit className="w-5 h-5 text-stone-950" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  Founder Copilot
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">CIO AIOS</span>
                </h3>
                <p className="text-xs text-stone-400 font-mono truncate max-w-[260px]">{contextLabel}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conversation Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
            {conversation.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-stone-800 text-white rounded-br-none'
                      : 'bg-stone-800 text-stone-200 border border-stone-800 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>

                  {/* Context Insights */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-stone-700/60">
                      {msg.insights.map((ins, i) => (
                        <div key={i} className="bg-stone-900/60 rounded-lg p-2 flex items-center justify-between gap-2 border border-stone-800">
                          <div>
                            <p className="text-[11px] font-medium text-amber-300">{ins.title}</p>
                            <p className="text-[10px] text-stone-400">{ins.detail}</p>
                          </div>
                          {ins.score && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 font-semibold shrink-0">
                              {ins.score}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested Quick Actions */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-stone-700/40 flex flex-wrap gap-1.5">
                      {msg.suggestedActions.map((act, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(act)}
                          className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2 py-1 rounded-md border border-amber-500/30 flex items-center gap-1 transition-colors text-left"
                        >
                          <Lightbulb className="w-3 h-3 shrink-0" />
                          <span>{act}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-stone-500 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-stone-400 bg-stone-800 p-3 rounded-2xl border border-stone-800 max-w-[80%]">
                <Cpu className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-xs font-mono">CIO Orchestrating 17 AI Agents...</span>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-stone-800 bg-stone-800">
            <div className="flex items-center gap-2 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2">
              <input
                type="text"
                placeholder="Ask Founder Copilot anything..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="w-full bg-transparent text-xs text-white placeholder-stone-500 focus:outline-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!query.trim() || loading}
                className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-500 mt-2 px-1 font-mono">
              <span>AURORA AIOS v1.0</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Connected
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
