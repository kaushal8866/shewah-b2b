import { AgentTaskMessage, AgentId } from '../../types/agent'
import { WorkflowEngine, WorkflowPipelineStep } from '../WorkflowEngine'
import { knowledgeGraphService } from '../../infrastructure/KnowledgeGraphService'
import { ontologyService } from '../../infrastructure/OntologyService'
import { WebScraperService } from '../../infrastructure/WebScraperService'
import { LLMSynthesisEngine } from '../../infrastructure/LLMSynthesisEngine'
import { fetchAllRows } from '../../infrastructure/fetchAllRows'
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
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
  }): Promise<{
    answer: string
    confidence: number
    insights: Array<{ title: string; detail: string; score?: string }>
    pipelineTrace: any[]
    suggestedActions: string[]
  }> {
    const traceId = `trace_${Date.now()}`
    const q = params.query.toLowerCase().trim()

    const isTasksTransactionsQuery =
      q.includes('task') ||
      q.includes('tasks') ||
      q.includes('transaction') ||
      q.includes('transactions') ||
      q.includes('today') ||
      q.includes('todo') ||
      q.includes('action') ||
      q.includes('actions') ||
      q.includes('pending') ||
      q.includes('do today') ||
      q.includes('work today')

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

    const isExplicitWebSearch =
      q.includes('what is') ||
      q.includes('who is') ||
      q.includes('news') ||
      q.includes('market trend') ||
      q.includes('apify') ||
      q.includes('competitor') ||
      q.includes('external') ||
      q.includes('google') ||
      q.includes('search')

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
    // Collected so the answer can admit when a read failed rather than
    // reporting a total computed from whatever happened to come back.
    let dataErrors: string[] = []
    let scrapedData: Record<string, any> | undefined = undefined

    if (isTasksTransactionsQuery) {
      let orderRows: any[] = []
      let invoiceRows: any[] = []
      let quoteRows: any[] = []
      let enquiryRows: any[] = []

      const [ordRes, invRes, quoRes, enqRes] = await Promise.all([
        // balance_due/advance_paid come from orders — see the note below on why
        // invoices cannot answer "what am I owed".
        fetchAllRows('tasks.orders', (f, t) =>
          supabaseAdmin.from('orders')
            .select('id, order_number, status, total_amount, advance_paid, balance_due, created_at').range(f, t)),
        // gst_invoices has no payment tracking at all: no payment_status, no
        // balance_due, and the total column is `grand_total` not
        // `total_amount`. Selecting those three non-existent columns is what
        // made this query fail and report "0 unpaid invoices, ₹0 outstanding"
        // — a confident, wrong answer about money.
        fetchAllRows('tasks.invoices', (f, t) =>
          supabaseAdmin.from('gst_invoices')
            .select('id, invoice_number, status, grand_total').range(f, t)),
        fetchAllRows('tasks.quotes', (f, t) =>
          supabaseAdmin.from('quotes')
            .select('id, quote_number, status, grand_total').range(f, t)),
        // Was `from('enquiries')` — no such table. The D2C enquiry table is
        // `customer_enquiries` (scripts/migrate_d2c_customers.sql), and its
        // customer name lives on the joined `customers` row, not inline.
        fetchAllRows('tasks.enquiries', (f, t) =>
          supabaseAdmin.from('customer_enquiries')
            .select('id, status, title').range(f, t)),
      ])

      orderRows = ordRes.rows
      invoiceRows = invRes.rows
      quoteRows = quoRes.rows
      enquiryRows = enqRes.rows

      // Surface partial reads instead of answering confidently from a subset.
      dataErrors = [ordRes.error, invRes.error, quoRes.error, enqRes.error].filter(Boolean) as string[]

      // Money owed lives on the ORDER, not the invoice — gst_invoices records
      // what was billed for GST, with no payment state. Orders carry
      // total_amount / advance_paid / balance_due, which is what "what am I
      // owed" actually means.
      const owedOrders = orderRows.filter(
        (o: any) => Number(o.balance_due) > 0 && o.status !== 'cancelled' && o.status !== 'abandoned',
      )
      const activeInvoices = invoiceRows.filter((i: any) => i.status !== 'cancelled')

      dbData = {
        type: 'tasks_transactions',
        // Statuses must match ORDER_STATUSES in lib/supabase.ts. These were
        // 'pending' / 'confirmed' / 'in_production' / 'cad_approved' /
        // 'ready_to_ship' — none of which this app ever writes, so every
        // count was silently zero regardless of how busy the workshop was.
        pendingOrders: orderRows.filter((o: any) =>
          ['draft', 'brief_received', 'cad_in_progress', 'cad_sent', 'design_approved', 'quote_issued'].includes(o.status)),
        inProductionOrders: orderRows.filter((o: any) =>
          ['advance_received', 'production', 'hallmarking', 'qc', 'qc_failed'].includes(o.status)),
        readyToShipOrders: orderRows.filter((o: any) => o.status === 'qc_passed'),
        awaitingDeliveryOrders: orderRows.filter((o: any) => o.status === 'dispatched'),

        ordersAwaitingPaymentCount: owedOrders.length,
        outstandingAmount: owedOrders.reduce((sum: number, o: any) => sum + (Number(o.balance_due) || 0), 0),

        invoicesRaisedCount: activeInvoices.length,
        invoicesRaisedValue: activeInvoices.reduce((sum: number, i: any) => sum + (Number(i.grand_total) || 0), 0),

        pendingQuotesCount: quoteRows.filter((q: any) => q.status === 'sent' || q.status === 'draft').length,
        unreadEnquiriesCount: enquiryRows.filter((e: any) => e.status === 'new' || e.status === 'unread').length,
      }
    } else if (isPartnersQuery) {
      let partnerRows: any[] = []
      try {
        const res = await fetchAllRows('partners', (f, t) =>
          supabaseAdmin.from('partners').select('type, status').range(f, t))
        partnerRows = res.rows
        if (res.error) dataErrors.push(res.error)
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
      // Same correction as the tasks branch: gst_invoices records what was
      // billed for GST and has no payment state. Payment lives on the order,
      // so "unpaid" is answered from orders.balance_due.
      let invoiceRows: any[] = []
      let orderRows: any[] = []
      const [invRes, ordRes] = await Promise.all([
        fetchAllRows('invoices', (f, t) =>
          supabaseAdmin.from('gst_invoices').select('status, grand_total, order_id').range(f, t)),
        fetchAllRows('invoices.orders', (f, t) =>
          supabaseAdmin.from('orders').select('status, total_amount, advance_paid, balance_due').range(f, t)),
      ])
      invoiceRows = invRes.rows
      orderRows = ordRes.rows
      if (invRes.error) dataErrors.push(invRes.error)
      if (ordRes.error) dataErrors.push(ordRes.error)

      const active = invoiceRows.filter((i: any) => i.status !== 'cancelled')
      const billable = orderRows.filter((o: any) => o.status !== 'cancelled' && o.status !== 'abandoned')
      const owed = billable.filter((o: any) => Number(o.balance_due) > 0)

      dbData = {
        type: 'invoices',
        invoicesRaised: active.length,
        invoicesRaisedValue: active.reduce((sum: number, i: any) => sum + (Number(i.grand_total) || 0), 0),
        ordersFullyPaid: billable.filter((o: any) => Number(o.balance_due) === 0 && Number(o.total_amount) > 0).length,
        ordersAwaitingPayment: owed.length,
        outstandingAmount: owed.reduce((sum: number, o: any) => sum + (Number(o.balance_due) || 0), 0),
        collectedAmount: billable.reduce((sum: number, o: any) => sum + (Number(o.advance_paid) || 0), 0),
      }
    } else if (isQuotesQuery) {
      let quoteRows: any[] = []
      try {
        const res = await fetchAllRows('quotes', (f, t) =>
          supabaseAdmin.from('quotes').select('status, grand_total').range(f, t))
        const data = res.rows
        if (res.error) dataErrors.push(res.error)
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
        const res = await fetchAllRows('orders', (f, t) =>
          supabaseAdmin.from('orders').select('status').range(f, t))
        const data = res.rows
        if (res.error) dataErrors.push(res.error)
        if (data) orderRows = data
      } catch (err) {
        console.error('Error fetching orders from DB:', err)
      }
      // Statuses aligned to ORDER_STATUSES (lib/supabase.ts). The previous
      // values — 'pending', 'confirmed', 'in_production', 'cad_approved',
      // 'ready_to_ship', 'shipped', 'completed' — are not written anywhere in
      // this app, so every bucket reported zero no matter the real workload.
      const inSet = (o: any, set: string[]) => set.includes(o.status)
      dbData = {
        type: 'orders',
        totalOrders: orderRows.length,
        pendingOrders: orderRows.filter(o => inSet(o, ['draft', 'brief_received', 'cad_in_progress', 'cad_sent', 'design_approved', 'quote_issued'])).length,
        inProduction: orderRows.filter(o => inSet(o, ['advance_received', 'production', 'hallmarking', 'qc', 'qc_failed'])).length,
        readyToShip: orderRows.filter(o => o.status === 'qc_passed').length,
        dispatched: orderRows.filter(o => o.status === 'dispatched').length,
        completedOrders: orderRows.filter(o => inSet(o, ['delivered', 'closed'])).length,
        cancelledOrders: orderRows.filter(o => inSet(o, ['cancelled', 'abandoned'])).length,
      }
    } else if (isExplicitWebSearch) {
      // Only execute web scraper for explicit external research/news queries
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
      history: params.history,
    })

    // If a read failed, say so. Answering a financial question from a partial
    // result set without flagging it is the worst outcome here — the operator
    // has no way to tell a real number from an incomplete one.
    const answer = dataErrors.length > 0
      ? `${synthesized.answer}\n\n⚠️ Some data could not be read (${dataErrors.length} ${dataErrors.length === 1 ? 'source' : 'sources'} failed), so figures above may be incomplete.`
      : synthesized.answer

    return {
      answer,
      // Confidence was a hardcoded 0.95 regardless of what actually happened.
      confidence: dataErrors.length > 0 ? 0.4 : 0.95,
      insights: synthesized.insights,
      pipelineTrace: execution.results,
      suggestedActions: synthesized.suggestedActions,
    }
  }
}
