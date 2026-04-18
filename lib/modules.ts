export const MODULES = [
  { id: 'dashboard',       label: 'Dashboard',           href: '/' },
  { id: 'partners',        label: 'Partners CRM',        href: '/partners' },
  { id: 'orders',          label: 'Orders',              href: '/orders' },
  { id: 'cad_requests',    label: 'CAD Requests',        href: '/cad-requests' },
  { id: 'cad_partners',    label: 'CAD Partners',        href: '/cad-partners' },
  { id: 'manufacturing',   label: 'Manufacturing',       href: '/manufacturing' },
  { id: 'catalog',         label: 'Catalog',             href: '/catalog' },
  { id: 'gold_rates',      label: 'Gold Rates',          href: '/gold-rates' },
  { id: 'vendors',         label: 'Vendors & Inventory', href: '/vendors' },
  { id: 'circuits',        label: 'Circuits',            href: '/circuits' },
  { id: 'analytics',       label: 'Analytics',           href: '/analytics' },
  { id: 'profitability',   label: 'Profitability',       href: '/profitability' },
] as const

export type ModuleId = typeof MODULES[number]['id']

export function canAccess(
  role: string,
  permissions: string[],
  href: string
): boolean {
  if (role === 'master') return true
  const mod = MODULES.find(m =>
    m.href === href || (m.href !== '/' && href.startsWith(m.href))
  )
  if (!mod || mod.id === 'dashboard') return true
  return permissions.includes(mod.id)
}
