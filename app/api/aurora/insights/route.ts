import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { agentRegistry } from '@/lib/aurora/runtime/AgentRegistry'
import { eventBus } from '@/lib/aurora/orchestration/EventBus'
import { knowledgeGraphService } from '@/lib/aurora/infrastructure/KnowledgeGraphService'

export const dynamic = 'force-dynamic'

/**
 * AURORA system insights — agent registry, recent task log, graph statistics.
 *
 * MASTER ONLY, matching /api/aurora/copilot. This returns internal system
 * structure (which agents exist, what they have been asked to do, how the
 * knowledge graph is shaped) — task logs in particular echo back the queries
 * operators have run, which can carry business context.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role !== 'master') {
    return NextResponse.json(
      { error: 'AURORA is available to the master admin only.' },
      { status: 403 },
    )
  }

  try {
    return NextResponse.json({
      agents: agentRegistry.getAllSpecs(),
      taskLogs: eventBus.getHistory(30),
      graphStats: knowledgeGraphService.getGraphStats(),
    })
  } catch (err: any) {
    console.error('[AURORA.insights] Error:', err)
    return NextResponse.json({ error: 'Could not load insights.' }, { status: 500 })
  }
}
