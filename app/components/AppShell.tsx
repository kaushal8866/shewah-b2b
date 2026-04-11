'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShoppingBag, Package,
  TrendingUp, Pen, Map, BarChart2, Settings, Diamond,
  Factory, Store, Menu, X, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/',                icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/partners',        icon: Users,           label: 'Partners'      },
  { href: '/orders',          icon: ShoppingBag,     label: 'Orders'        },
  { href: '/cad-requests',    icon: Pen,             label: 'CAD Requests'  },
  { href: '/manufacturing',   icon: Factory,         label: 'Manufacturing' },
  { href: '/catalog',         icon: Package,         label: 'Catalog'       },
  { href: '/gold-rates',      icon: TrendingUp,      label: 'Gold Rates'    },
  { href: '/vendors',         icon: Store,           label: 'Vendors'       },
  { href: '/circuits',        icon: Map,             label: 'Circuits'      },
  { href: '/analytics',       icon: BarChart2,       label: 'Analytics'     },
  { href: '/settings',        icon: Settings,        label: 'Settings'      },
]

const bottomNav = [
  { href: '/',              icon: LayoutDashboard, short: 'Home'     },
  { href: '/partners',      icon: Users,           short: 'Partners' },
  { href: '/orders',        icon: ShoppingBag,     short: 'Orders'   },
  { href: '/manufacturing', icon: Factory,         short: 'Mfg'      },
  { href: '/gold-rates',    icon: TrendingUp,      short: 'Gold'     },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isPortal = pathname.startsWith('/portal')
  const isLogin = pathname === '/login'

  // Portal and login pages render without the admin shell
  if (isPortal || isLogin) return <>{children}</>

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-[#1C1A17] flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C49C64] flex items-center justify-center">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Shewah</p>
              <p className="text-white/40 text-xs mt-0.5">B2B Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-[#C49C64] text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/8'
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <p className="text-white/30 text-xs">Surat, Gujarat</p>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile full menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#1C1A17] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C49C64] flex items-center justify-center">
                <Diamond className="w-4 h-4 text-white" />
              </div>
              <p className="text-white font-semibold text-sm">Shewah</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="text-white/60 hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {nav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 rounded-xl text-base transition-colors',
                    active ? 'bg-[#C49C64] text-white font-medium' : 'text-white/60'
                  )}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="px-5 py-4 border-t border-white/10">
            <button onClick={handleSignOut}
              className="flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#1C1A17] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#C49C64] flex items-center justify-center">
              <Diamond className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-white font-semibold text-sm">Shewah Admin</p>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="text-white/70 p-1">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-stone-50 pb-20 lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex z-40 safe-area-pb">
          {bottomNav.map(({ href, icon: Icon, short }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                  active ? 'text-[#C49C64]' : 'text-stone-400'
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
