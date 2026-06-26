import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/addons
export async function GET() {
  try {
    const { data: addons, error } = await supabaseAdmin
      .from('cfg_product_addons')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ addons: addons || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/addons
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, addon_type, pricing_type, price, description, max_characters, font_options, sort_order, is_active } = body

    if (!name || !addon_type || !pricing_type || price === undefined) {
      return NextResponse.json({ error: 'Name, Addon Type, Pricing Type, and Price are required' }, { status: 400 })
    }

    const { data: addon, error } = await supabaseAdmin
      .from('cfg_product_addons')
      .insert([{
        name,
        addon_type,
        pricing_type,
        price: Number(price),
        description,
        max_characters: max_characters ? Number(max_characters) : null,
        font_options: font_options || null,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ addon })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
