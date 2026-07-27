/**
 * Human-readable labels for the permission modules an admin can be granted.
 *
 * Authorization itself lives in lib/authz.ts — this file is presentation only,
 * used by the Settings screen to render the permission picker. It previously
 * also exported a `canAccess()` helper that returned `true` for any route it
 * did not recognise, silently exempting /invoices, /quotes, /stock, /resellers
 * and all of /configurator from permission checks. That helper is gone; use
 * `canAccessPath` / `canAccessModule` from lib/authz.ts, which fail closed.
 */

import { MODULE_IDS, MASTER_ONLY_MODULES, type ModuleId } from './authz'

export type { ModuleId }

const LABELS: Record<ModuleId, string> = {
  dashboard:           'Dashboard',
  partners:            'Partners CRM',
  resellers:           'Resellers',
  customers:           'Customers (D2C)',
  enquiries:           'Enquiries (D2C)',
  orders:              'Orders, Quotes & Invoices',
  cad_requests:        'CAD Requests',
  cad_partners:        'CAD Partners',
  manufacturing:       'Manufacturing & Ready to Ship',
  catalog:             'Catalog & Configurator',
  gold_rates:          'Gold Rates & Purchase Lots',
  vendors:             'Vendors, Stock & Diamonds',
  circuits:            'Circuits',
  analytics:           'Analytics',
  profitability:       'Profitability',
  cash:                'Cash Book',
  diamond_procurement: 'Diamond Procurement',
  aurora:              'AURORA Intelligence',
  settings:            'Settings',
}

export const MODULES: ReadonlyArray<{ id: ModuleId; label: string }> =
  MODULE_IDS.map(id => ({ id, label: LABELS[id] }))

/**
 * Modules that can actually be granted to a sub-admin. `dashboard` is implicit
 * for every admin and `settings` is master-only, so neither is assignable —
 * showing them as checkboxes would imply control that does not exist.
 */
export const ASSIGNABLE_MODULES: ReadonlyArray<{ id: ModuleId; label: string }> =
  MODULES.filter(m => m.id !== 'dashboard' && !MASTER_ONLY_MODULES.has(m.id))
