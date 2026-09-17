/**
 * International Market & Commerce Domain Engine
 * File: lib/markets.ts
 *
 * Configuration-driven market model supporting US, GB, AU, DE, FR out of the box
 * and extensible to future markets. Tax, shipping, and currency rules are
 * configuration-driven and explicitly decoupled from presentation logic.
 */

export type MarketCode = 'US' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'
export type CurrencyCode = 'USD' | 'GBP' | 'AUD' | 'EUR' | 'INR'

export type TaxModel = 'inclusive' | 'exclusive' | 'uncollected'

export interface ShippingMethodConfig {
  id: string
  name: string
  description: string
  baseCost: number
  transitDaysMin: number
  transitDaysMax: number
  isDefault: boolean
}

export interface MarketConfig {
  code: MarketCode
  name: string
  defaultCountry: string
  countryName: string
  currency: CurrencyCode
  currencySymbol: string
  currencyDecimals: number
  taxModel: TaxModel
  taxRate: number // Configured business baseline rate (e.g. 0.20 = 20%)
  taxLabel: string // 'VAT', 'MwSt', 'TVA', 'GST', 'Sales Tax'
  taxDisclaimer: string
  shippingMethods: ShippingMethodConfig[]
  dutyStrategy: 'duties_prepaid' | 'duties_uncollected' | 'duty_free'
  dutyDisclaimer: string
  highValueReviewThreshold: number // Currency-specific threshold for operational high-value screening
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    defaultCountry: 'US',
    countryName: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    currencyDecimals: 0,
    taxModel: 'exclusive',
    taxRate: 0, // State/local sales tax computed at checkout; exclusive in catalog
    taxLabel: 'Sales Tax',
    taxDisclaimer: 'Local sales tax may apply at checkout based on destination state.',
    shippingMethods: [
      {
        id: 'express_insured',
        name: 'Express Insured Courier',
        description: 'Direct door-to-door insured air courier with signature required',
        baseCost: 0, // Configured per logistics tier
        transitDaysMin: 3,
        transitDaysMax: 5,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duties_prepaid',
    dutyDisclaimer: 'All duties and import clearance handled seamlessly by Shewah.',
    highValueReviewThreshold: 10000,
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    defaultCountry: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    currencyDecimals: 0,
    taxModel: 'inclusive',
    taxRate: 0.20,
    taxLabel: '20% VAT Included',
    taxDisclaimer: 'All catalog prices include 20% UK VAT.',
    shippingMethods: [
      {
        id: 'express_insured',
        name: 'Royal Insured Express',
        description: 'Tracked & fully insured express courier with direct signature',
        baseCost: 0,
        transitDaysMin: 3,
        transitDaysMax: 5,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duties_prepaid',
    dutyDisclaimer: 'UK import clearance and VAT included in order total.',
    highValueReviewThreshold: 8000,
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    defaultCountry: 'AU',
    countryName: 'Australia',
    currency: 'AUD',
    currencySymbol: 'A$',
    currencyDecimals: 0,
    taxModel: 'inclusive',
    taxRate: 0.10,
    taxLabel: '10% GST Included',
    taxDisclaimer: 'Catalog prices include 10% Australian GST.',
    shippingMethods: [
      {
        id: 'express_insured',
        name: 'Australia Express Insured',
        description: 'Insured international priority courier with signature confirmation',
        baseCost: 0,
        transitDaysMin: 4,
        transitDaysMax: 6,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duties_prepaid',
    dutyDisclaimer: 'Australian customs clearance included.',
    highValueReviewThreshold: 15000,
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    defaultCountry: 'DE',
    countryName: 'Deutschland',
    currency: 'EUR',
    currencySymbol: '€',
    currencyDecimals: 0,
    taxModel: 'inclusive',
    taxRate: 0.19,
    taxLabel: 'inkl. 19% MwSt.',
    taxDisclaimer: 'Preise verstehen sich inklusive 19% deutscher Mehrwertsteuer.',
    shippingMethods: [
      {
        id: 'express_insured',
        name: 'Wertkurier Express',
        description: 'Voll versicherter Werttransport mit persönlicher Übergabe',
        baseCost: 0,
        transitDaysMin: 3,
        transitDaysMax: 5,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duties_prepaid',
    dutyDisclaimer: 'Einfuhrabgaben und Zollabwicklung sind inklusive.',
    highValueReviewThreshold: 9000,
  },
  FR: {
    code: 'FR',
    name: 'France',
    defaultCountry: 'FR',
    countryName: 'France',
    currency: 'EUR',
    currencySymbol: '€',
    currencyDecimals: 0,
    taxModel: 'inclusive',
    taxRate: 0.20,
    taxLabel: 'TVA 20% Incluse',
    taxDisclaimer: 'Les prix affichés comprennent 20% de TVA française.',
    shippingMethods: [
      {
        id: 'express_insured',
        name: 'Courrier Sécurisé Valeur Déclarée',
        description: 'Transport de haute joaillerie avec remise contre signature',
        baseCost: 0,
        transitDaysMin: 3,
        transitDaysMax: 5,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duties_prepaid',
    dutyDisclaimer: 'Frais de douane et TVA à l’importation inclus.',
    highValueReviewThreshold: 9000,
  },
  IN: {
    code: 'IN',
    name: 'India',
    defaultCountry: 'IN',
    countryName: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    currencyDecimals: 0,
    taxModel: 'inclusive',
    taxRate: 0.03, // 3% Indian GST on fine jewellery
    taxLabel: '3% GST Included',
    taxDisclaimer: 'Prices include 3% GST and certified BIS Hallmarking.',
    shippingMethods: [
      {
        id: 'express_insured_in',
        name: 'Sequel / BlueDart Armored Express',
        description: 'Direct door-to-door insured transit with OTP verification on delivery',
        baseCost: 0,
        transitDaysMin: 2,
        transitDaysMax: 4,
        isDefault: true,
      },
    ],
    dutyStrategy: 'duty_free',
    dutyDisclaimer: 'Handcrafted in Surat & Mumbai ateliers. Complimentary domestic insured delivery.',
    highValueReviewThreshold: 200000, // PAN card compliance gate for transactions >= ₹2,00,000 (Section 269ST)
  },
}

export const DEFAULT_MARKET_CODE: MarketCode = 'US'

/**
 * Resolve a MarketConfig from a market code or destination country code.
 */
export function getMarket(codeOrCountry?: string | null): MarketConfig {
  if (!codeOrCountry) return MARKETS[DEFAULT_MARKET_CODE]
  const upper = codeOrCountry.trim().toUpperCase()
  if (upper in MARKETS) {
    return MARKETS[upper as MarketCode]
  }
  // Country to Market mapping fallbacks:
  if (['IN', 'IND', 'INDIA'].includes(upper)) return MARKETS.IN
  if (['GB', 'UK'].includes(upper)) return MARKETS.GB
  if (['AU', 'NZ'].includes(upper)) return MARKETS.AU
  if (['DE', 'AT', 'CH'].includes(upper)) return MARKETS.DE
  if (['FR', 'BE', 'LU', 'MC'].includes(upper)) return MARKETS.FR
  if (['US', 'CA'].includes(upper)) return MARKETS.US

  // Default fallback
  return MARKETS[DEFAULT_MARKET_CODE]
}

/**
 * Returns configuration-driven high-value threshold for a market,
 * supporting environment variable overrides for custom policies.
 */
export function getHighValueReviewThreshold(marketCode: MarketCode): number {
  const envOverride =
    process.env[`D2C_HIGH_VALUE_THRESHOLD_${marketCode}`] ||
    process.env.D2C_HIGH_VALUE_THRESHOLD
  if (envOverride) {
    const parsed = Number(envOverride)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return MARKETS[marketCode]?.highValueReviewThreshold || 10000
}

/**
 * Determines whether an order total meets or exceeds the market review gate.
 */
export function isHighValueOrder(amount: number, marketCode: MarketCode): boolean {
  const threshold = getHighValueReviewThreshold(marketCode)
  return amount >= threshold
}

/**
 * Format monetary amount according to market currency rules.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode = 'USD',
  options?: { showCurrencyCode?: boolean }
): string {
  const n = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const market = Object.values(MARKETS).find(m => m.currency === currency) || MARKETS.US
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: market.currencyDecimals,
    maximumFractionDigits: market.currencyDecimals,
  }).format(n)

  if (options?.showCurrencyCode) {
    return `${formatted} ${currency}`
  }
  return formatted
}

/**
 * Calculate tax and net/gross figures based on market tax model.
 */
export function calculateMarketTax(
  amount: number,
  market: MarketConfig
): {
  grossPrice: number
  netPrice: number
  taxAmount: number
  taxLabel: string
  isInclusive: boolean
} {
  const base = Math.max(0, amount)
  if (market.taxModel === 'inclusive') {
    // Price already contains tax (Gross = Net * (1 + rate))
    const net = base / (1 + market.taxRate)
    const tax = base - net
    return {
      grossPrice: Math.round(base),
      netPrice: Math.round(net),
      taxAmount: Math.round(tax),
      taxLabel: market.taxLabel,
      isInclusive: true,
    }
  } else if (market.taxModel === 'exclusive') {
    const tax = base * market.taxRate
    const gross = base + tax
    return {
      grossPrice: Math.round(gross),
      netPrice: Math.round(base),
      taxAmount: Math.round(tax),
      taxLabel: market.taxLabel,
      isInclusive: false,
    }
  }
  return {
    grossPrice: Math.round(base),
    netPrice: Math.round(base),
    taxAmount: 0,
    taxLabel: 'No Tax',
    isInclusive: false,
  }
}

/**
 * Compute realistic made-to-order delivery estimate window.
 * Formula: Today + craftingLeadDays (business days) + transitDays (business days).
 */
export function computeDeliveryEstimate(
  craftingLeadDays: number | null | undefined,
  marketCode?: string | null,
  fromDate: Date = new Date()
): {
  earliestDate: Date
  latestDate: Date
  formattedRange: string
} {
  const market = getMarket(marketCode)
  const defaultMethod = market.shippingMethods.find(m => m.isDefault) || market.shippingMethods[0]

  const leadDays = typeof craftingLeadDays === 'number' && craftingLeadDays > 0 ? craftingLeadDays : 14
  const transitMin = defaultMethod?.transitDaysMin ?? 3
  const transitMax = defaultMethod?.transitDaysMax ?? 5

  // Helper to add business days (skipping weekends)
  function addBusinessDays(date: Date, days: number): Date {
    const d = new Date(date)
    let added = 0
    while (added < days) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        added++
      }
    }
    return d
  }

  const earliest = addBusinessDays(fromDate, leadDays + transitMin)
  const latest = addBusinessDays(fromDate, leadDays + transitMax)

  const fmtOpt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = earliest.toLocaleDateString('en-US', fmtOpt)
  const endStr = latest.toLocaleDateString('en-US', { ...fmtOpt, year: 'numeric' })

  return {
    earliestDate: earliest,
    latestDate: latest,
    formattedRange: `${startStr} – ${endStr}`,
  }
}
