// Shared TypeScript types and small helpers for the D2C customer + enquiry
// surfaces (task #116). Mirrors the schema in scripts/migrate_d2c_customers.sql.

export type EnquiryStatus =
  | 'new'
  | 'in_discussion'
  | 'quoted'
  | 'approved'
  | 'rejected'
  | 'converted_to_order'
  | 'dropped'

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  'new',
  'in_discussion',
  'quoted',
  'approved',
  'rejected',
  'converted_to_order',
  'dropped',
]

// Statuses shown as columns on the inbox kanban (terminal states are
// available in the dropdown but hidden from the board to keep it focused).
export const ENQUIRY_BOARD_COLUMNS: EnquiryStatus[] = [
  'new',
  'in_discussion',
  'quoted',
  'approved',
]

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new:                'New',
  in_discussion:      'In discussion',
  quoted:             'Quoted',
  approved:           'Approved',
  rejected:           'Rejected',
  converted_to_order: 'Converted',
  dropped:            'Dropped',
}

export const ENQUIRY_STATUS_STYLE: Record<EnquiryStatus, string> = {
  new:                'bg-amber-100 text-amber-800 border-amber-200',
  in_discussion:      'bg-sky-100 text-sky-800 border-sky-200',
  quoted:             'bg-violet-100 text-violet-800 border-violet-200',
  approved:           'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:           'bg-stone-100 text-stone-600 border-stone-200',
  converted_to_order: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dropped:            'bg-stone-100 text-stone-600 border-stone-200',
}

export type PreferredContact = 'whatsapp' | 'phone' | 'email'

export const PRODUCT_TYPES = [
  'ring', 'necklace', 'earring', 'pendant', 'bracelet', 'bangle', 'other',
] as const
export type ProductType = typeof PRODUCT_TYPES[number]

export const OCCASIONS = [
  'engagement', 'wedding', 'birthday', 'anniversary', 'gift', 'self', 'other',
] as const
export type Occasion = typeof OCCASIONS[number]

export const SOURCES = [
  'walk-in', 'referral', 'instagram', 'facebook', 'website', 'event', 'other',
] as const
export type CustomerSource = typeof SOURCES[number]

export type Customer = {
  id: string
  created_at: string
  updated_at: string
  full_name: string
  whatsapp: string
  phone: string | null
  email: string | null
  city: string | null
  pincode: string | null
  gst_number: string | null
  birthday: string | null
  anniversary: string | null
  preferred_contact: PreferredContact
  source: string | null
  referral_source: string | null
  internal_notes: string | null
  created_by: string | null
  archived_at: string | null
}

export type CustomerAddress = {
  id: string
  created_at: string
  customer_id: string
  label: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  pincode: string
  country: string
  is_default: boolean
}

export type CustomerEnquiry = {
  id: string
  created_at: string
  updated_at: string
  enquiry_number: string
  customer_id: string
  title: string
  product_type: string | null
  occasion: string | null
  target_date: string | null
  budget_min: number | null
  budget_max: number | null
  karat: number | null
  gold_weight_estimate_g: number | null
  diamond_specs: any
  reference_image_urls: string[]
  description: string | null
  status: EnquiryStatus
  assigned_to: string | null
  created_by: string | null
  internal_notes: string | null
  next_followup_at: string | null
  converted_order_id: string | null
}

export type EnquiryActivity = {
  id: string
  created_at: string
  enquiry_id: string
  actor_id: string | null
  type: 'created' | 'note' | 'status_change' | 'assigned' | 'image_added' | 'updated' | 'followup_set' | 'followup_cleared'
  payload: any
  body: string | null
}

/**
 * Normalise any user-typed phone/whatsapp string to digits-only with a
 * country code defaulted to India (91) when the visitor only typed a
 * 10-digit local number. Empty input → empty string.
 */
export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '91' + digits
  // Some users type "0" + 10-digit local
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1)
  return digits
}

/** Format a normalised digits-only number for display: "+91 98765 43210". */
export function displayPhone(digits: string | null | undefined): string {
  if (!digits) return ''
  const d = digits.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  }
  return `+${d}`
}

export function formatINR(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  return '₹' + Math.round(Number(n)).toLocaleString('en-IN')
}
