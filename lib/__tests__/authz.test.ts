import { describe, it, expect } from 'vitest'
import {
  canAccessModule,
  canAccessPath,
  canAccessTable,
  moduleForPath,
  MODULE_IDS,
  TABLE_MODULES,
  MASTER_ONLY_TABLES,
} from '../authz'

const master = { role: 'master', permissions: [] as string[] }
const subNone = { role: 'sub', permissions: [] as string[] }
const subOrders = { role: 'sub', permissions: ['orders'] }
const retailer = { role: 'retailer', permissions: [] as string[] }

describe('fail-closed by default', () => {
  it('denies a path that is not in the map', () => {
    const v = canAccessPath(subOrders, '/some-new-screen')
    expect(v.allowed).toBe(false)
    if (!v.allowed) expect(v.reason).toBe('unmapped')
  })

  it('denies a table that is not in the map', () => {
    const v = canAccessTable(master, 'some_new_table', 'select')
    expect(v.allowed).toBe(false)
  })

  it('never exposes the OTP table through the admin proxy', () => {
    // Storefront OTP hashes must not be readable by any admin.
    expect(TABLE_MODULES['reseller_storefront_otps']).toBeUndefined()
    expect(canAccessTable(master, 'reseller_storefront_otps', 'select').allowed).toBe(false)
  })
})

describe('the bypasses this module exists to close', () => {
  // Before lib/authz.ts, a sub-admin with an empty permission list could reach
  // every one of these by typing the URL — middleware only checked /settings
  // and /profitability.
  const previouslyUnguarded = [
    '/cash', '/invoices', '/quotes', '/stock', '/purchase-lots',
    '/resellers', '/manufacturing', '/ready-to-ship', '/diamonds',
    '/order-change-requests', '/configurator', '/catalog',
  ]

  for (const path of previouslyUnguarded) {
    it(`denies ${path} to a sub-admin with no permissions`, () => {
      expect(canAccessPath(subNone, path).allowed).toBe(false)
    })
  }

  it('denies the whole database to a sub-admin with no permissions', () => {
    for (const table of Object.keys(TABLE_MODULES)) {
      if (table === 'settings') continue // read-only config, asserted separately
      expect(canAccessTable(subNone, table, 'select').allowed).toBe(false)
    }
  })

  it('grants only the tables belonging to a granted module', () => {
    expect(canAccessTable(subOrders, 'orders', 'select').allowed).toBe(true)
    expect(canAccessTable(subOrders, 'quotes', 'update').allowed).toBe(true)
    expect(canAccessTable(subOrders, 'cash_transactions', 'select').allowed).toBe(false)
    expect(canAccessTable(subOrders, 'partners', 'select').allowed).toBe(false)
  })
})

describe('master-only boundaries', () => {
  it('keeps settlement tables master-only even with the module granted', () => {
    const subEverything = { role: 'sub', permissions: [...MODULE_IDS] as string[] }
    for (const table of Array.from(MASTER_ONLY_TABLES)) {
      expect(canAccessTable(subEverything, table, 'select').allowed).toBe(false)
      expect(canAccessTable(master, table, 'select').allowed).toBe(true)
    }
  })

  it('keeps /settings master-only', () => {
    const subWithSettings = { role: 'sub', permissions: ['settings'] }
    expect(canAccessPath(subWithSettings, '/settings').allowed).toBe(false)
    expect(canAccessPath(master, '/settings').allowed).toBe(true)
  })

  it('lets any admin read settings config but only master write it', () => {
    expect(canAccessTable(subNone, 'settings', 'select').allowed).toBe(true)
    expect(canAccessTable(subNone, 'settings', 'update').allowed).toBe(false)
    expect(canAccessTable(master, 'settings', 'update').allowed).toBe(true)
  })

  it('grants master everything', () => {
    for (const id of MODULE_IDS) expect(canAccessModule(master, id)).toBe(true)
  })
})

describe('AURORA is master-only', () => {
  // The copilot answers with consolidated financials read through the
  // service-role client. Grantable access would let a sub-admin without
  // `cash` or `profitability` ask a chat box for revenue and get it.
  const subEverything = { role: 'sub', permissions: [...MODULE_IDS] as string[] }

  it('denies /aurora to a sub-admin holding every permission', () => {
    expect(canAccessPath(subEverything, '/aurora').allowed).toBe(false)
    expect(canAccessModule(subEverything, 'aurora')).toBe(false)
  })

  it('denies the API namespace too, not just the page', () => {
    expect(canAccessPath(subEverything, '/api/aurora/copilot').allowed).toBe(false)
    expect(canAccessPath(subEverything, '/api/aurora/insights').allowed).toBe(false)
  })

  it('allows master', () => {
    expect(canAccessPath(master, '/aurora').allowed).toBe(true)
    expect(canAccessPath(master, '/api/aurora/copilot').allowed).toBe(true)
  })

  it('is registered, so it cannot fail closed by accident', () => {
    // Without this entry AURORA 403s for everyone the moment this branch
    // merges, because the map denies anything it does not recognise.
    expect(moduleForPath('/aurora')).toBe('aurora')
    expect(moduleForPath('/api/aurora/copilot')).toBe('aurora')
  })
})

describe('portal roles are not admins', () => {
  it('denies admin paths and tables to a retailer', () => {
    expect(canAccessPath(retailer, '/orders').allowed).toBe(false)
    expect(canAccessTable(retailer, 'orders', 'select').allowed).toBe(false)
  })
})

describe('route resolution', () => {
  it('uses the longest matching prefix', () => {
    expect(moduleForPath('/cash/pnl')).toBe('cash')
    expect(moduleForPath('/catalog/categories/abc')).toBe('catalog')
    expect(moduleForPath('/api/orders/123/production-updates')).toBe('orders')
  })

  it('does not match a prefix that is only a partial segment', () => {
    // '/orders' must not swallow '/order-change-requests' by raw startsWith.
    expect(moduleForPath('/order-change-requests')).toBe('orders')
    expect(moduleForPath('/cash-something-else')).toBeNull()
  })

  it('grants the dashboard to every admin', () => {
    expect(canAccessPath(subNone, '/dashboard').allowed).toBe(true)
  })

  it('resolves every module from at least one real route', () => {
    // Guards against a module id existing in MODULE_IDS (and so being
    // grantable in Settings) while no route actually resolves to it.
    const representative: Record<string, string> = {
      dashboard: '/dashboard',
      aurora: '/aurora',
      partners: '/partners',
      resellers: '/resellers',
      customers: '/customers',
      enquiries: '/enquiries',
      orders: '/orders',
      cad_requests: '/cad-requests',
      cad_partners: '/cad-partners',
      manufacturing: '/manufacturing',
      catalog: '/catalog',
      gold_rates: '/gold-rates',
      vendors: '/vendors',
      circuits: '/circuits',
      analytics: '/analytics',
      profitability: '/profitability',
      cash: '/cash',
      diamond_procurement: '/diamond-asks',
      settings: '/settings',
    }
    for (const id of MODULE_IDS) {
      expect(representative[id], `no representative route for "${id}"`).toBeDefined()
      expect(moduleForPath(representative[id])).toBe(id)
    }
  })
})
