import { AgentId, AgentSpec, AgentStatus } from '../types/agent'

/**
 * AURORA Agent Registry
 * Manages specs, capabilities, and health metrics for all 17 AI workforce agents.
 */
class AgentRegistry {
  private specs: Map<AgentId, AgentSpec> = new Map()

  constructor() {
    this.initializeDefaultSpecs()
  }

  private initializeDefaultSpecs() {
    const defaultAgents: Array<Omit<AgentSpec, 'status' | 'executionStats'>> = [
      {
        id: 'cio',
        name: 'Chief Intelligence Officer',
        title: 'Chief Intelligence Officer (CIO)',
        mission: 'Orchestrate the entire AI workforce, break down complex prompts into specialized task pipelines, and synthesize unified evidence-backed strategic answers.',
        version: '1.0.0',
        responsibilities: [
          'Decompose Founder prompts into multi-agent task pipelines',
          'Assign work to specialized AI agents',
          'Monitor workflow execution and resolve agent conflicts',
          'Synthesize agent outputs into coherent strategic decisions',
          'Escalate critical decisions for human approval',
        ],
        inputs: ['User Prompts', 'System Triggers', 'Operational Route Context'],
        outputs: ['Executive Summaries', 'Action Plans', 'Task Assignments'],
        availableTools: ['TaskQueue.dispatch', 'WorkflowEngine.createPipeline', 'AgentRegistry.queryHealth'],
        knowledgeDependencies: ['KnowledgeGraph', 'SharedMemory'],
        decisionRules: ['Require >= 0.85 confidence for strategic recommendations', 'Escalate pricing changes > 15% to human approval'],
        memoryBehaviour: 'Retains conversation intent history and active task state',
        humanApprovalRequired: true,
        successMetrics: ['Query Resolution Rate', 'Execution Latency', 'User Satisfaction Score'],
        failureRecovery: 'Fallback to direct Knowledge Graph lookup if pipeline fails',
        confidenceModel: { thresholdToPass: 0.85, evidenceWeight: 0.4, validationRules: ['Multi-source consensus'] },
      },
      {
        id: 'global_research',
        name: 'Global Research Agent',
        title: 'Global Market Research Agent',
        mission: 'Continuously monitor global marketplaces, competitor websites, and visual platforms for new jewelry intelligence.',
        version: '1.0.0',
        responsibilities: [
          'Monitor luxury jewelry launches globally',
          'Scrape product images and specifications',
          'Track trade shows and luxury market trends',
          'Submit raw findings to Knowledge Graph',
        ],
        inputs: ['Market URLs', 'Brand Feeds', 'Social Media Handles'],
        outputs: ['Raw Product Extracts', 'Visual Assets', 'Launch Alerts'],
        availableTools: ['WebScraper', 'MediaExtractor', 'EventBus.publish'],
        knowledgeDependencies: ['OntologyService'],
        decisionRules: ['Deduplicate against existing catalog before logging'],
        memoryBehaviour: 'Caches scraped URLs to prevent duplicate fetches',
        humanApprovalRequired: false,
        successMetrics: ['New Catalog Discoveries/Day', 'Scrape Accuracy'],
        failureRecovery: 'Retry with exponential backoff on network failures',
        confidenceModel: { thresholdToPass: 0.80, evidenceWeight: 0.5, validationRules: ['URL freshness check'] },
      },
      {
        id: 'image_vision',
        name: 'Image Vision Agent',
        title: 'Computer Vision & Aesthetics Agent',
        mission: 'Convert raw jewelry images into structured visual intelligence, extracting gemstone cuts, setting styles, and design motifs.',
        version: '1.0.0',
        responsibilities: [
          'Detect gemstone cuts, metals, and setting techniques',
          'Extract design motifs (Art Deco, Minimalist, Floral)',
          'Generate visual embeddings for similarity search',
          'Score visual luxury positioning',
        ],
        inputs: ['Jewelry Images (Cloudinary/S3)', 'CAD Render Views'],
        outputs: ['Visual Attribute Tags', 'Vector Embeddings', 'Similarity Clusters'],
        availableTools: ['VisionModel', 'VectorSearch', 'FeatureExtractor'],
        knowledgeDependencies: ['OntologyService'],
        decisionRules: ['Flag low-res images (< 400px) for manual review'],
        memoryBehaviour: 'Stores feature embeddings in vector database',
        humanApprovalRequired: false,
        successMetrics: ['Tag Precision', 'Similarity Matching Accuracy'],
        failureRecovery: 'Return partial tags if specific feature extraction fails',
        confidenceModel: { thresholdToPass: 0.82, evidenceWeight: 0.6, validationRules: ['Multi-angle verification'] },
      },
      {
        id: 'competitor_intelligence',
        name: 'Competitor Intelligence Agent',
        title: 'Competitor Strategy & Positioning Agent',
        mission: 'Decode competitor collection strategies, launch cadences, and pricing shifts across luxury jewelry brands.',
        version: '1.0.0',
        responsibilities: [
          'Track competitor price adjustments and discount cadences',
          'Map brand market positioning and collection breadth',
          'Detect competitive whitespace opportunities',
        ],
        inputs: ['Scraped Competitor Catalogs', 'Historical Pricing DB'],
        outputs: ['Competitor Timelines', 'Price Shifts Alerts', 'Positioning Maps'],
        availableTools: ['PriceComparator', 'PositioningMapper'],
        knowledgeDependencies: ['GlobalResearchAgent', 'KnowledgeGraph'],
        decisionRules: ['Alert CIO immediately on competitor price cuts > 10%'],
        memoryBehaviour: 'Maintains historical pricing ledger per brand',
        humanApprovalRequired: false,
        successMetrics: ['Competitor Shift Detection Speed', 'Price Variance Precision'],
        failureRecovery: 'Use cached price benchmarks if real-time check times out',
        confidenceModel: { thresholdToPass: 0.85, evidenceWeight: 0.5, validationRules: ['Cross-reference 2 historical checks'] },
      },
      {
        id: 'design_intelligence',
        name: 'Design Intelligence Agent',
        title: 'Design DNA & Originality Agent',
        mission: 'Analyze design composition, generate Design DNA fingerprints, and score design uniqueness.',
        version: '1.0.0',
        responsibilities: [
          'Deconstruct jewelry design geometry and proportions',
          'Generate Design DNA signatures',
          'Calculate originality & saturation index',
        ],
        inputs: ['CAD Files', 'Product Renders', 'Image Vision Attributes'],
        outputs: ['Design DNA Scorecards', 'Originality Ratings', 'Lineage Maps'],
        availableTools: ['GeometryInspector', 'OriginalityScorer'],
        knowledgeDependencies: ['ImageVisionAgent', 'OntologyService'],
        decisionRules: ['Flag designs with > 85% similarity to existing market items as low-uniqueness'],
        memoryBehaviour: 'Indexes Design DNA vectors in Knowledge Graph',
        humanApprovalRequired: false,
        successMetrics: ['Originality Classification Accuracy'],
        failureRecovery: 'Fallback to component-based heuristic scoring',
        confidenceModel: { thresholdToPass: 0.80, evidenceWeight: 0.5, validationRules: ['Vector distance threshold check'] },
      },
      {
        id: 'consumer_intelligence',
        name: 'Consumer Intelligence Agent',
        title: 'Consumer Sentiment & Intent Agent',
        mission: 'Decipher buyer motivations, objections, and emerging aesthetic preferences from customer touchpoints.',
        version: '1.0.0',
        responsibilities: [
          'Analyze D2C consultation transcripts & WhatsApp inquiries',
          'Identify common objection patterns and buying triggers',
          'Build dynamic customer preference personas',
        ],
        inputs: ['Consultation Submissions', 'WhatsApp Logs', 'Customer Profiles'],
        outputs: ['Objection Matrices', 'Buying Motivation Clusters', 'Persona Cards'],
        availableTools: ['SentimentAnalyzer', 'IntentCategorizer'],
        knowledgeDependencies: ['KnowledgeGraph'],
        decisionRules: ['Cluster objections into 5 core tiers: Price, Size, Metal, Diamond, Delivery'],
        memoryBehaviour: 'Persists customer preference vectors',
        humanApprovalRequired: false,
        successMetrics: ['Objection Identification Accuracy'],
        failureRecovery: 'Log unclassified intent to manual review queue',
        confidenceModel: { thresholdToPass: 0.78, evidenceWeight: 0.4, validationRules: ['Frequency distribution check'] },
      },
      {
        id: 'manufacturing_intelligence',
        name: 'Manufacturing Intelligence Agent',
        title: 'CAD & Production Feasibility Agent',
        mission: 'Evaluate CAD structural feasibility, casting risks, production costs, and suggest design simplifications.',
        version: '1.0.0',
        responsibilities: [
          'Analyze CAD geometry for casting voids & fragile prongs',
          'Estimate metal weight and karigar labor hours',
          'Recommend cost-reducing design simplifications',
        ],
        inputs: ['CAD Requests', 'Gold Karat Specs', 'Vendor Loss Rates'],
        outputs: ['Production Risk Reports', 'Cost Estimates', 'Simplification Tips'],
        availableTools: ['CADWeightMath', 'RiskEvaluator', 'LaborHourCalculator'],
        knowledgeDependencies: ['GoldKaratEngine'],
        decisionRules: ['Flag prongs thinner than 0.8mm as high casting risk'],
        memoryBehaviour: 'Stores historical karigar wastage ratios',
        humanApprovalRequired: false,
        successMetrics: ['Cost Estimation Accuracy (± 5%)'],
        failureRecovery: 'Use conservative fallback density formulas',
        confidenceModel: { thresholdToPass: 0.88, evidenceWeight: 0.6, validationRules: ['Karat math verification'] },
      },
      {
        id: 'pricing_intelligence',
        name: 'Pricing Intelligence Agent',
        title: 'Dynamic Pricing & Margin Agent',
        mission: 'Optimize wholesale and retail price structures based on live karat spot rates, labor, and luxury positioning.',
        version: '1.0.0',
        responsibilities: [
          'Calculate live gold karat pure mass costs',
          'Evaluate competitive retail price elasticity',
          'Recommend optimal margin markups for quotes & catalogs',
        ],
        inputs: ['Live Gold Rates', 'Product Metal Weights', 'Diamond Spec Cards'],
        outputs: ['Itemized Price Breakups', 'Margin Recommendations'],
        availableTools: ['KaratFormulaEngine', 'ElasticityEstimator'],
        knowledgeDependencies: ['GoldRatesDB'],
        decisionRules: ['Ensure wholesale quotes maintain minimum 22% gross margin'],
        memoryBehaviour: 'Logs daily spot rate snapshots',
        humanApprovalRequired: true,
        successMetrics: ['Margin Compliance Rate'],
        failureRecovery: 'Use last verified gold rate if API fetch fails',
        confidenceModel: { thresholdToPass: 0.90, evidenceWeight: 0.7, validationRules: ['Exact formula reconciliation'] },
      },
      {
        id: 'trend_intelligence',
        name: 'Trend Intelligence Agent',
        title: 'Trend Velocity & Forecasting Agent',
        mission: 'Track and forecast jewelry aesthetic growth momentum across regional luxury markets.',
        version: '1.0.0',
        responsibilities: [
          'Calculate trend growth velocity index',
          'Predict aesthetic lifecycle phases (Emerging, Peak, Saturated)',
          'Map trend adoption across India, US, UK, UAE',
        ],
        inputs: ['Global Research Discoveries', 'Historical Trend DB'],
        outputs: ['Trend Velocity Scorecards', 'Regional Demand Forecasts'],
        availableTools: ['VelocityCalculator', 'LifecyclePredictor'],
        knowledgeDependencies: ['KnowledgeGraph', 'GlobalResearchAgent'],
        decisionRules: ['Mark trends with > 40% QoQ growth as High Velocity'],
        memoryBehaviour: 'Stores quarterly trend momentum metrics',
        humanApprovalRequired: false,
        successMetrics: ['6-Month Trend Direction Accuracy'],
        failureRecovery: 'Smooth variance using 90-day moving average',
        confidenceModel: { thresholdToPass: 0.82, evidenceWeight: 0.5, validationRules: ['Multi-region data verification'] },
      },
      {
        id: 'white_space',
        name: 'White Space Agent',
        title: 'Market Gap & Opportunity Agent',
        mission: 'Identify high-margin market gaps and unfulfilled consumer demands.',
        version: '1.0.0',
        responsibilities: [
          'Cross-reference consumer demand against competitor catalogs',
          'Identify missing price tiers and aesthetic gaps',
          'Score commercial opportunity potential',
        ],
        inputs: ['Consumer Intelligence', 'Competitor Maps', 'Trend Data'],
        outputs: ['Opportunity Ratings', 'White Space Alert Cards'],
        availableTools: ['GapMatrixCalculator', 'OpportunityScorer'],
        knowledgeDependencies: ['KnowledgeGraph'],
        decisionRules: ['Highlight opportunities with > 8.5/10 potential rating'],
        memoryBehaviour: 'Caches active opportunity matrices',
        humanApprovalRequired: false,
        successMetrics: ['Opportunity Realization Rate'],
        failureRecovery: 'Log matrix error and fallback to top trend gaps',
        confidenceModel: { thresholdToPass: 0.85, evidenceWeight: 0.5, validationRules: ['Demand-Supply gap ratio'] },
      },
      {
        id: 'collection_strategy',
        name: 'Collection Strategy Agent',
        title: 'Collection Assortment Agent',
        mission: 'Guide collection curation, product mix balance, and set completion strategy.',
        version: '1.0.0',
        responsibilities: [
          'Evaluate collection health and category balance',
          'Recommend matching set creations (e.g. earring pairs for hero necklaces)',
          'Detect missing hero SKUs in active lines',
        ],
        inputs: ['Active Catalog', 'Sales Metrics', 'Trend Forecasts'],
        outputs: ['Collection Health Reports', 'Set Completion Cards'],
        availableTools: ['AssortmentMixMatrix', 'SetCompletionEngine'],
        knowledgeDependencies: ['CatalogDB'],
        decisionRules: ['Ensure bridal collections maintain 1:1.5 ring-to-earring ratio'],
        memoryBehaviour: 'Tracks collection evolution history',
        humanApprovalRequired: false,
        successMetrics: ['Set Cross-Sell Improvement'],
        failureRecovery: 'Default to standard 4-category balance check',
        confidenceModel: { thresholdToPass: 0.80, evidenceWeight: 0.4, validationRules: ['Category ratio check'] },
      },
      {
        id: 'recommendation',
        name: 'Recommendation Agent',
        title: 'Business Action Recommendation Agent',
        mission: 'Synthesize multi-agent insights into concrete, evidence-backed business recommendations.',
        version: '1.0.0',
        responsibilities: [
          'Combine market, design, CAD, and consumer data into Action Cards',
          'Rank business recommendations by ROI and confidence',
          'Attach supporting evidence links to every recommendation',
        ],
        inputs: ['Multi-Agent Outputs', 'Knowledge Graph Nodes'],
        outputs: ['Ranked Action Cards', 'Evidence Bundles'],
        availableTools: ['ActionCardBuilder', 'MCDAEngine'],
        knowledgeDependencies: ['KnowledgeGraph'],
        decisionRules: ['Every recommendation MUST include at least 2 verified evidence sources'],
        memoryBehaviour: 'Tracks accepted vs rejected recommendations',
        humanApprovalRequired: false,
        successMetrics: ['Recommendation Acceptance Rate'],
        failureRecovery: 'Filter out low-evidence recommendations',
        confidenceModel: { thresholdToPass: 0.85, evidenceWeight: 0.6, validationRules: ['Evidence count check'] },
      },
      {
        id: 'validation',
        name: 'Validation Agent',
        title: 'Fact Verification & Trust Agent',
        mission: 'Enforce strict truthfulness, evidence verification, and confidence threshold gates across all agents.',
        version: '1.0.0',
        responsibilities: [
          'Verify source credibility of research extracts',
          'Detect conflicting assertions between AI agents',
          'Reject assertions falling below confidence thresholds',
        ],
        inputs: ['Agent Output Payloads', 'Source Metadata'],
        outputs: ['Validation Certificates', 'Conflict Reports'],
        availableTools: ['FactChecker', 'CredibilityScorer'],
        knowledgeDependencies: ['OntologyService'],
        decisionRules: ['Reject any claim with confidence < 0.75'],
        memoryBehaviour: 'Logs agent error rates for CIO monitoring',
        humanApprovalRequired: false,
        successMetrics: ['False Positive Reduction Rate'],
        failureRecovery: 'Mark payload as unverified and request re-run',
        confidenceModel: { thresholdToPass: 0.90, evidenceWeight: 0.8, validationRules: ['Strict source cross-checking'] },
      },
      {
        id: 'ontology',
        name: 'Ontology Agent',
        title: 'Jewelry Taxonomy & Term Standardizer Agent',
        mission: 'Maintain standard jewelry taxonomies and domain dictionaries across operational and AI layers.',
        version: '1.0.0',
        responsibilities: [
          'Standardize terminology across metal karats, gemstone cuts, and setting types',
          'Resolve synonyms (e.g. "micro-pave" -> "pavé")',
          'Ensure uniform entity labeling in Knowledge Graph',
        ],
        inputs: ['Raw Text Scrapes', 'Product Descriptors'],
        outputs: ['Standardized Entity Labels', 'Taxonomy Mappings'],
        availableTools: ['TaxonomyManager', 'SynonymResolver'],
        knowledgeDependencies: ['OntologyDB'],
        decisionRules: ['Map unlisted term variants to closest canonical parent term'],
        memoryBehaviour: 'Maintains active synonym lookup table',
        humanApprovalRequired: false,
        successMetrics: ['Taxonomy Consistency Score'],
        failureRecovery: 'Fallback to literal string normalization',
        confidenceModel: { thresholdToPass: 0.92, evidenceWeight: 0.7, validationRules: ['Canonical dictionary lookup'] },
      },
      {
        id: 'knowledge_pack',
        name: 'Knowledge Pack Agent',
        title: 'Intelligence Pack Builder Agent',
        mission: 'Compile focused, domain-specific intelligence packages for team browsing and strategic reviews.',
        version: '1.0.0',
        responsibilities: [
          'Bundle trends, consumer profiles, and design benchmarks into Knowledge Packs',
          'Publish monthly & seasonal intelligence digests',
        ],
        inputs: ['Knowledge Graph Subgraphs', 'Validated Trends'],
        outputs: ['Knowledge Pack Artifacts', 'Digest Reports'],
        availableTools: ['PackCompiler', 'ThemeBundler'],
        knowledgeDependencies: ['KnowledgeGraph'],
        decisionRules: ['Include minimum 5 representative products per pack'],
        memoryBehaviour: 'Archives published Knowledge Packs',
        humanApprovalRequired: false,
        successMetrics: ['Team Knowledge Pack Utilization'],
        failureRecovery: 'Generate basic summary pack if deep graph synthesis fails',
        confidenceModel: { thresholdToPass: 0.82, evidenceWeight: 0.5, validationRules: ['Minimum node count check'] },
      },
      {
        id: 'report',
        name: 'Report Agent',
        title: 'Conversational Intelligence Report Agent',
        mission: 'Assemble conversational, deep-dive intelligence reports on demand.',
        version: '1.0.0',
        responsibilities: [
          'Process natural language report requests ("Generate bridal solitaire report for India")',
          'Gather relevant graph nodes, market data, and CAD risk metrics',
          'Format executive PDF & markdown report artifacts',
        ],
        inputs: ['Report Prompts', 'Knowledge Graph'],
        outputs: ['Structured Executive Reports', 'PDF Downloads'],
        availableTools: ['ReportFormatter', 'MarkdownCompiler'],
        knowledgeDependencies: ['KnowledgeGraph', 'AllAgents'],
        decisionRules: ['Structure reports with Executive Summary, Trends, Competitors, and Action Items'],
        memoryBehaviour: 'Stores generated report artifacts',
        humanApprovalRequired: false,
        successMetrics: ['Report Completeness Score'],
        failureRecovery: 'Return structured section outline if full data fetch is partial',
        confidenceModel: { thresholdToPass: 0.85, evidenceWeight: 0.5, validationRules: ['Section completeness check'] },
      },
      {
        id: 'memory_learning',
        name: 'Memory & Learning Agent',
        title: 'Organizational Memory & Feedback Agent',
        mission: 'Retain organizational history, capture user feedback, and continuously refine agent accuracy.',
        version: '1.0.0',
        responsibilities: [
          'Record historical recommendation outcomes (accepted vs rejected)',
          'Track Founder feedback on Copilot answers',
          'Tune agent confidence scoring weights over time',
        ],
        inputs: ['User Feedback Events', 'Task Execution History'],
        outputs: ['Weight Adjustments', 'Accuracy Telemetry'],
        availableTools: ['FeedbackCollector', 'WeightTuner'],
        knowledgeDependencies: ['SharedMemoryDB'],
        decisionRules: ['Reduce confidence weight for agent tools with > 15% rejection rate'],
        memoryBehaviour: 'Maintains long-term performance telemetry',
        humanApprovalRequired: false,
        successMetrics: ['Model Accuracy Improvement / Month'],
        failureRecovery: 'Preserve default weights if tuning computation fails',
        confidenceModel: { thresholdToPass: 0.88, evidenceWeight: 0.6, validationRules: ['Statistical significance check'] },
      },
    ]

    for (const agent of defaultAgents) {
      this.specs.set(agent.id, {
        ...agent,
        status: 'idle',
        executionStats: {
          totalTasksRun: 0,
          successRate: 100,
          avgLatencyMs: 120,
        },
      })
    }
  }

  public getSpec(id: AgentId): AgentSpec | undefined {
    return this.specs.get(id)
  }

  public getAllSpecs(): AgentSpec[] {
    return Array.from(this.specs.values())
  }

  public updateStatus(id: AgentId, status: AgentStatus) {
    const spec = this.specs.get(id)
    if (spec) {
      spec.status = status
      spec.executionStats.lastActiveAt = new Date().toISOString()
    }
  }

  public recordExecution(id: AgentId, success: boolean, latencyMs: number) {
    const spec = this.specs.get(id)
    if (spec) {
      const stats = spec.executionStats
      stats.totalTasksRun += 1
      stats.avgLatencyMs = Math.round((stats.avgLatencyMs * (stats.totalTasksRun - 1) + latencyMs) / stats.totalTasksRun)
      if (!success) {
        stats.successRate = Math.round(((stats.successRate * (stats.totalTasksRun - 1)) / stats.totalTasksRun) * 10) / 10
      }
      stats.lastActiveAt = new Date().toISOString()
    }
  }
}

export const agentRegistry = new AgentRegistry()
