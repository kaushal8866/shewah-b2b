/**
 * Shewah B2B — Inventory & Material Intelligence
 * Implements SOP §4 (Inventory & Manufacturing)
 */

import { supabase } from './supabase'

/**
 * Standard Multipliers for Phase 2 Standards
 */
export const WEIGHT_STANDARDS = {
  gold: 1000,      // gram -> mg
  diamond: 100,    // carat -> cents (0.01ct)
}

/**
 * SOP §4.1: Issue material to Karigar (Artisans)
 * Decrements main inventory and increments karigar float via Ledger.
 */
export async function issueMaterial(
  partnerId: string,
  materialType: string,
  amount: number, // In standardized units (mg/cents)
  referenceId?: string,
  notes?: string
) {
  const { data: { session } } = await supabase.auth.getSession()

  // 1. Create Ledger Entry
  const { error: ledgerError } = await supabase.from('material_ledger').insert([{
    partner_id: partnerId,
    material_type: materialType,
    amount: amount, // Positive for issue
    transaction_type: 'issue',
    reference_id: referenceId,
    notes: notes,
    created_by: session?.user?.id
  }])

  if (ledgerError) throw ledgerError

  // 2. Decrement main inventory stock
  // We search for a matching item in the inventory
  const { data: invItem } = await supabase
    .from('inventory')
    .select('id, quantity_in_stock')
    .eq('category', materialType.split('_')[0]) // e.g., 'gold_18k' -> 'gold'
    .order('created_at')
    .limit(1)
    .single()

  if (invItem) {
    await supabase.rpc('decrement_inventory', { 
      item_id: invItem.id, 
      dec_amount: amount 
    })
  }

  return { success: true }
}

/**
 * SOP §4.2: Receive material back from Karigar (Finished Good or scrap)
 */
export async function returnMaterial(
  partnerId: string,
  materialType: string,
  amount: number, // In standardized units (mg/cents)
  transactionType: 'return' | 'loss' | 'adjustment' = 'return',
  referenceId?: string,
  notes?: string
) {
  const { data: { session } } = await supabase.auth.getSession()

  const { error } = await supabase.from('material_ledger').insert([{
    partner_id: partnerId,
    material_type: materialType,
    amount: -amount, // Negative for returns/loss from partner perspective
    transaction_type: transactionType,
    reference_id: referenceId,
    notes: notes,
    created_by: session?.user?.id
  }])

  if (error) throw error
  return { success: true }
}

/**
 * Calculate the manufacturing loss (Ghat) for an order
 */
export function calculateLoss(issuedMg: number, returnedMg: number) {
  if (issuedMg <= 0) return 0
  const loss = issuedMg - returnedMg
  const percentage = (loss / issuedMg) * 100
  return {
    lossMg: loss,
    lossPct: parseFloat(percentage.toFixed(2))
  }
}
