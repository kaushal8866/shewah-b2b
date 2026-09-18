'use client'

import React from 'react'
import StoreHeader from './StoreHeader'
import StoreFooter from './StoreFooter'
import CartDrawer from './CartDrawer'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4F2] text-[#051F34] font-sans selection:bg-[#CB9274]/20 selection:text-[#051F34]">
      <StoreHeader />
      <main className="flex-1">
        {children}
      </main>
      <StoreFooter />
      <CartDrawer />
    </div>
  )
}
