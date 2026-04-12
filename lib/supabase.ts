import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    '[Shewah] Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Type definitions ──────────────────────────────────────

export type Partner = {
  id: string
  created_at: string
  store_name: string
  owner_name: string
  phone: string
  email?: string
  city: string
  state: string
  circuit?: string
  address?: string
  sarafa_bazaar?: string
  store_type?: string
  annual_revenue?: string
  current_products?: string[]
  model_preference?: string
  status: 'hot' | 'warm' | 'cold'
  stage: 'prospect' | 'contacted' | 'sample_sent' | 'active' | 'inactive'
  source?: string
  notes?: string
  tags?: string[]
}

export type Visit = {
  id: string
  created_at: string
  partner_id: string
  visit_date: string
  circuit?: string
  city?: string
  outcome?: string
  notes?: string
  sample_offered?: boolean
  catalog_left?: boolean
  next_action?: string
  next_action_date?: string
}

export type Product = {
  id: string
  code: string
  name: string
  description?: string
  category: string
  diamond_weight?: number
  diamond_shape?: string
  diamond_quality?: string
  diamond_color?: string
  diamond_type: string
  gold_karat?: number
  gold_weight_g?: number
  diamond_cost?: number
  making_charges?: number
  igi_cert_cost?: number
  trade_price?: number
  mrp_suggested?: number
  photo_urls?: string[]
  is_active: boolean
  delivery_days?: number
  models_available?: string[]
  tags?: string[]
}

export type Order = {
  id: string
  order_number: string
  partner_id?: string
  product_id?: string
  type: 'catalog' | 'custom'
  model: 'wholesale' | 'design_make' | 'white_label'
  quantity: number
  ring_size?: string
  special_notes?: string
  brief_text?: string
  brief_images?: string[]
  cad_request_id?: string
  gold_rate_at_order?: number
  trade_price: number
  total_amount: number
  advance_paid: number
  balance_due?: number
  status: string
  order_date: string
  expected_delivery?: string
  actual_delivery?: string
  tracking_number?: string
  courier?: string
  dispatch_date?: string
  internal_notes?: string
}

export type CADRequest = {
  id: string
  request_number: string
  partner_id?: string
  order_id?: string
  brief_text?: string
  reference_images?: string[]
  diamond_shape?: string
  diamond_weight?: string
  gold_karat?: number
  setting_type?: string
  special_requests?: string
  status: string
  priority: 'normal' | 'urgent'
  cad_files?: string[]
  render_images?: string[]
  received_date: string
  due_date?: string
  sent_date?: string
  approved_date?: string
  revision_notes?: string
  partner_feedback?: string
}

export type GoldRate = {
  id: string
  recorded_at: string
  source: string
  rate_24k: number
  rate_22k?: number
  rate_18k?: number
  rate_14k?: number
  notes?: string
}

export type Circuit = {
  id: string
  created_at: string
  name: string
  region?: string
  cities?: string[]
  start_date?: string
  end_date?: string
  status: 'planned' | 'in_progress' | 'completed'
  target_visits?: number
  target_samples?: number
  target_partners?: number
  actual_visits: number
  actual_samples: number
  actual_partners: number
  budget_inr?: number
  spent_inr: number
  notes?: string
}

export type ManufacturingPartner = {
  id: string
  created_at: string
  name: string
  owner_name?: string
  phone?: string
  city?: string
  speciality?: string[]
  material_policy?: string
  labour_rate_18k?: number
  status: string
  notes?: string
}

export type ManufacturingOrder = {
  id: string
  created_at: string
  order_number: string
  manufacturing_partner_id?: string
  order_id?: string
  description?: string
  quantity: number
  gold_weight_issue?: number
  diamond_weight_issue?: number
  labour_charges?: number
  status: string
  expected_delivery?: string
  actual_delivery?: string
  notes?: string
}

export type MaterialFloat = {
  id: string
  partner_id: string
  material_type: string
  balance: number
  total_deposited: number
}

export type Vendor = {
  id: string
  name: string
  owner_name?: string
  phone?: string
  email?: string
  city?: string
  state?: string
  category?: string[]
  payment_terms?: string
  outstanding: number
  notes?: string
}

export type InventoryItem = {
  id: string
  name: string
  category: string
  vendor_id?: string
  quantity_in_stock: number
  unit: string
  avg_purchase_price?: number
  low_stock_alert?: number
  diamond_shape?: string
  diamond_quality?: string
  diamond_color?: string
  notes?: string
}

// ── Helper functions ──────────────────────────────────────

// Gold karat purity multipliers (fine gold fraction)
export const KARAT_PURITY: Record<number, number> = {
  9: 0.375, 10: 0.417, 14: 0.585, 18: 0.750, 22: 0.916, 24: 1.0,
}

/**
 * Convert gross gold weight at a given karat to 24kt fine gold equivalent.
 * Example: 3g of 18K → 3 × 0.75 = 2.25g fine gold.
 */
export function toFineGold24k(grossWeightG: number, karat: number): number {
  return grossWeightG * (KARAT_PURITY[karat] || 0.75)
}

/**
 * Convert 24kt fine gold to gross weight at a given karat.
 * Example: 2.25g fine → 2.25 / 0.75 = 3g in 18K.
 */
export function fromFineGold24k(fineWeightG: number, karat: number): number {
  const purity = KARAT_PURITY[karat] || 0.75
  return purity > 0 ? fineWeightG / purity : 0
}

export function calculateGoldRates(rate24k: number) {
  return {
    rate_24k: rate24k,
    rate_22k: Math.round(rate24k * KARAT_PURITY[22]),
    rate_18k: Math.round(rate24k * KARAT_PURITY[18]),
    rate_14k: Math.round(rate24k * KARAT_PURITY[14]),
  }
}

export function calculateTradePrice(
  diamondCost: number,
  goldKarat: number,
  goldWeightG: number,
  goldRatePerGram: number,
  makingCharges: number,
  igiCost: number,
  marginMultiplier = 1.28
) {
  const goldCost = goldWeightG * goldRatePerGram * (KARAT_PURITY[goldKarat] || 0.75)
  const cogs = diamondCost + goldCost + makingCharges + igiCost
  return Math.round(cogs * marginMultiplier)
}

export const ORDER_STATUSES = [
  { value: 'brief_received',   label: 'Brief Received' },
  { value: 'cad_in_progress',  label: 'CAD In Progress' },
  { value: 'cad_sent',         label: 'CAD Sent' },
  { value: 'design_approved',  label: 'Design Approved' },
  { value: 'production',       label: 'In Production' },
  { value: 'qc',               label: 'Quality Check' },
  { value: 'dispatched',       label: 'Dispatched' },
  { value: 'delivered',        label: 'Delivered' },
]

export const PARTNER_STAGES = [
  { value: 'prospect',     label: 'Prospect' },
  { value: 'contacted',    label: 'Contacted' },
  { value: 'sample_sent',  label: 'Sample Sent' },
  { value: 'active',       label: 'Active Partner' },
  { value: 'inactive',     label: 'Inactive' },
]
