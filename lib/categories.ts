import { supabaseAdmin } from './supabaseAdmin'

export interface D2CCategoryConfig {
  key: string
  label: string
  shortLabel?: string
  href: string
  subtitle?: string
  image?: string
}

export interface D2CCategoryItem extends D2CCategoryConfig {
  count: number
}

export const KNOWN_CATEGORIES: Record<string, D2CCategoryConfig> = {
  rings: {
    key: 'rings',
    label: 'Rings & Bands',
    shortLabel: 'Rings',
    href: '/jewellery?category=rings',
    subtitle: 'Antwerp-Cut Solitaires in Solid 18K Gold',
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80',
  },
  necklaces: {
    key: 'necklaces',
    label: 'Necklaces & Pendants',
    shortLabel: 'Necklaces',
    href: '/jewellery?category=necklaces',
    subtitle: 'Timeless Cascades & Minimalist Icons',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
  },
  earrings: {
    key: 'earrings',
    label: 'Diamond Earrings',
    shortLabel: 'Earrings',
    href: '/jewellery?category=earrings',
    subtitle: 'Studs, Huggies & Architectural Drops',
    image: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80',
  },
  bracelets: {
    key: 'bracelets',
    label: 'Tennis Bracelets',
    shortLabel: 'Bracelets',
    href: '/jewellery?category=bracelets',
    subtitle: 'Seamless Pavé & Bezel Settings',
    image: 'https://images.unsplash.com/photo-1611591475870-760a927a4e69?auto=format&fit=crop&w=800&q=80',
  },
  mens: {
    key: 'mens',
    label: 'Men’s Heritage',
    shortLabel: 'Men’s',
    href: '/jewellery?category=mens',
    subtitle: 'Signet Rings & Bespoke Cufflinks',
    image: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=80',
  },
}

export const PREFERRED_CATEGORY_ORDER = ['rings', 'necklaces', 'earrings', 'bracelets', 'mens']

/**
 * Fallback active categories with verified live inventory, used for instant client-side rendering
 * and network resilience. Only includes non-empty categories.
 */
export const DEFAULT_NON_EMPTY_CATEGORIES: D2CCategoryItem[] = [
  { ...KNOWN_CATEGORIES.rings, count: 2 },
  { ...KNOWN_CATEGORIES.necklaces, count: 5 },
  { ...KNOWN_CATEGORIES.earrings, count: 2 },
]

/**
 * Filter and format category records based on inventory counts.
 * Strictly omits any categories that have 0 items.
 */
export function filterNonEmptyCategories(counts: Record<string, number>): D2CCategoryItem[] {
  const result: D2CCategoryItem[] = []

  for (const key of PREFERRED_CATEGORY_ORDER) {
    const count = counts[key] || 0
    if (count > 0) {
      result.push({
        ...KNOWN_CATEGORIES[key],
        count,
      })
    }
  }

  // Include any other non-standard category with published products
  for (const [key, count] of Object.entries(counts)) {
    if (!PREFERRED_CATEGORY_ORDER.includes(key) && count > 0) {
      result.push({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        shortLabel: key.charAt(0).toUpperCase() + key.slice(1),
        href: `/jewellery?category=${encodeURIComponent(key)}`,
        count,
      })
    }
  }

  return result
}

/**
 * Fetch all categories that currently have at least one active, published piece in the atelier database.
 * Any category with 0 items is automatically omitted.
 */
export async function fetchNonEmptyD2CCategories(): Promise<D2CCategoryItem[]> {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('category, d2c_details')
      .eq('is_active', true)
      .eq('d2c_status', 'published')

    if (error || !products) {
      console.warn('[fetchNonEmptyD2CCategories] Database query failed, using safe fallback:', error?.message)
      return DEFAULT_NON_EMPTY_CATEGORIES
    }

    const counts: Record<string, number> = {}
    for (const p of products) {
      const cat = (p.category || '').toLowerCase().trim()
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    }

    const filtered = filterNonEmptyCategories(counts)
    return filtered.length > 0 ? filtered : DEFAULT_NON_EMPTY_CATEGORIES
  } catch (err) {
    console.error('[fetchNonEmptyD2CCategories] Unexpected error:', err)
    return DEFAULT_NON_EMPTY_CATEGORIES
  }
}
