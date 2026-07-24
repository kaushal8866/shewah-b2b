/**
 * Shewah B2B — single source of truth for admin authorization.
 *
 * Before this module, `permissions[]` on a sub-admin was enforced only by
 * AppShell deciding which nav links to render. Middleware checked two paths;
 * `/api/db` checked none. A sub-admin with an empty permission list could
 * reach every admin screen by typing the URL, and read or write all 68
 * allow-listed tables through the generic DB proxy.
 *
 * Three rules hold here:
 *   1. FAIL CLOSED. An unmapped route or table is denied, never allowed. The
 *      previous helper in lib/modules.ts returned `true` for anything it did
 *      not recognise, which silently exempted /invoices, /quotes, /stock,
 *      /resellers, /configurator and more.
 *   2. ONE MAP. Middleware, /api/db and the nav all resolve through this file,
 *      so the UI cannot drift from what the server actually permits.
 *   3. MASTER IS ABSOLUTE, everyone else is explicit.
 *
 * Adding a screen or table means adding it here — that is deliberate.
 */

// ── Modules ────────────────────────────────────────────────────────────────

export const MODULE_IDS = [
  'dashboard',
  'partners',
  'resellers',
  'customers',
  'enquiries',
  'orders',
  'cad_requests',
  'cad_partners',
  'manufacturing',
  'catalog',
  'gold_rates',
  'vendors',
  'circuits',
  'analytics',
  'profitability',
  'cash',
  'diamond_procurement',
  'settings',
] as const

export type ModuleId = typeof MODULE_IDS[number]

export type Role = 'master' | 'sub' | 'manufacturer' | 'retailer' | 'reseller'

export type Actor = {
  role: string | null | undefined
  permissions: string[] | null | undefined
}

/** Modules only the master admin may ever reach, regardless of permissions. */
export const MASTER_ONLY_MODULES = new Set<ModuleId>(['settings'])

/** Every authenticated admin gets the dashboard; it carries no sensitive data. */
const ALWAYS_ALLOWED_MODULES = new Set<ModuleId>(['dashboard'])

// ── Route → module map ─────────────────────────────────────────────────────
// Longest prefix wins, so '/catalog/categories' can differ from '/catalog'.
// Every admin page and API namespace must appear here or it is denied.

const ROUTE_MODULES: Array<[string, ModuleId]> = [
  // Pages
  ['/dashboard',               'dashboard'],
  ['/partners',                'partners'],
  ['/resellers',               'resellers'],
  ['/customers',               'customers'],
  ['/enquiries',               'enquiries'],
  ['/quotes',                  'orders'],
  ['/orders',                  'orders'],
  ['/order-change-requests',   'orders'],
  ['/invoices',                'orders'],
  ['/cad-requests',            'cad_requests'],
  ['/cad-partners',            'cad_partners'],
  ['/manufacturing',           'manufacturing'],
  ['/ready-to-ship',           'manufacturing'],
  ['/catalog',                 'catalog'],
  ['/configurator',            'catalog'],
  ['/gold-rates',              'gold_rates'],
  ['/purchase-lots',           'gold_rates'],
  ['/stock',                   'vendors'],
  ['/diamonds',                'vendors'],
  ['/vendors',                 'vendors'],
  ['/circuits',                'circuits'],
  ['/analytics',               'analytics'],
  ['/profitability',           'profitability'],
  ['/cash',                    'cash'],
  ['/diamond-asks',            'diamond_procurement'],
  ['/settings',                'settings'],
  ['/apply',                   'partners'],
  ['/shared-design',           'catalog'],

  // API namespaces
  ['/api/dashboard',               'dashboard'],
  ['/api/partners',                'partners'],
  ['/api/resellers',               'resellers'],
  ['/api/customers',               'customers'],
  ['/api/enquiries',               'enquiries'],
  ['/api/quotes',                  'orders'],
  ['/api/orders',                  'orders'],
  ['/api/order-change-requests',   'orders'],
  ['/api/invoices',                'orders'],
  ['/api/interests',               'orders'],
  ['/api/cad-requests',            'cad_requests'],
  ['/api/cad-partners',            'cad_partners'],
  ['/api/manufacturing',           'manufacturing'],
  ['/api/ready-to-ship',           'manufacturing'],
  ['/api/replenishment',           'manufacturing'],
  ['/api/catalog',                 'catalog'],
  ['/api/collections',             'catalog'],
  ['/api/configurator',            'catalog'],
  ['/api/purchase-lots',           'gold_rates'],
  ['/api/stock',                   'vendors'],
  ['/api/diamonds',                'vendors'],
  ['/api/cash',                    'cash'],
  ['/api/diamond-asks',            'diamond_procurement'],
  ['/api/staff',                   'settings'],
  ['/api/users',                   'settings'],
  ['/api/upload-errors',           'settings'],
]

/**
 * Resolve the module that governs a path, or null when the path is not an
 * admin surface this map knows about.
 */
export function moduleForPath(pathname: string): ModuleId | null {
  let best: { prefix: string; module: ModuleId } | null = null
  for (const [prefix, module] of ROUTE_MODULES) {
    const matches = pathname === prefix || pathname.startsWith(prefix + '/')
    if (matches && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, module }
    }
  }
  return best ? best.module : null
}

// ── Core decision ──────────────────────────────────────────────────────────

