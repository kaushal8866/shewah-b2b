import { KnowledgeGraphNode, KnowledgeGraphEdge, KnowledgePack } from '../types/agent'

/**
 * AURORA Knowledge Graph Service
 * Central knowledge graph maintaining entities, relationships, and confidence weights.
 */
class KnowledgeGraphService {
  private nodes: Map<string, KnowledgeGraphNode> = new Map()
  private edges: Map<string, KnowledgeGraphEdge> = new Map()

  constructor() {
    this.seedSampleGraphData()
  }

  private seedSampleGraphData() {
    const defaultNodes: KnowledgeGraphNode[] = [
      {
        id: 'node_halo_solitaire',
        type: 'product',
        name: 'Hidden Halo Oval Solitaire Ring',
        confidence: 0.94,
        updatedAt: new Date().toISOString(),
        properties: {
          category: 'Rings',
          style: 'Modern Minimalist',
          popularityScore: 92,
          saturation: '18% (Underserved)',
          goldKarat: 18,
          diamondCut: 'Oval',
          settingType: 'Hidden Halo Pavé',
        },
      },
      {
        id: 'node_art_deco',
        type: 'motif',
        name: 'Art Deco Revival',
        confidence: 0.91,
        updatedAt: new Date().toISOString(),
        properties: {
          era: '1920s Modern',
          growthVelocity: '+42% QoQ',
          keyFeatures: ['Geometric Filigree', 'Milgrain Edges', 'Step-cut accents'],
        },
      },
      {
        id: 'node_bridal_in',
        type: 'trend',
        name: 'Indian Bridal Sleek Minimalist Shift',
        confidence: 0.89,
        updatedAt: new Date().toISOString(),
        properties: {
          region: 'India / NRI US-UK',
          trendStage: 'Emerging High Velocity',
          demandMultiplier: '1.4x',
        },
      },
      {
        id: 'node_emerald_pendant',
        type: 'product',
        name: 'Colombian Emerald Drop Pendant',
        confidence: 0.93,
        updatedAt: new Date().toISOString(),
        properties: {
          category: 'Pendants',
          style: 'High Fine Jewelry',
          popularityScore: 88,
          saturation: '12%',
        },
      },
    ]

    for (const n of defaultNodes) this.nodes.set(n.id, n)

    const defaultEdges: KnowledgeGraphEdge[] = [
      {
        id: 'edge_1',
        sourceId: 'node_halo_solitaire',
        targetId: 'node_bridal_in',
        relation: 'DRIVES_DEMAND_FOR',
        weight: 0.92,
        evidenceIds: ['ev_market_1'],
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'edge_2',
        sourceId: 'node_halo_solitaire',
        targetId: 'node_art_deco',
        relation: 'INCORPORATES_MOTIF',
        weight: 0.88,
        evidenceIds: ['ev_design_2'],
        updatedAt: new Date().toISOString(),
      },
    ]

    for (const e of defaultEdges) this.edges.set(e.id, e)
  }

  public getNode(id: string): KnowledgeGraphNode | undefined {
    return this.nodes.get(id)
  }

  public getAllNodes(): KnowledgeGraphNode[] {
    return Array.from(this.nodes.values())
  }

  public getEdgesForNode(nodeId: string): KnowledgeGraphEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.sourceId === nodeId || e.targetId === nodeId
    )
  }

  public upsertNode(node: KnowledgeGraphNode) {
    this.nodes.set(node.id, node)
  }

  public upsertEdge(edge: KnowledgeGraphEdge) {
    this.edges.set(edge.id, edge)
  }

  public searchNodes(query: string): KnowledgeGraphNode[] {
    const q = query.toLowerCase()
    return Array.from(this.nodes.values()).filter(
      n => n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    )
  }

  public getGraphStats() {
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      lastUpdated: new Date().toISOString(),
    }
  }
}

export const knowledgeGraphService = new KnowledgeGraphService()
