import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/stones/prices/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: price, error } = await supabaseAdmin
      .from('cfg_stone_prices')
      .select(`
        *,
        stone_type:cfg_stone_types(id, name, category),
        shape:diamond_shapes(id, name),
        size:diamond_sizes(id, label, approx_carats),
        clarity:cfg_stone_clarity_grades(id, code, label),
        color:cfg_stone_color_grades(id, code, label)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!price) return NextResponse.json({ error: 'Stone price entry not found' }, { status: 404 })

    return NextResponse.json({ price })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/stones/prices/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { price_per_piece, is_available, lead_time_days } = body

    if (price_per_piece === undefined) {
      return NextResponse.json({ error: 'price_per_piece is required' }, { status: 400 })
    }

    const { data: price, error } = await supabaseAdmin
      .from('cfg_stone_prices')
      .update({
        price_per_piece: Number(price_per_piece),
        is_available: is_available !== false,
        lead_time_days: lead_time_days !== undefined && lead_time_days !== null ? Number(lead_time_days) : null,
        updated_by: session.user?.email || 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ price })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/stones/prices/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_stone_prices')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
