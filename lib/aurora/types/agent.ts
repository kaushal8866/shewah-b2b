/**
 * AURORA AI Operating System (AIOS) Types & Communication Protocol
 */

export type AgentId =
  | 'cio'
  | 'global_research'
  | 'image_vision'
  | 'competitor_intelligence'
  | 'design_intelligence'
  | 'consumer_intelligence'
  | 'manufacturing_intelligence'
  | 'pricing_intelligence'
  | 'trend_intelligence'
  | 'white_space'
  | 'collection_strategy'
  | 'recommendation'
  | 'validation'
  | 'ontology'
  | 'knowledge_pack'
  | 'report'
  | 'memory_learning'

export type AgentStatus = 'idle' | 'busy' | 'validating' | 'error' | 'offline'

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'requires_human_approval'

export interface AgentEvidence {
  id: string
  source: string
  url?: string
  snippet?: string
  confidenceScore: number
  timestamp: string
}

export interface AgentTaskMessage {
  id: string
  traceId: string
  parentTaskId?: string
  senderAgentId: AgentId | 'SYSTEM' | 'FOUNDER_COPILOT'
  targetAgentId: AgentId | 'BROADCAST'
  taskType: string
  priority: TaskPriority
  context: {
    productId?: string
    cadRequestId?: string
    customerId?: string
    orderId?: string
    brandId?: string
    userQuery?: string
    routePath?: string
    customData?: Record<string, any>
  }
  evidence: AgentEvidence[]
  payload: Record<string, any>
  confidence: number
  status: TaskStatus
  dependencies: string[]
  createdAt: string
  updatedAt: string
  result?: Record<string, any>
  error?: string
}

export interface AgentSpec {
  id: AgentId
  name: string
  title: string
  mission: string
  version: string
  status: AgentStatus
  responsibilities: string[]
  inputs: string[]
  outputs: string[]
  availableTools: string[]
  knowledgeDependencies: string[]
  decisionRules: string[]
  memoryBehaviour: string
  humanApprovalRequired: boolean
  successMetrics: string[]
  failureRecovery: string
  confidenceModel: {
    thresholdToPass: number
    evidenceWeight: number
    validationRules: string[]
  }
  executionStats: {
    totalTasksRun: number
    successRate: number
    avgLatencyMs: number
    lastActiveAt?: string
  }
}

export interface KnowledgeGraphNode {
  id: string
  type: 'product' | 'brand' | 'gemstone' | 'setting' | 'motif' | 'trend' | 'persona' | 'concept'
  name: string
  properties: Record<string, any>
  confidence: number
  updatedAt: string
}

export interface KnowledgeGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relation: string
  weight: number
  evidenceIds: string[]
  updatedAt: string
}

export interface KnowledgePack {
  id: string
  title: string
  category: string
  summary: string
  nodes: KnowledgeGraphNode[]
  insights: string[]
  confidenceScore: number
  updatedAt: string
}

export interface OntologyTerm {
  id: string
  category: 'aesthetic' | 'karat' | 'setting' | 'gem_cut' | 'price_tier' | 'motif'
  standardName: string
  synonyms: string[]
  definition: string
}
