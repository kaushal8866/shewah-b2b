import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/product-config/[productId]
// Fetch the product configuration details
export async function GET(_req: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const { productId } = params
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('id, name, code, category, is_configurable, canonical_weight_g, dimension_constraints, configurator_options, variant_images, setting_types')
      .eq('id', productId)
      .maybeSingle()

    if (error) throw error
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    return NextResponse.json({ product })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/product-config/[productId]
// Update the configurator mappings for the product
export async function PUT(req: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = params
    const body = await req.json()
    const {
      is_configurable,
      canonical_weight_g,
      dimension_constraints,
      configurator_options,
      variant_images,
      setting_types
    } = body

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update({
        is_configurable: is_configurable === true,
        canonical_weight_g: canonical_weight_g !== undefined && canonical_weight_g !== null ? Number(canonical_weight_g) : null,
        dimension_constraints: dimension_constraints || null,
        configurator_options: configurator_options || null,
        variant_images: variant_images || {},
        setting_types: setting_types || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select('id, name, code, is_configurable, canonical_weight_g, dimension_constraints, configurator_options, variant_images, setting_types')
      .single()

    if (error) throw error

    return NextResponse.json({ product })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
