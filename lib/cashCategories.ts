export type TxnType = 'income' | 'expense'

export interface CashCategory {
  group: string
  key: string            // stored in `category` column
  label: string          // shown in UI
  emoji: string
  is_cogs: boolean       // affects gross profit calculation
  type: TxnType
}

export const CASH_CATEGORIES: CashCategory[] = [
  // === INCOME ===
  { type: 'income', group: 'sales',        key: 'jewelry_cash_sale',      label: 'Jewelry — Cash Sale',         emoji: '💍', is_cogs: false },
  { type: 'income', group: 'sales',        key: 'jewelry_upi_sale',       label: 'Jewelry — UPI Sale',          emoji: '💍', is_cogs: false },
  { type: 'income', group: 'sales',        key: 'gold_sale',              label: 'Gold Sale',                   emoji: '🥇', is_cogs: false },
  { type: 'income', group: 'sales',        key: 'ready_to_ship_sale',     label: 'Ready-to-Ship Sale',          emoji: '📦', is_cogs: false },
  { type: 'income', group: 'advance',      key: 'order_advance',          label: 'Order Advance Received',      emoji: '💵', is_cogs: false },
  { type: 'income', group: 'advance',      key: 'balance_collection',     label: 'Balance Payment Collected',   emoji: '💵', is_cogs: false },
  { type: 'income', group: 'recovery',     key: 'karigar_material_return',label: 'Karigar Material Return',     emoji: '🔄', is_cogs: true  },
  { type: 'income', group: 'recovery',     key: 'vendor_refund',          label: 'Vendor Refund',               emoji: '🔄', is_cogs: true  },
  { type: 'income', group: 'other_income', key: 'commission',             label: 'Commission Received',         emoji: '📊', is_cogs: false },
  { type: 'income', group: 'other_income', key: 'other',                  label: 'Other Income',                emoji: '➕', is_cogs: false },

  // === EXPENSE — COGS ===
  { type: 'expense', group: 'raw_material',    key: 'gold_purchase_cash',    label: 'Gold Purchase — Cash',      emoji: '🥇', is_cogs: true },
  { type: 'expense', group: 'raw_material',    key: 'gold_purchase_upi',     label: 'Gold Purchase — UPI',       emoji: '🥇', is_cogs: true },
  { type: 'expense', group: 'raw_material',    key: 'diamond_purchase',      label: 'Diamond Purchase',          emoji: '💎', is_cogs: true },
  { type: 'expense', group: 'raw_material',    key: 'finding_purchase',      label: 'Findings / Components',     emoji: '🔩', is_cogs: true },
  { type: 'expense', group: 'raw_material',    key: 'silver_purchase',       label: 'Silver Purchase',           emoji: '🪙', is_cogs: true },
  { type: 'expense', group: 'manufacturing',   key: 'karigar_labour',        label: 'Karigar Labour',            emoji: '👐', is_cogs: true },
  { type: 'expense', group: 'manufacturing',   key: 'karigar_advance',       label: 'Karigar Advance',           emoji: '👐', is_cogs: true },
  { type: 'expense', group: 'manufacturing',   key: 'cad_charges',           label: 'CAD Charges',               emoji: '🖥️', is_cogs: true },
  { type: 'expense', group: 'manufacturing',   key: 'casting_charges',       label: 'Casting / Melting',         emoji: '🏭', is_cogs: true },
  { type: 'expense', group: 'manufacturing',   key: 'rhodium_polishing',     label: 'Rhodium / Polishing',       emoji: '✨', is_cogs: true },
  { type: 'expense', group: 'certification',   key: 'igi_gia_cert',          label: 'IGI / GIA Certification',   emoji: '📜', is_cogs: true },
  { type: 'expense', group: 'certification',   key: 'bis_hallmark',          label: 'BIS Hallmarking',           emoji: '🏷️', is_cogs: true },
  { type: 'expense', group: 'certification',   key: 'appraisal_other',       label: 'Other Certification',       emoji: '📋', is_cogs: true },
  { type: 'expense', group: 'packaging',       key: 'box_packaging',         label: 'Box & Packaging',           emoji: '📦', is_cogs: true },
  { type: 'expense', group: 'logistics',       key: 'courier_freight',       label: 'Courier / Freight',         emoji: '🚚', is_cogs: true },
  { type: 'expense', group: 'logistics',       key: 'insurance_transit',     label: 'Transit Insurance',         emoji: '🛡️', is_cogs: true },

  // === EXPENSE — OPEX ===
  { type: 'expense', group: 'office',       key: 'rent',                  label: 'Rent',                      emoji: '🏢', is_cogs: false },
  { type: 'expense', group: 'office',       key: 'electricity',           label: 'Electricity',               emoji: '⚡', is_cogs: false },
  { type: 'expense', group: 'office',       key: 'internet_phone',        label: 'Internet / Phone',          emoji: '📱', is_cogs: false },
  { type: 'expense', group: 'office',       key: 'office_supplies',       label: 'Office Supplies',           emoji: '🖊️', is_cogs: false },
  { type: 'expense', group: 'staff',        key: 'staff_salary',          label: 'Staff Salary',              emoji: '👤', is_cogs: false },
  { type: 'expense', group: 'staff',        key: 'staff_bonus',           label: 'Staff Bonus / Incentive',   emoji: '🎁', is_cogs: false },
  { type: 'expense', group: 'travel',       key: 'travel_conveyance',     label: 'Travel / Conveyance',       emoji: '✈️', is_cogs: false },
  { type: 'expense', group: 'travel',       key: 'hotel_stay',            label: 'Hotel / Stay',              emoji: '🏨', is_cogs: false },
  { type: 'expense', group: 'travel',       key: 'local_transport',       label: 'Local Transport',           emoji: '🛺', is_cogs: false },
  { type: 'expense', group: 'marketing',    key: 'instagram_ads',         label: 'Instagram Ads',             emoji: '📲', is_cogs: false },
  { type: 'expense', group: 'marketing',    key: 'printing_branding',     label: 'Printing / Branding',       emoji: '🖨️', is_cogs: false },
  { type: 'expense', group: 'marketing',    key: 'exhibition_booth',      label: 'Exhibition / Trade Show',   emoji: '🏛️', is_cogs: false },
  { type: 'expense', group: 'marketing',    key: 'gifts_samples',         label: 'Gifts / Samples',           emoji: '🎁', is_cogs: false },
  { type: 'expense', group: 'tax_fee',      key: 'gst_payment',           label: 'GST Payment',               emoji: '🧾', is_cogs: false },
  { type: 'expense', group: 'tax_fee',      key: 'professional_fee',      label: 'CA / Legal Fee',            emoji: '💼', is_cogs: false },
  { type: 'expense', group: 'tax_fee',      key: 'bank_charge',           label: 'Bank Charges',              emoji: '🏦', is_cogs: false },
  { type: 'expense', group: 'misc',         key: 'petty_cash',            label: 'Petty Cash',                emoji: '💸', is_cogs: false },
  { type: 'expense', group: 'misc',         key: 'repair_maintenance',    label: 'Repair / Maintenance',      emoji: '🔧', is_cogs: false },
  { type: 'expense', group: 'misc',         key: 'other_expense',         label: 'Other Expense',             emoji: '➕', is_cogs: false },
]

// Helper: get is_cogs from category key (server-side use only — never trust client)
export function getCategoryMeta(categoryKey: string): CashCategory | undefined {
  return CASH_CATEGORIES.find(c => c.key === categoryKey)
}

// Helper: get categories filtered by type
export function getCategoriesByType(type: TxnType): CashCategory[] {
  return CASH_CATEGORIES.filter(c => c.type === type)
}

// Categories to pin at top of the quick-entry UI (most frequently used)
export const PINNED_INCOME_CATEGORIES = [
  'jewelry_cash_sale', 'jewelry_upi_sale', 'order_advance', 'balance_collection',
]
export const PINNED_EXPENSE_CATEGORIES = [
  'gold_purchase_cash', 'karigar_labour', 'courier_freight', 'petty_cash',
]
