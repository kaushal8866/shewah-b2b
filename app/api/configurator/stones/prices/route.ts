import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/stones/prices
// Retrieves stone prices, optionally filtered by stone_type_id, with joined metadata
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const stoneTypeId = searchParams.get('stone_type_id')

    let query = supabaseAdmin
      .from('cfg_stone_prices')
      .select(`
        *,
        stone_type:cfg_stone_types(id, name, category),
        shape:diamond_shapes(id, name),
        size:diamond_sizes(id, label, approx_carats),
        clarity:cfg_stone_clarity_grades(id, code, label),
        color:cfg_stone_color_grades(id, code, label)
      `)

    if (stoneTypeId) {
      query = query.eq('stone_type_id', stoneTypeId)
    }

    const { data: prices, error } = await query

    if (error) throw error

    return NextResponse.json({ prices: prices || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/stones/prices
// Creates or updates (upserts) stone prices. Supports both single objects and arrays for bulk updates.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const isArray = Array.isArray(body)
    const items = isArray ? body : [body]

    if (items.length === 0) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 })
    }

    // Validate fields
    for (const item of items) {
      if (!item.stone_type_id || !item.shape_id || !item.size_id || item.price_per_piece === undefined) {
        return NextResponse.json({
          error: 'stone_type_id, shape_id, size_id, and price_per_piece are required for all items'
        }, { status: 400 })
      }
    }

    // Prepare rows for upsert
    const rows = items.map((item: any) => ({
      id: item.id || undefined,
      stone_type_id: item.stone_type_id,
      shape_id: item.shape_id,
      size_id: item.size_id,
      clarity_grade_id: item.clarity_grade_id || null,
      color_grade_id: item.color_grade_id || null,
      price_per_piece: Number(item.price_per_piece),
      is_available: item.is_available !== false,
      lead_time_days: item.lead_time_days !== undefined && item.lead_time_days !== null ? Number(item.lead_time_days) : null,
      updated_by: session.user?.email || 'admin',
      updated_at: new Date().toISOString()
    }))

    const { data: upserted, error } = await supabaseAdmin
      .from('cfg_stone_prices')
      .upsert(rows)
      .select('*')

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: upserted?.length || 0,
      prices: isArray ? upserted : upserted?.[0]
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
