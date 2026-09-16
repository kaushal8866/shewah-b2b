'use client'

import React from 'react'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'
import CartDrawer from './CartDrawer'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FBF7F0] text-[#2A241B] font-sans selection:bg-[#E8D6AC]">
      <StoreHeader />
      <main className="flex-1">
        {children}
      </main>
      <StoreFooter />
      <CartDrawer />
    </div>
  )
}
