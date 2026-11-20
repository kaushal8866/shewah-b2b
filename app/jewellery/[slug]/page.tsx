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

  const productSlug = product.slug || rawSlug
  // Emit only the metal recorded on this product. configurationSchema.metals falls back to
  // generic UI defaults (incl. 950 Platinum) when a record is thin, so it is not used here.
  const specMetalType = (product.specifications?.metalType || '').toLowerCase()
  const specKaratLabel = product.specifications?.karatLabel || null
  const recordedMetal = specMetalType === 'silver'
    ? '925 Sterling Silver'
    : specMetalType === 'gold' && specKaratLabel
      ? specKaratLabel + ' Gold'
      : null
  const productJsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: { '@type': 'Brand', name: 'Shewah' },
    url: `https://shewah.co/jewellery/${productSlug}`,
    sku: product.code,
  }
  if (product.description) {
    productJsonLd.description = product.description
  }
  if (Array.isArray(product.photoUrls) && product.photoUrls.length > 0) {
    productJsonLd.image = product.photoUrls
  }
  if (recordedMetal) {
    productJsonLd.material = recordedMetal
  }
  if (product.category) {
    productJsonLd.category = product.category
  }
  // Price-on-request catalogue: no `offers` property is emitted without a public price.
  const productJsonLdHtml = JSON.stringify(productJsonLd).replace(/</g, '\\u003c')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLdHtml }} />
      <ProductDetailClient initialProduct={product} />
    </>
  )
}
