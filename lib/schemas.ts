import { z } from 'zod'

/**
 * Shewah B2B — Validation Schemas
 * Used for both client-side form validation and server-side safety checks.
 */

export const PartnerSchema = z.object({
  store_name: z.string().min(2, 'Store name is required'),
  owner_name: z.string().min(2, 'Owner name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian phone number required'),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  tier: z.enum(['A', 'B', 'C']),
  credit_limit_paise: z.number().int().min(0).default(500000),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
})

export const OrderSchema = z.object({
  partner_id: z.string().uuid('Invalid partner ID'),
  product_id: z.string().uuid().optional().nullable(),
  type: z.enum(['catalog', 'custom']),
  model: z.enum(['wholesale', 'design_make', 'white_label']),
  quantity: z.number().int().min(1).default(1),
  gold_rate_paise: z.number().int().min(100000), // e.g. min 1000/g in paise
  total_amount_paise: z.number().int().min(0),
  advance_paid_paise: z.number().int().min(0).default(0),
  expected_delivery: z.string().optional(),
})

export type PartnerInput = z.infer<typeof PartnerSchema>
export type OrderInput = z.infer<typeof OrderSchema>
