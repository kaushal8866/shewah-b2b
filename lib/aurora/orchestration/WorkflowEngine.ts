import { AgentTaskMessage, AgentId } from '../types/agent'
import { eventBus } from './EventBus'
import { agentRegistry } from '../runtime/AgentRegistry'

export interface WorkflowPipelineStep {
  agentId: AgentId
  taskType: string
  payload?: Record<string, any>
}

/**
 * AURORA Workflow Engine
 * Orchestrates multi-agent pipelines sequentially and in parallel.
 */
export class WorkflowEngine {
  public static async executePipeline(
    traceId: string,
    initialContext: AgentTaskMessage['context'],
    steps: WorkflowPipelineStep[]
  ): Promise<{ traceId: string; status: 'completed' | 'failed'; results: AgentTaskMessage[] }> {
    const results: AgentTaskMessage[] = []
    let previousResult: Record<string, any> = {}

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      agentRegistry.updateStatus(step.agentId, 'busy')
      const startTime = Date.now()

      const taskMessage: AgentTaskMessage = {
        id: `task_${Date.now()}_${i}`,
        traceId,
        senderAgentId: i === 0 ? 'cio' : steps[i - 1].agentId,
        targetAgentId: step.agentId,
        taskType: step.taskType,
        priority: 'normal',
        context: initialContext,
        evidence: [],
        payload: { ...step.payload, previousStepOutput: previousResult },
        confidence: 0.9,
        status: 'running',
        dependencies: i > 0 ? [results[i - 1].id] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const published = await eventBus.publish(taskMessage)
      const last = published[published.length - 1] || taskMessage
      results.push(last)
      previousResult = last.result || {}

      const duration = Date.now() - startTime
      agentRegistry.recordExecution(step.agentId, last.status !== 'failed', duration)
      agentRegistry.updateStatus(step.agentId, 'idle')

      if (last.status === 'failed') {
        return { traceId, status: 'failed', results }
      }
    }

    return { traceId, status: 'completed', results }
  }
}
