'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Store, 
  Package, 
  ShoppingBag, 
  Users, 
  Palette, 
  Share2, 
  Layers, 
  LogOut, 
  Diamond, 
  Menu, 
  X,
  CreditCard,
  MessageSquare,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ResellerPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()
  const pathname = usePathname()
  const [storeName, setStoreName] = useState('Reseller Store')
  const [loadingTheme, setLoadingTheme] = useState(true)
  const [resellerStatus, setResellerStatus] = useState<string | null>(null)

  const displayName = session?.user?.displayName || session?.user?.username || 'Reseller'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  useEffect(() => {
    if (session) {
      if (session.user?.resellerId) {
        fetchResellerTheme()
      } else {
        setLoadingTheme(false)
      }
    } else if (sessionStatus !== 'loading') {
      setLoadingTheme(false)
    }
  }, [session, sessionStatus])

  async function fetchResellerTheme() {
    try {
      // 1. Fetch reseller status and store_name fallback
      const { data: res } = await supabase
        .from('resellers')
        .select('store_name, status')
        .eq('id', session?.user?.resellerId)
        .maybeSingle()

      if (res) {
        setResellerStatus(res.status || 'onboarding')
        if (res.store_name) {
          setStoreName(res.store_name)
        }
      }

      // 2. Fetch associated theme config
      const { data } = await supabase
        .from('reseller_themes')
        .select('store_name')
        .eq('reseller_id', session?.user?.resellerId)
        .maybeSingle()

      if (data?.store_name) {
        setStoreName(data.store_name)
      }
    } catch {
      // ignore
    } finally {
      setLoadingTheme(false)
    }
  }

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  const tabs = [
    { href: '/portal/reseller',           label: 'Dashboard', icon: Store,        exact: true },
    { href: '/portal/reseller/catalog',    label: 'Catalog',   icon: Package },
    { href: '/portal/reseller/orders',     label: 'Orders',    icon: ShoppingBag },
    { href: '/portal/reseller/customers',  label: 'Customers', icon: Users },
    { href: '/portal/reseller/samples',    label: 'Samples',   icon: CreditCard },
    { href: '/portal/reseller/theme',      label: 'Branding',  icon: Palette },
    { href: '/portal/reseller/share',      label: 'Storefront',icon: Share2 },
    { href: '/portal/reseller/marketing',  label: 'Marketing', icon: Tag },
    { href: '/portal/reseller/messages',   label: 'Support Chat', icon: MessageSquare },
  ]

  function isActive(t: { href: string; exact?: boolean }) {
    return t.exact ? pathname === t.href : pathname.startsWith(t.href)
  }

  // 1. Loading state
  if (sessionStatus === 'loading' || (session && loadingTheme)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-950 animate-spin" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Loading Portal...</p>
        </div>
      </div>
    )
  }

  // 2. Intercept non-active resellers
  if (session && resellerStatus && resellerStatus !== 'active') {
    const isSuspended = resellerStatus === 'suspended'
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col justify-between p-6 md:p-12 font-sans selection:bg-stone-900 selection:text-white">
        {/* Top Header/Brand Bar */}
        <header className="flex items-center justify-between border-b-2 border-stone-900 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-stone-900 flex items-center justify-center">
              <Store className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold tracking-widest text-[10px] uppercase text-stone-900">Reseller Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </header>

        {/* Center Alert Box */}
        <main className="my-auto max-w-lg mx-auto w-full border-2 border-stone-900 bg-white p-8 md:p-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-start">
          <div className="mb-6 flex items-center justify-center w-12 h-12 bg-stone-100 border-2 border-stone-900 text-stone-900">
            {isSuspended ? (
              <X className="w-6 h-6" />
            ) : (
              <Layers className="w-6 h-6" />
            )}
          </div>
          
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900 uppercase mb-4 font-mono">
            {isSuspended ? 'Account Suspended' : 'Activation Pending'}
          </h1>
          
          <p className="text-sm text-stone-600 leading-relaxed mb-8">
            {isSuspended 
              ? 'Your reseller account has been suspended by the platform administrator. If you believe this is an error or need to resolve any outstanding issues, please contact your account manager.'
              : 'Your reseller profile is currently pending review. To protect the white-label storefront ecosystem, access is restricted until your application has been verified and set to active by the administrator.'
            }
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={handleLogout}
              className="flex-1 text-center bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold uppercase tracking-wider py-3.5 px-6 border-2 border-stone-900 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none"
            >
              Log Out of Account
            </button>
            <a 
              href="mailto:support@shewah.com" 
              className="flex-1 text-center bg-white hover:bg-stone-50 text-stone-900 text-xs font-bold uppercase tracking-wider py-3.5 px-6 border-2 border-stone-900 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-[9px] text-stone-400 font-bold uppercase tracking-wider border-t border-stone-200 pt-4 shrink-0">
          Unbranded White-Label Portal &copy; {new Date().getFullYear()}
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-stone-900 text-white px-4 lg:px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
        <Link href="/portal/reseller" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">{storeName}</p>
            <p className="text-white/40 text-[10px] mt-1 uppercase font-semibold tracking-wider">
              Reseller Portal
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-600/20 border border-amber-600/30 flex items-center justify-center">
              <span className="text-amber-500 text-xs font-semibold">{initials}</span>
            </div>
            <p className="text-white text-xs hidden sm:block font-medium">{displayName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-stone-400 hover:text-red-400 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Top Navigation for Desktop */}
      <nav className="bg-white border-b border-stone-200 px-4 lg:px-6 hidden md:flex items-center gap-1 overflow-x-auto shrink-0 shadow-sm">
        {tabs.map(t => {
          const Icon = t.icon
          const active = isActive(t)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-amber-600 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          )
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around md:hidden z-40 shadow-lg py-1 px-2 shrink-0">
        {tabs
          .filter(t => ['/portal/reseller', '/portal/reseller/catalog', '/portal/reseller/orders', '/portal/reseller/theme', '/portal/reseller/marketing'].includes(t.href))
          .map(t => {
            const Icon = t.icon
            const active = isActive(t)
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-bold transition-colors',
                  active ? 'text-amber-600' : 'text-stone-400 hover:text-stone-700'
                )}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="truncate max-w-[64px]">{t.label}</span>
              </Link>
            )
          })}
      </nav>
    </div>
  )
}
