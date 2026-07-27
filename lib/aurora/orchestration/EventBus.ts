import { AgentTaskMessage, AgentId } from '../types/agent'

type TaskHandler = (task: AgentTaskMessage) => Promise<AgentTaskMessage>

/**
 * AURORA Event Bus & Task Queue
 * Asynchronous, structured event router for inter-agent communication.
 */
class EventBus {
  private handlers: Map<string, TaskHandler[]> = new Map()
  private taskHistory: AgentTaskMessage[] = []

  public subscribe(taskType: string, handler: TaskHandler) {
    const existing = this.handlers.get(taskType) || []
    this.handlers.set(taskType, [...existing, handler])
  }

  public async publish(task: AgentTaskMessage): Promise<AgentTaskMessage[]> {
    this.taskHistory.push(task)
    if (this.taskHistory.length > 500) this.taskHistory.shift()

    const handlers = this.handlers.get(task.taskType) || []
    if (handlers.length === 0) {
      return [
        {
          ...task,
          status: 'completed',
          result: { note: `No explicit subscribers registered for taskType: ${task.taskType}. Task logged.` },
          updatedAt: new Date().toISOString(),
        },
      ]
    }

    const results: AgentTaskMessage[] = []
    for (const handler of handlers) {
      try {
        const res = await handler(task)
        results.push(res)
      } catch (err: any) {
        results.push({
          ...task,
          status: 'failed',
          error: err?.message || String(err),
          updatedAt: new Date().toISOString(),
        })
      }
    }
    return results
  }

  public getHistory(limit = 50): AgentTaskMessage[] {
    return this.taskHistory.slice(-limit).reverse()
  }

  public getHistoryForAgent(agentId: AgentId, limit = 20): AgentTaskMessage[] {
    return this.taskHistory
      .filter(t => t.senderAgentId === agentId || t.targetAgentId === agentId)
      .slice(-limit)
      .reverse()
  }
}

export const eventBus = new EventBus()
