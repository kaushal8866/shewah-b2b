'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { canAccess } from '@/lib/modules'
import {
  LayoutDashboard, Users, ShoppingBag, Package,
  TrendingUp, Pen, Map, BarChart2, Settings, Diamond,
  Factory, Store, Menu, X, LogOut, ChevronDown, Coins
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { href: '/',                icon: LayoutDashboard, label: 'Dashboard',     module: 'dashboard'     },
  { href: '/partners',        icon: Users,           label: 'Partners',      module: 'partners'      },
  { href: '/orders',          icon: ShoppingBag,     label: 'Orders',        module: 'orders'        },
  { href: '/cad-requests',    icon: Pen,             label: 'CAD Requests',  module: 'cad_requests'  },
  { href: '/manufacturing',   icon: Factory,         label: 'Manufacturing', module: 'manufacturing' },
  { href: '/catalog',         icon: Package,         label: 'Catalog',       module: 'catalog'       },
  { href: '/gold-rates',      icon: TrendingUp,      label: 'Gold Rates',    module: 'gold_rates'    },
  { href: '/vendors',         icon: Store,           label: 'Vendors',       module: 'vendors'       },
  { href: '/circuits',        icon: Map,             label: 'Circuits',      module: 'circuits'      },
  { href: '/analytics',       icon: BarChart2,       label: 'Analytics',     module: 'analytics'     },
  { href: '/profitability',   icon: Coins,           label: 'Profitability', module: 'profitability' },
  { href: '/settings',        icon: Settings,        label: 'Settings',      module: 'settings'      },
]

const bottomNav = [
  { href: '/',              icon: LayoutDashboard, short: 'Home',     module: 'dashboard'     },
  { href: '/partners',      icon: Users,           short: 'Partners', module: 'partners'      },
  { href: '/orders',        icon: ShoppingBag,     short: 'Orders',   module: 'orders'        },
  { href: '/manufacturing', icon: Factory,         short: 'Mfg',      module: 'manufacturing' },
  { href: '/gold-rates',    icon: TrendingUp,      short: 'Gold',     module: 'gold_rates'    },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const isPublic = pathname === '/login' || pathname.startsWith('/setup') || pathname.startsWith('/showcase') || pathname.startsWith('/track') || pathname.startsWith('/portal')
  if (isPublic) return <>{children}</>  

  const role = session?.user?.role || 'sub'
  const permissions = session?.user?.permissions || []

  function hasAccess(module: string): boolean {
    if (!session) return false
    if (role === 'master') return true
    if (module === 'dashboard') return true
    if (module === 'settings') return false
    return permissions.includes(module)
  }

  const visibleNav = nav.filter(item => hasAccess(item.module))
  const visibleBottom = bottomNav.filter(item => hasAccess(item.module))

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  const displayName = session?.user?.displayName || session?.user?.name || session?.user?.username || '...'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-[#1A1F2E] flex-col shrink-0">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Shewah</p>
              <p className="text-white/40 text-xs mt-0.5">B2B Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-white/10 text-white font-medium ring-1 ring-white/15' : 'text-white/60 hover:text-white hover:bg-white/5'
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 bg-black/15">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors text-left">
              <div className="w-7 h-7 rounded-full bg-[#1E3A5F]/20 border border-[#1E3A5F]/30 flex items-center justify-center shrink-0">
                <span className="text-[#1E3A5F] text-xs font-semibold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{displayName}</p>
                <p className="text-white/30 text-[10px] capitalize">{role === 'master' ? 'Master admin' : 'Staff'}</p>
              </div>
              <ChevronDown className={cn('w-3 h-3 text-white/30 shrink-0 transition-transform', userMenuOpen && 'rotate-180')} />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#252B3D] border border-white/10 rounded-xl p-1 z-50">
                {role === 'master' && (
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/8 rounded-lg">
                    <Settings className="w-4 h-4" /> Manage users
                  </Link>
                )}
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile full menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#1A1F2E] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
                <Diamond className="w-4 h-4 text-white" />
              </div>
              <p className="text-white font-semibold text-sm">Shewah</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="text-white/60 hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {visibleNav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 rounded-xl text-base transition-colors',
                    active ? 'bg-white/10 text-white font-medium ring-1 ring-white/15' : 'text-white/60'
                  )}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="px-4 py-4 bg-black/15 space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-[#1E3A5F]/20 border border-[#1E3A5F]/30 flex items-center justify-center">
                <span className="text-[#1E3A5F] text-sm font-semibold">{initials}</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{displayName}</p>
                <p className="text-white/30 text-xs capitalize">{role === 'master' ? 'Master admin' : 'Staff'}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400/80 hover:bg-red-500/10">
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#1A1F2E] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
              <Diamond className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-white font-semibold text-sm">Shewah Admin</p>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="text-white/70 p-1">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-base pb-20 lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav — glass */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-md flex z-40 safe-area-pb shadow-[0_-1px_24px_rgba(30,58,95,0.06)]">
          {visibleBottom.map(({ href, icon: Icon, short }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                  active ? 'text-[#1E3A5F]' : 'text-stone-400'
                )}>
                <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
                <span className="text-[10px] leading-none">{short}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs text-stone-400">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] leading-none">More</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
