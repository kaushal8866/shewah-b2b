'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShoppingBag, Package,
  TrendingUp, Pen, Map, BarChart2, Settings, Diamond,
  Factory, Store, Menu, X, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard'     },
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
  { href: '/dashboard',     icon: LayoutDashboard, short: 'Dashboard'},
  { href: '/partners',      icon: Users,           short: 'Partners' },
  { href: '/orders',        icon: ShoppingBag,     short: 'Orders'   },
  { href: '/manufacturing', icon: Factory,         short: 'Mfg'      },
  { href: '/gold-rates',    icon: TrendingUp,      short: 'Gold'     },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const isPublicPage = pathname === '/' || pathname === '/login' || pathname.startsWith('/portal') || pathname.startsWith('/track') || pathname.startsWith('/auth')

  useEffect(() => {
    if (isPublicPage) {
      setAuthChecked(true)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
      } else {
        setAuthChecked(true)
      }
    })
  }, [pathname, isPublicPage])

  if (isPublicPage) return <>{children}</>

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Diamond className="w-4 h-4 text-surface-lowest" />
          </div>
          <p className="text-secondary text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-surface-low flex-col shrink-0">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Diamond className="w-4 h-4 text-surface-lowest" />
            </div>
            <div>
              <p className="text-primary font-medium text-sm leading-none tracking-tight">Shewah</p>
              <p className="text-secondary text-[10px] uppercase tracking-widest mt-1">B2B Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all',
                  active ? 'bg-surface-lowest text-primary shadow-ambient font-medium' : 'text-secondary hover:text-primary hover:bg-surface-highest'
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-6 py-5 space-y-3">
          <p className="label-md">Surat, Gujarat</p>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-secondary hover:text-primary text-xs transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile full menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-surface-lowest flex flex-col">
          <div className="flex items-center justify-between px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Diamond className="w-4 h-4 text-surface-lowest" />
              </div>
              <p className="text-primary font-medium text-sm">Shewah</p>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="text-secondary hover:text-primary p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {nav.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 rounded-md text-base transition-colors',
                    active ? 'bg-primary text-surface-lowest font-medium' : 'text-secondary'
                  )}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="px-5 py-5">
            <button onClick={handleSignOut}
              className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface relative">
        {/* Mobile header (Glassmorphism) */}
        <header className="lg:hidden fixed top-0 w-full z-40 flex items-center justify-between px-4 py-3 bg-surface-lowest/70 backdrop-blur-[12px] shrink-0 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Diamond className="w-3.5 h-3.5 text-surface-lowest" />
            </div>
            <p className="text-primary font-medium text-sm tracking-tight">Shewah Admin</p>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="text-primary p-1">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 pt-14 lg:pt-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-lowest/80 backdrop-blur-[12px] border-t ghost-border flex z-40 safe-area-pb">
          {bottomNav.map(({ href, icon: Icon, short }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors',
                  active ? 'text-primary' : 'text-secondary hover:text-primary'
                )}>
                <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
                <span className="text-[10px] leading-none uppercase tracking-[0.05em]">{short}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-secondary hover:text-primary">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] leading-none uppercase tracking-[0.05em]">More</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
