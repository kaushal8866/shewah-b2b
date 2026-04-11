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

export function calculateGoldRates(rate24k: number) {
  return {
    rate_24k: rate24k,
    rate_22k: Math.round(rate24k * 0.916),
    rate_18k: Math.round(rate24k * 0.750),
    rate_14k: Math.round(rate24k * 0.585),
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
  const karatMultipliers: Record<number, number> = { 24: 1, 22: 0.916, 18: 0.750, 14: 0.585 }
  const goldCost = goldWeightG * goldRatePerGram * (karatMultipliers[goldKarat] || 0.75)
  const cogs = diamondCost + goldCost + makingCharges + igiCost
  return Math.round(cogs * marginMultiplier)
}

export const ORDER_STATUSES = [
  { value: 'brief_received',   label: 'Brief Received',   color: 'bg-blue-100 text-blue-800' },
  { value: 'cad_in_progress',  label: 'CAD In Progress',  color: 'bg-yellow-100 text-yellow-800' },
  { value: 'cad_sent',         label: 'CAD Sent',         color: 'bg-purple-100 text-purple-800' },
  { value: 'design_approved',  label: 'Design Approved',  color: 'bg-indigo-100 text-indigo-800' },
  { value: 'production',       label: 'In Production',    color: 'bg-orange-100 text-orange-800' },
  { value: 'qc',               label: 'Quality Check',    color: 'bg-amber-100 text-amber-800' },
  { value: 'dispatched',       label: 'Dispatched',       color: 'bg-teal-100 text-teal-800' },
  { value: 'delivered',        label: 'Delivered',        color: 'bg-green-100 text-green-800' },
]

export const PARTNER_STAGES = [
  { value: 'prospect',     label: 'Prospect',      color: 'bg-gray-100 text-gray-700' },
  { value: 'contacted',    label: 'Contacted',      color: 'bg-blue-100 text-blue-800' },
  { value: 'sample_sent',  label: 'Sample Sent',    color: 'bg-yellow-100 text-yellow-800' },
  { value: 'active',       label: 'Active Partner', color: 'bg-green-100 text-green-800' },
  { value: 'inactive',     label: 'Inactive',       color: 'bg-red-100 text-red-700' },
]
