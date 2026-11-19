import React from 'react'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import StoreLayout from '@/components/d2c/StoreLayout'
import JewelleryCatalogClient from '@/components/d2c/JewelleryCatalogClient'
import { getD2CCatalog } from '@/lib/d2cCatalog'
import { Diamond } from 'lucide-react'
import type { MarketCode } from '@/lib/markets'

export const dynamic = 'force-dynamic'

interface JewelleryPageProps {
  searchParams: {
    [key: string]: string | string[] | undefined
  }
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function JewelleryCatalogPage({ searchParams }: JewelleryPageProps) {
  const cookieStore = cookies()
  const marketCookie = (cookieStore.get('shewah_market')?.value || 'US').toUpperCase() as MarketCode

  const session = await getServerSession(authOptions).catch(() => null)

  const catalog = await getD2CCatalog({
    market: marketCookie,
    category: firstParam(searchParams.category),
    shape: firstParam(searchParams.shape),
    diamondType: firstParam(searchParams.diamondType),
    style: firstParam(searchParams.style),
    search: firstParam(searchParams.q),
    isTradeSession: Boolean(session?.user),
  }).catch((err) => {
    console.error('[JewelleryCatalogPage] SSR catalog error:', err)
    return null
  })

  return (
    <StoreLayout>
      <React.Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex items-center justify-center">
            <Diamond className="w-8 h-8 text-[#A88A4F] animate-pulse" />
          </div>
        }
      >
        <JewelleryCatalogClient
          initialProducts={catalog?.products ?? []}
          initialCategories={catalog?.categories ?? null}
        />
      </React.Suspense>
    </StoreLayout>
  )
}
