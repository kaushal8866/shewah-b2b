'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Diamond, LogOut, Factory } from 'lucide-react'

export default function ManufacturerPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const displayName = session?.user?.displayName || session?.user?.username || '...'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-[#1A1F2E] text-white px-4 lg:px-6 py-3 flex items-center justify-between shrink-0">
        <Link href="/portal/manufacturer" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
            <Diamond className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Shewah</p>
            <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
              <Factory className="w-3 h-3" /> Manufacturer Portal
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
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
