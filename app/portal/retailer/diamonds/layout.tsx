'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Diamond, MessageSquare, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DiamondsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/portal/retailer/diamonds',      label: 'Browse Diamonds', icon: Diamond, exact: true },
    { href: '/portal/retailer/diamonds/asks',  label: 'My Asks & Price Negotiations', icon: MessageSquare },
    { href: '/portal/retailer/diamonds/orders', label: 'Diamond Orders', icon: ClipboardList }
  ]

  function isActive(t: { href: string; exact?: boolean }) {
    return t.exact ? pathname === t.href : pathname.startsWith(t.href)
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-stone-900">Loose Diamond Procurement</h1>
        <p className="text-xs text-stone-500 mt-1">
          Search inventory, negotiate per-carat asks, and procure raw loose diamonds from Shewah.
        </p>
      </div>

      <div className="flex border-b border-stone-200 overflow-x-auto gap-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = isActive(t)
          return (
            <Link key={t.href} href={t.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-[2px] transition-colors whitespace-nowrap',
                active
                  ? 'border-stone-800 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-850 hover:border-stone-250'
              )}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </Link>
          )
        })}
      </div>

      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
