'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Diamond, LogOut, Store, Package, ShoppingBag, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RetailerPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const displayName = session?.user?.displayName || session?.user?.username || '...'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  const tabs = [
    { href: '/portal/retailer',         label: 'Home',         icon: Store,      exact: true },
    { href: '/portal/retailer/catalog',  label: 'Catalog',      icon: Package },
    { href: '/portal/retailer/ready-to-ship', label: 'Ready Now', icon: Package },
    { href: '/portal/retailer/custom',   label: 'Custom order', icon: Sparkles },
    { href: '/portal/retailer/diamonds', label: 'Loose Diamonds', icon: Diamond },
    { href: '/portal/retailer/orders',   label: 'Orders',       icon: ShoppingBag },
    { href: '/portal/retailer/profile',  label: 'Profile',      icon: User },
  ]

  function isActive(t: { href: string; exact?: boolean }) {
    return t.exact ? pathname === t.href : pathname.startsWith(t.href)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-[#1A1F2E] text-white px-4 lg:px-6 py-3 flex items-center justify-between shrink-0">
        <Link href="/portal/retailer" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
            <Diamond className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Shewah</p>
            <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
              <Store className="w-3 h-3" /> Retailer Portal
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1E3A5F]/20 border border-[#1E3A5F]/30 flex items-center justify-center">
              <span className="text-[#1E3A5F] text-xs font-semibold">{initials}</span>
            </div>
            <p className="text-white text-sm">{displayName}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-red-400/80 hover:text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/10">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-stone-200 px-4 lg:px-6 flex items-center gap-1 overflow-x-auto shrink-0">
        {tabs.map(t => {
          const Icon = t.icon
          const active = isActive(t)
          return (
            <Link key={t.href} href={t.href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-[#1E3A5F] text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              )}>
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          )
        })}
      </nav>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
