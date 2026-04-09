'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShoppingBag, Package,
  TrendingUp, Pen, Map, BarChart2, Settings, Diamond
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const nav = [
  { href: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/partners',      icon: Users,           label: 'Partners' },
  { href: '/orders',        icon: ShoppingBag,     label: 'Orders' },
  { href: '/cad-requests',  icon: Pen,             label: 'CAD Requests' },
  { href: '/catalog',       icon: Package,         label: 'Catalog' },
  { href: '/gold-rates',    icon: TrendingUp,      label: 'Gold Rates' },
  { href: '/circuits',      icon: Map,             label: 'Circuits' },
  { href: '/analytics',     icon: BarChart2,       label: 'Analytics' },
  { href: '/settings',      icon: Settings,        label: 'Settings' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <html lang="en">
      <head>
        <title>Shewah B2B Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="flex h-screen overflow-hidden">

          {/* Sidebar */}
          <aside className="w-56 bg-[#1C1A17] flex flex-col shrink-0">
            {/* Logo */}
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

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {nav.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                      active
                        ? 'bg-[#C49C64] text-white font-medium'
                        : 'text-white/60 hover:text-white hover:bg-white/8'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Bottom */}
            <div className="px-5 py-4 border-t border-white/10">
              <p className="text-white/30 text-xs">Surat, Gujarat</p>
              <p className="text-white/20 text-xs">© 2025 Shewah</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-stone-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
