import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface JewelleryPieceLayoutProps {
  children: React.ReactNode
  params: { slug: string }
}

async function resolveProductBySlugOrCode(rawSlugInput: string) {
  const rawSlug = (rawSlugInput || '').toLowerCase().trim()
  if (!rawSlug) return null

  try {
    let { data: product } = await supabaseAdmin
      .from('products')
      .select('id, code, name, slug, d2c_title, d2c_subtitle, d2c_description, photo_urls, is_active, d2c_status')
      .or(`slug.eq.${rawSlug},code.ilike.${rawSlug}`)
      .eq('is_active', true)
      .eq('d2c_status', 'published')
      .maybeSingle()

    if (!product) {
      const { data: redirectRow } = await supabaseAdmin
        .from('product_slug_redirects')
        .select('product_id')
        .eq('old_slug', rawSlug)
        .maybeSingle()

      if (redirectRow?.product_id) {
        const { data: redirectedProd } = await supabaseAdmin
          .from('products')
          .select('id, code, name, slug, d2c_title, d2c_subtitle, d2c_description, photo_urls, is_active, d2c_status')
          .eq('id', redirectRow.product_id)
          .eq('is_active', true)
          .eq('d2c_status', 'published')
          .maybeSingle()
        product = redirectedProd
      }
    }

    return product
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const rawSlug = (params.slug || '').toLowerCase().trim()
  const product = await resolveProductBySlugOrCode(rawSlug)

  if (!product) {
    return {
      title: 'Fine Jewellery Piece',
      robots: { index: false, follow: true },
    }
  }

  const canonicalSlug = (product.slug || product.code.toLowerCase()).trim()
  const canonicalUrl = `https://shewah.co/jewellery/${canonicalSlug}`
  const title = product.d2c_title || product.name
  const description =
    product.d2c_description ||
    product.d2c_subtitle ||
    `${title} handcrafted to order in solid 18K gold and set with certified diamonds at Shewah Atelier.`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} | SHEWAH`,
      description,
      url: canonicalUrl,
      siteName: 'SHEWAH',
      type: 'website',
    },
  }
}

export default async function JewelleryPieceLayout({
  children,
  params,
}: JewelleryPieceLayoutProps) {
  const rawSlug = (params.slug || '').toLowerCase().trim()
  const product = await resolveProductBySlugOrCode(rawSlug)

  if (product?.slug && rawSlug !== product.slug.toLowerCase().trim()) {
    permanentRedirect(`/jewellery/${product.slug.toLowerCase().trim()}`)
  }

  return <>{children}</>
}
