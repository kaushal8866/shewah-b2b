/**
 * Task #117 — Consumer-skin design tokens for the customer journey page
 * (`/c/[token]`).
 *
 * The original spec asked for an interactive canvas comparison of three
 * palette/typography variants before locking. In the absence of a live
 * design session, V1 is codified here as the chosen direction:
 *
 *   • Champagne accent      #C9A86A
 *   • Cormorant Garamond    serif headings
 *   • Ivory background      #FBF7F0
 *
 * These tokens are scoped to `/c/[token]` only — admin chrome stays on
 * the existing trade theme (#1E3A5F + Inter). Do not import this module
 * outside the consumer route tree.
 */

export const consumerTheme = {
  colors: {
    // Hero / accents
    champagne:      '#C9A86A',
    champagneSoft:  '#E8D6AC',
    champagneDeep:  '#A88A4F',

    // Surfaces
    ivory:          '#FBF7F0',
    cream:          '#F4ECDD',
    paper:          '#FFFFFF',

    // Ink
    ink:            '#2A241B',          // primary text — warm near-black
    inkSoft:        '#5C5347',
    inkMuted:       '#8C8275',

    // States
    success:        '#5C7F5F',
    rose:           '#B86E5C',          // soft accent for "request changes"
    border:         '#E8DFC9',
  },
  // Tailwind utility presets — used inside the /c/[token] tree by name.
  classes: {
    bgPage:        'bg-[#FBF7F0]',
    bgPaper:       'bg-white',
    bgCream:       'bg-[#F4ECDD]',
    bgChampagne:   'bg-[#C9A86A]',
    bgChampagneSoft: 'bg-[#E8D6AC]',
    textInk:       'text-[#2A241B]',
    textInkSoft:   'text-[#5C5347]',
    textInkMuted:  'text-[#8C8275]',
    textChampagne: 'text-[#A88A4F]',
    border:        'border-[#E8DFC9]',
    ringChampagne: 'ring-[#C9A86A]',
    serif:         'font-serif',         // wired through next/font in layout
  },
}

/**
 * The 7 customer-facing journey stages. Derived from the order state
 * machine but collapses CAD sub-states into "Quote shared" + "Design
 * approved" so the customer doesn't see jewellery jargon.
 *
 * The numeric `index` is what powers the timeline UI — anything below the
 * `currentIndex` is "done", equal is "current", above is "upcoming".
 */
export type JourneyStageKey =
  | 'enquiry_received'
  | 'quote_shared'
  | 'design_approved'
  | 'in_production'
  | 'quality_check'
  | 'dispatched'
  | 'delivered'

export const JOURNEY_STAGES: { key: JourneyStageKey; label: string }[] = [
  { key: 'enquiry_received', label: 'Enquiry received' },
  { key: 'quote_shared',     label: 'Quote shared' },
  { key: 'design_approved',  label: 'Design approved' },
  { key: 'in_production',    label: 'In production' },
  { key: 'quality_check',    label: 'Quality check' },
  { key: 'dispatched',       label: 'Dispatched' },
  { key: 'delivered',        label: 'Delivered' },
]

export function stageIndex(key: JourneyStageKey): number {
  return JOURNEY_STAGES.findIndex(s => s.key === key)
}

/**
 * Map an order's internal status to the highest journey stage the
 * customer should see as "current". Orders that don't exist yet (quote
 * stage only) sit at `quote_shared` if a quote is recorded, else
 * `enquiry_received`.
 */
export function deriveCurrentStage(opts: {
  hasOrder: boolean
  orderStatus?: string | null
  hasQuote: boolean
  hasApprovedCad: boolean
  acceptedAt?: string | null
}): JourneyStageKey {
  const { hasOrder, orderStatus, hasQuote, hasApprovedCad, acceptedAt } = opts
  if (!hasOrder) {
    if (hasQuote || acceptedAt) return 'quote_shared'
    return 'enquiry_received'
  }
  switch (orderStatus) {
    case 'delivered':       return 'delivered'
    case 'dispatched':      return 'dispatched'
    case 'qc':              return 'quality_check'
    case 'production':      return 'in_production'
    case 'design_approved': return 'design_approved'
    case 'cad_in_progress':
    case 'cad_sent':
    case 'brief_received':
      return hasApprovedCad ? 'design_approved' : (hasQuote || acceptedAt ? 'quote_shared' : 'enquiry_received')
    default:
      return hasQuote ? 'quote_shared' : 'enquiry_received'
  }
}