export function canAccessModule(actor: Actor, module: ModuleId): boolean {
  if (actor.role === 'master') return true
  if (actor.role !== 'sub') return false           // portal roles never reach admin modules
  if (MASTER_ONLY_MODULES.has(module)) return false
  if (ALWAYS_ALLOWED_MODULES.has(module)) return true
  return (actor.permissions || []).includes(module)
}

/**
 * Authorize an admin path. Fail-closed: an unmapped path is denied.
 * Returns the reason so callers can distinguish "not yours" from "no such
 * admin surface" when logging.
 */
export function canAccessPath(
  actor: Actor,
  pathname: string,
): { allowed: true; module: ModuleId } | { allowed: false; reason: 'unmapped' | 'forbidden' } {
  const module = moduleForPath(pathname)
  if (!module) return { allowed: false, reason: 'unmapped' }
  if (!canAccessModule(actor, module)) return { allowed: false, reason: 'forbidden' }
  return { allowed: true, module }
}

// ── Table → module map (for the /api/db proxy) ─────────────────────────────
// The proxy runs on the service-role key with RLS bypassed, so this map is the
// only thing standing between a sub-admin and the whole database. A table
// absent from this map cannot be reached through the proxy at all.

export const TABLE_MODULES: Record<string, ModuleId> = {
  // partners
  partners: 'partners',
  visits: 'partners',
  partner_signups: 'partners',
  // resellers
  resellers: 'resellers',
  reseller_invitations: 'resellers',
  reseller_product_prices: 'resellers',
  reseller_orders: 'resellers',
  reseller_sample_ledger: 'resellers',
  reseller_payments: 'resellers',
  reseller_customers: 'resellers',
  reseller_share_links: 'resellers',
  reseller_themes: 'resellers',
  reseller_storefront_customers: 'resellers',
  reseller_storefront_carts: 'resellers',
  reseller_messages: 'resellers',
  reseller_storefront_reviews: 'resellers',
  reseller_storefront_coupons: 'resellers',
  reseller_storefront_abandoned_carts: 'resellers',
  reseller_notifications: 'resellers',
  // customers / D2C
  customers: 'customers',
  customer_addresses: 'customers',
  customer_journey_links: 'customers',
  customer_enquiries: 'enquiries',
  customer_enquiry_activity: 'enquiries',
  // orders
  orders: 'orders',
  order_pipeline: 'orders',
  order_payments: 'orders',
  production_updates: 'orders',
  quotes: 'orders',
  quote_items: 'orders',
  quote_share_links: 'orders',
  // cad
  cad_requests: 'cad_requests',
  // manufacturing
  manufacturing_partners: 'manufacturing',
  manufacturing_orders: 'manufacturing',
  labour_rates: 'manufacturing',
  replenishment_obligations: 'manufacturing',
  replenishment_offsets: 'manufacturing',
  // catalog
  products: 'catalog',
  product_categories: 'catalog',
  design_collections: 'catalog',
  design_collection_products: 'catalog',
  design_interests: 'catalog',
  showcase_views: 'catalog',
  cfg_stone_prices: 'catalog',
  // rates & lots
  gold_rates: 'gold_rates',
  purchase_lots: 'gold_rates',
  lot_issuances: 'gold_rates',
  // inventory
  vendors: 'vendors',
  inventory: 'vendors',
  // circuits
  circuits: 'circuits',
  // cash
  cash_transactions: 'cash',
  // settings
  settings: 'settings',
}

/**
 * Tables that stay master-only even when the owning module is granted —
 * material ledgers, gold custody, invoices and cross-partner trades carry
 * settlement consequences a delegated sub-admin should not be able to alter.
 */
export const MASTER_ONLY_TABLES = new Set<string>([
  'app_users',
  'material_float',
  'material_transactions',
  'reconciliation_alerts',
  'stock_movements',
  'partner_diamond_trades',
  'partner_trade_payments',
  'gst_invoices',
])

export type DbOp = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

const WRITE_OPS = new Set<DbOp>(['insert', 'update', 'delete', 'upsert'])

/**
 * Authorize a single /api/db call. Fail-closed on unknown tables and ops.
 */
export function canAccessTable(
  actor: Actor,
  table: string,
  op: DbOp,
): { allowed: true } | { allowed: false; status: 400 | 403; message: string } {
  if (actor.role !== 'master' && actor.role !== 'sub') {
    return { allowed: false, status: 403, message: 'Forbidden' }
  }

  if (MASTER_ONLY_TABLES.has(table)) {
    return actor.role === 'master'
      ? { allowed: true }
      : { allowed: false, status: 403, message: 'Forbidden' }
  }

  const module = TABLE_MODULES[table]
  if (!module) {
    return { allowed: false, status: 400, message: `Table "${table}" is not allowed` }
  }

  // Settings is a special case: the /settings SCREEN is master-only, but the
  // settings TABLE holds business config (GST rate, business name, WhatsApp
  // number) that ordinary admin screens read constantly. So reads are open to
  // any admin while writes stay with the master. Checked before the module
  // gate below, which would otherwise deny sub-admins outright.
  if (table === 'settings') {
    if (WRITE_OPS.has(op) && actor.role !== 'master') {
      return { allowed: false, status: 403, message: 'Forbidden' }
    }
    return { allowed: true }
  }

  if (!canAccessModule(actor, module)) {
    return { allowed: false, status: 403, message: 'Forbidden' }
  }

  return { allowed: true }
}
