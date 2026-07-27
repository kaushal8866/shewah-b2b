import { NextRequest, NextResponse } from 'next/server'
import { agentRegistry } from '@/lib/aurora/runtime/AgentRegistry'
import { eventBus } from '@/lib/aurora/orchestration/EventBus'
import { knowledgeGraphService } from '@/lib/aurora/infrastructure/KnowledgeGraphService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const specs = agentRegistry.getAllSpecs()
    const history = eventBus.getHistory(30)
    const graphStats = knowledgeGraphService.getGraphStats()

    return NextResponse.json({
      agents: specs,
      taskLogs: history,
      graphStats,
    })
  } catch (err: any) {
    console.error('[AURORA.insights] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
