import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/addons/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: addon, error } = await supabaseAdmin
      .from('cfg_product_addons')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!addon) return NextResponse.json({ error: 'Addon not found' }, { status: 404 })

    return NextResponse.json({ addon })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/addons/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { name, addon_type, pricing_type, price, description, max_characters, font_options, sort_order, is_active } = body

    if (!name || !addon_type || !pricing_type || price === undefined) {
      return NextResponse.json({ error: 'Name, Addon Type, Pricing Type, and Price are required' }, { status: 400 })
    }

    const { data: addon, error } = await supabaseAdmin
      .from('cfg_product_addons')
      .update({
        name,
        addon_type,
        pricing_type,
        price: Number(price),
        description,
        max_characters: max_characters ? Number(max_characters) : null,
        font_options: font_options || null,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ addon })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/addons/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_product_addons')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
