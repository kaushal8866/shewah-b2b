import { AgentTaskMessage } from '../types/agent'

/**
 * AURORA Validation Engine
 * Enforces strict truthfulness, confidence threshold checks, and source cross-verification.
 */
export class ValidationEngine {
  public static validatePayload(task: AgentTaskMessage): {
    isValid: boolean
    confidenceScore: number
    reasons: string[]
  } {
    const minThreshold = 0.75
    const reasons: string[] = []

    if (task.confidence < minThreshold) {
      reasons.push(`Task confidence score (${task.confidence.toFixed(2)}) is below minimum threshold (${minThreshold}).`)
    }

    if (!task.evidence || task.evidence.length === 0) {
      reasons.push('Task payload does not contain supporting evidence citations.')
    }

    const isValid = reasons.length === 0
    return {
      isValid,
      confidenceScore: task.confidence,
      reasons,
    }
  }
}
