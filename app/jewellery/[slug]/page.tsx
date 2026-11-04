import React from 'react'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchProductDetail } from '@/lib/d2cProductDetail'
import ProductDetailClient from '@/components/d2c/ProductDetailClient'
import type { MarketCode } from '@/lib/markets'

interface ProductPageProps {
  params: {
    slug: string
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const rawSlug = params.slug || ''
  const cookieStore = cookies()
  const marketCookie = (cookieStore.get('shewah_market')?.value || 'US').toUpperCase() as MarketCode

  const session = await getServerSession(authOptions).catch(() => null)
  const isTradeSession = Boolean(session?.user)

  const product = await fetchProductDetail(rawSlug, marketCookie, isTradeSession)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient initialProduct={product} />
}
