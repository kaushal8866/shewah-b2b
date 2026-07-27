import { AgentTaskMessage, AgentId } from '../../types/agent'
import { WorkflowEngine, WorkflowPipelineStep } from '../WorkflowEngine'
import { knowledgeGraphService } from '../../infrastructure/KnowledgeGraphService'
import { ontologyService } from '../../infrastructure/OntologyService'
import { WebScraperService } from '../../infrastructure/WebScraperService'
import { LLMSynthesisEngine } from '../../infrastructure/LLMSynthesisEngine'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Chief Intelligence Officer (CIO) Agent
 * Orchestrates tasks across the 17 AI workforce agents and synthesizes contextual insights.
 */
export class CIOAgent {
  public static async processRequest(params: {
    query: string
    routePath?: string
    productId?: string
    cadRequestId?: string
    customerId?: string
    orderId?: string
  }): Promise<{
    answer: string
    confidence: number
    insights: Array<{ title: string; detail: string; score?: string }>
    pipelineTrace: any[]
    suggestedActions: string[]
  }> {
    const traceId = `trace_${Date.now()}`
    const q = params.query.toLowerCase().trim()

    // 1. Dynamic Intent Detection
    const isQuotesQuery =
      q.includes('quote') ||
      q.includes('quotes') ||
      q.includes('unseen')

    const isOrdersQuery =
      q.includes('order') ||
      q.includes('orders')

    const isEnquiriesQuery =
      q.includes('enquiry') ||
      q.includes('enquiries')

    const isDiamondPricingQuery =
      q.includes('diamond') ||
      q.includes('pricing') ||
      q.includes('price') ||
      q.includes('rate') ||
      q.includes('matrix') ||
      q.includes('viable') ||
      q.includes('accurate') ||
      q.includes('carat') ||
      q.includes('cost')

    const isProductQuery =
      Boolean(params.productId) ||
      q.includes('product') ||
      q.includes('design') ||
      q.includes('ring') ||
      q.includes('solitaire') ||
      q.includes('sku')

    const isCadQuery =
      Boolean(params.cadRequestId) ||
      q.includes('cad') ||
      q.includes('mfg') ||
      q.includes('casting') ||
      q.includes('karigar') ||
      q.includes('weight')

    const isCustomerQuery =
      Boolean(params.customerId) ||
      q.includes('customer') ||
      q.includes('buyer') ||
      q.includes('d2c') ||
      q.includes('client')

    const isStockQuery =
      q.includes('stock') ||
      q.includes('inventory') ||
      q.includes('ready to ship') ||
      q.includes('rts')

    const isInvoicesQuery =
      q.includes('invoice') ||
      q.includes('invoices') ||
      q.includes('unpaid') ||
      q.includes('payment') ||
      q.includes('overdue')

    const isPartnersQuery =
      q.includes('partner') ||
      q.includes('partners') ||
      q.includes('retailer') ||
      q.includes('retailers') ||
      q.includes('reseller') ||
      q.includes('resellers') ||
      q.includes('vendor') ||
      q.includes('vendors') ||
      q.includes('manufacturer') ||
      q.includes('manufacturers')

    // Context resolution: determine target steps based on query intent and active route
    const steps: WorkflowPipelineStep[] = []

    if (isPartnersQuery) {
      steps.push({ agentId: 'consumer_intelligence', taskType: 'AUDIT_PARTNERS_NETWORK' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_PARTNER_ACTIONS' })
    } else if (isInvoicesQuery) {
      steps.push({ agentId: 'pricing_intelligence', taskType: 'AUDIT_INVOICES_STATUS' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_INVOICE_ACTIONS' })
    } else if (isQuotesQuery) {
      steps.push({ agentId: 'pricing_intelligence', taskType: 'AUDIT_QUOTES_STATUS' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_QUOTE_ACTIONS' })
    } else if (isOrdersQuery) {
      steps.push({ agentId: 'manufacturing_intelligence', taskType: 'AUDIT_ORDERS_STATUS' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_ORDER_ACTIONS' })
    } else if (isEnquiriesQuery) {
      steps.push({ agentId: 'consumer_intelligence', taskType: 'AUDIT_ENQUIRIES_STATUS' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_ENQUIRY_ACTIONS' })
    } else if (isStockQuery) {
      steps.push({ agentId: 'manufacturing_intelligence', taskType: 'AUDIT_STOCK_STATUS' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_STOCK_ACTIONS' })
    } else if (isDiamondPricingQuery) {
      steps.push({ agentId: 'pricing_intelligence', taskType: 'VERIFY_DIAMOND_PRICING_MATRIX' })
      steps.push({ agentId: 'competitor_intelligence', taskType: 'BENCHMARK_DIAMOND_RATES' })
      steps.push({ agentId: 'validation', taskType: 'AUDIT_PRICING_VIABILITY' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_PRICING_ACTIONS' })
    } else if (isProductQuery) {
      steps.push({ agentId: 'design_intelligence', taskType: 'ANALYZE_DESIGN_DNA' })
      steps.push({ agentId: 'image_vision', taskType: 'EXTRACT_VISUAL_TAGS' })
      steps.push({ agentId: 'competitor_intelligence', taskType: 'MATCH_COMPETITORS' })
      steps.push({ agentId: 'trend_intelligence', taskType: 'EVALUATE_TREND_VELOCITY' })
      steps.push({ agentId: 'recommendation', taskType: 'GENERATE_ACTION_CARD' })
    } else if (isCadQuery) {
      steps.push({ agentId: 'manufacturing_intelligence', taskType: 'EVALUATE_CAD_FEASIBILITY' })
      steps.push({ agentId: 'pricing_intelligence', taskType: 'COMPUTE_KARAT_MARGIN' })
      steps.push({ agentId: 'recommendation', taskType: 'SIMPLIFY_DESIGN_COST' })
    } else if (isCustomerQuery) {
      steps.push({ agentId: 'consumer_intelligence', taskType: 'DECODE_BUYING_INTENT' })
      steps.push({ agentId: 'white_space', taskType: 'IDENTIFY_WHITE_SPACE' })
      steps.push({ agentId: 'recommendation', taskType: 'RECOMMEND_PRODUCTS' })
    } else {
      steps.push({ agentId: 'global_research', taskType: 'DISCOVER_MARKET_TRENDS' })
      steps.push({ agentId: 'trend_intelligence', taskType: 'EVALUATE_TREND_VELOCITY' })
      steps.push({ agentId: 'recommendation', taskType: 'SYNTHESIZE_STRATEGY' })
    }

    const initialContext: AgentTaskMessage['context'] = {
      userQuery: params.query,
      routePath: params.routePath,
      productId: params.productId,
      cadRequestId: params.cadRequestId,
      customerId: params.customerId,
      orderId: params.orderId,
    }

    const execution = await WorkflowEngine.executePipeline(traceId, initialContext, steps)
    const graphStats = knowledgeGraphService.getGraphStats()

    // Aggregate live DB context for intent
    let dbData: Record<string, any> | undefined = undefined
    let scrapedData: Record<string, any> | undefined = undefined

    if (isPartnersQuery) {
      let partnerRows: any[] = []
      try {
        const { data } = await supabaseAdmin.from('partners').select('type, status')
        if (data) partnerRows = data
      } catch (err) {
        console.error('Error fetching partners from DB:', err)
      }
      dbData = {
        type: 'partners',
        totalPartners: partnerRows.length,
        resellersCount: partnerRows.filter((p: any) => p.type === 'reseller').length,
        retailersCount: partnerRows.filter((p: any) => p.type === 'retailer' || p.type === 'retail').length,
        vendorsCount: partnerRows.filter((p: any) => p.type === 'vendor' || p.type === 'manufacturer').length,
        activeCount: partnerRows.filter((p: any) => p.status === 'active' || !p.status).length,
      }
    } else if (isInvoicesQuery) {
      let invoiceRows: any[] = []
      try {
        const { data } = await supabaseAdmin.from('gst_invoices').select('status, payment_status, total_amount, balance_due')
        if (data) invoiceRows = data
      } catch (err) {
        console.error('Error fetching invoices from DB:', err)
      }
      const active = invoiceRows.filter((i: any) => i.status !== 'cancelled')
      dbData = {
        type: 'invoices',
        totalInvoices: invoiceRows.length,
        paidCount: active.filter((i: any) => i.payment_status === 'paid').length,
        unpaidCount: active.filter((i: any) => i.payment_status === 'unpaid' || i.payment_status === 'partial' || !i.payment_status).length,
        totalInvoicedAmount: active.reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0),
        totalUnpaidAmount: active.reduce((sum: number, i: any) => (i.payment_status === 'paid' ? sum : sum + (Number(i.balance_due) || Number(i.total_amount) || 0)), 0),
      }
    } else if (isQuotesQuery) {
      let quoteRows: any[] = []
      try {
        const { data } = await supabaseAdmin.from('quotes').select('status, grand_total')
        if (data) quoteRows = data
      } catch (err) {
        console.error('Error fetching quotes from DB:', err)
      }
      dbData = {
        type: 'quotes',
        totalQuotes: quoteRows.length,
        draftCount: quoteRows.filter((q: any) => q.status === 'draft').length,
        sentCount: quoteRows.filter((q: any) => q.status === 'sent').length,
        viewedCount: quoteRows.filter((q: any) => q.status === 'viewed').length,
        acceptedCount: quoteRows.filter((q: any) => q.status === 'accepted').length,
        convertedCount: quoteRows.filter((q: any) => q.status === 'converted' || q.status === 'ordered').length,
        totalValue: quoteRows.reduce((sum: number, q: any) => sum + (Number(q.grand_total) || 0), 0),
      }
    } else if (isOrdersQuery) {
      let orderRows: any[] = []
      try {
        const { data } = await supabaseAdmin.from('orders').select('status')
        if (data) orderRows = data
      } catch (err) {
        console.error('Error fetching orders from DB:', err)
      }
      dbData = {
        type: 'orders',
        totalOrders: orderRows.length,
        pendingOrders: orderRows.filter((o: any) => o.status === 'pending' || o.status === 'confirmed').length,
        inProduction: orderRows.filter((o: any) => o.status === 'in_production' || o.status === 'cad_approved').length,
        readyToShip: orderRows.filter((o: any) => o.status === 'ready_to_ship' || o.status === 'qc_passed').length,
        completedOrders: orderRows.filter((o: any) => o.status === 'shipped' || o.status === 'delivered' || o.status === 'completed').length,
      }
    } else if (!isDiamondPricingQuery && !isProductQuery && !isCadQuery && !isCustomerQuery) {
      // Free-form market query: run live web scraper
      try {
        scrapedData = await WebScraperService.searchMarketData(params.query)
      } catch (err) {
        console.error('Error executing WebScraperService:', err)
      }
    }

    // Synthesize final response via LLMSynthesisEngine
    const synthesized = await LLMSynthesisEngine.synthesize({
      userQuery: params.query,
      routePath: params.routePath,
      dbData,
      scrapedData,
    })

    return {
      answer: synthesized.answer,
      confidence: 0.95,
      insights: synthesized.insights,
      pipelineTrace: execution.results,
      suggestedActions: synthesized.suggestedActions,
    }
  }
}
