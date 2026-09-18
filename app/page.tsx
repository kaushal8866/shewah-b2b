import React from 'react'
import StoreLayout from '@/components/d2c/StoreLayout'
import HeroSection from '@/components/d2c/HeroSection'
import CategoryDiscovery from '@/components/d2c/CategoryDiscovery'
import SignatureCollections from '@/components/d2c/SignatureCollections'
import CollectionFeature from '@/components/d2c/CollectionFeature'
import StyleDiscovery from '@/components/d2c/StyleDiscovery'
import WhyShewah from '@/components/d2c/WhyShewah'
import BespokeSection from '@/components/d2c/BespokeSection'
import DiamondDiscovery from '@/components/d2c/DiamondDiscovery'
import CraftsmanshipSection from '@/components/d2c/CraftsmanshipSection'
import Testimonials from '@/components/d2c/Testimonials'
import ServiceBanner from '@/components/d2c/ServiceBanner'
import OriginStory from '@/components/d2c/OriginStory'
import ConsultationCTA from '@/components/d2c/ConsultationCTA'
import EducationSection from '@/components/d2c/EducationSection'
import FAQSection from '@/components/d2c/FAQSection'
import SEOContent from '@/components/d2c/SEOContent'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveProductMarketPrice } from '@/lib/d2cPricing'
import { fetchNonEmptyD2CCategories } from '@/lib/categories'
import { type ProductCardProps } from '@/components/d2c/ProductCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
  description:
    'Handcrafted fine diamond jewellery cast individually in solid 18K gold. Antwerp & Surat certified natural and lab-grown diamonds, bespoke engagement rings, and high jewellery suites with worldwide insured armored delivery.',
  openGraph: {
    title: 'SHEWAH | High Jewellery Atelier & Certified Diamonds',
    description:
      'Handcrafted fine diamond jewellery cast individually in solid 18K gold and set with certified diamonds.',
    type: 'website',
  },
}

export default async function HomePage() {
  // 1. Fetch live non-empty categories (never show 0-count categories)
  const activeCategories = await fetchNonEmptyD2CCategories()

  // 2. Fetch active published products for signature merchandising
  let productsForRail: ProductCardProps[] = []
  try {
    const { data: rawProducts, error } = await supabaseAdmin
      .from('products')
      .select(
        'id, code, name, slug, category, photo_urls, d2c_status, d2c_featured, d2c_title, d2c_subtitle, d2c_crafting_lead_days, return_policy_type, return_window_days, return_eligible, diamond_shape, diamond_type, gold_karat, metal_type, d2c_details, is_active'
      )
      .eq('is_active', true)
      .eq('d2c_status', 'published')
      .order('name', { ascending: true })

    if (!error && rawProducts) {
      // Show standalone creations and top-level suites (avoid duplicates from components of sets)
      const visible = rawProducts.filter(
        (p) => !(p.d2c_details as any)?.is_component_of_set
      )

      productsForRail = await Promise.all(
        visible.map(async (p) => {
          const pricing = await resolveProductMarketPrice(p.id, 'US')
          const details = (p.d2c_details || {}) as Record<string, any>
          return {
            id: p.id,
            code: p.code,
            name: p.d2c_title || p.name,
            slug: p.slug || p.code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            subtitle: p.d2c_subtitle || '',
            category: p.category,
            primaryPhotoUrl: p.photo_urls?.[0] || null,
            secondaryPhotoUrl: p.photo_urls?.[1] || p.photo_urls?.[0] || null,
            craftingLeadDays: p.d2c_crafting_lead_days || 14,
            isFeatured: p.d2c_featured || false,
            isSet: Boolean(details.is_set),
            setLabel: details.is_set
              ? 'Complete Suite • Available Together or Separately'
              : null,
            price: {
              amount: pricing.unitPrice,
              compareAt: pricing.compareAtPrice,
              currency: pricing.currency,
              formatted: pricing.formattedPrice,
              taxLabel: pricing.taxLabel,
              isAvailable: pricing.isAvailable,
            },
          }
        })
      )
    }
  } catch (err) {
    console.error('[HomePage] Error loading products:', err)
  }

  return (
    <StoreLayout>
      {/* 1. Cinematic Hero Section with Luxury Typography & Dual CTAs */}
      <HeroSection />

      {/* 2. Visual Category Discovery (Dynamic Non-Empty Categories Only) */}
      <CategoryDiscovery categories={activeCategories} />

      {/* 3. Signature Merchandising Tabs (Real Live Products with Multi-Market Pricing) */}
      {productsForRail.length > 0 && (
        <SignatureCollections products={productsForRail} />
      )}

      {/* 4. High Jewellery Spotlight Parure: The Royal Heritage Suite */}
      <CollectionFeature />

      {/* 5. Shop by Design Aesthetics & Style */}
      <StyleDiscovery />

      {/* 6. Why Shewah: 5 Verifiable Trust Pillars */}
      <WhyShewah />

      {/* 7. Bespoke Atelier Workflow (4-Step Made-to-Order Process) */}
      <BespokeSection />

      {/* 8. Diamond Provenance, 4Cs Education & Silhouette Discovery */}
      <DiamondDiscovery />

      {/* 9. Surat Master Karigar Craftsmanship & Solid 18K Gold Metallurgy */}
      <CraftsmanshipSection />

      {/* 10. Verified Private Client Testimonials & Heirloom Commissions */}
      <Testimonials />

      {/* 11. Private Atelier Concierge & Consultation Action Banner */}
      <ServiceBanner />

      {/* 12. "From Antwerp & Surat to the World" Brand Provenance Story */}
      <OriginStory />

      {/* 13. High-Conversion Dedicated Consultation Booking Module */}
      <ConsultationCTA />

      {/* 14. Collector's Education Cards (Ring Sizer, 4Cs, 18K Gold, Warranty) */}
      <EducationSection />

      {/* 15. Frequently Addressed Buyer Questions + Structured FAQPage JSON-LD */}
      <FAQSection />

      {/* 16. Semantic Editorial Content & Structured Organization Schema */}
      <SEOContent />
    </StoreLayout>
  )
}
