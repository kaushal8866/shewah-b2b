export const MODULES = [
  { id: 'dashboard',       label: 'Dashboard',           href: '/' },
  { id: 'partners',        label: 'Partners CRM',        href: '/partners' },
  { id: 'customers',       label: 'Customers (D2C)',     href: '/customers' },
  { id: 'enquiries',       label: 'Enquiries (D2C)',     href: '/enquiries' },
  { id: 'orders',          label: 'Orders',              href: '/orders' },
  { id: 'cad_requests',    label: 'CAD Requests',        href: '/cad-requests' },
  { id: 'cad_partners',    label: 'CAD Partners',        href: '/cad-partners' },
  { id: 'manufacturing',   label: 'Manufacturing',       href: '/manufacturing' },
  { id: 'catalog',         label: 'Catalog',             href: '/catalog' },
  { id: 'gold_rates',      label: 'Gold Rates',          href: '/gold-rates' },
  { id: 'gold_rates',      label: 'Purchase Lots',       href: '/purchase-lots' },
  { id: 'vendors',         label: 'Vendors & Inventory', href: '/vendors' },
  { id: 'circuits',        label: 'Circuits',            href: '/circuits' },
  { id: 'analytics',       label: 'Analytics',           href: '/analytics' },
  { id: 'profitability',   label: 'Profitability',       href: '/profitability' },
  { id: 'cash',            label: 'Cash Book',           href: '/cash' },
  { id: 'diamond_procurement', label: 'Diamond Procurement', href: '/diamond-asks' },
  { id: 'aurora',          label: 'AURORA Intelligence', href: '/aurora' },
] as const

export type ModuleId = typeof MODULES[number]['id']

export function canAccess(
  role: string,
  permissions: string[],
  href: string
): boolean {
  if (role === 'master') return true
  if (href === '/cash/pnl' || href.startsWith('/cash/pnl')) return false
  const mod = MODULES.find(m =>
    m.href === href || (m.href !== '/' && href.startsWith(m.href))
  )
  if (!mod || mod.id === 'dashboard') return true
  return permissions.includes(mod.id)
}
