import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/finishes
export async function GET() {
  try {
    const { data: finishes, error: finishesError } = await supabaseAdmin
      .from('cfg_finishes')
      .select('*')
      .order('sort_order', { ascending: true })

    if (finishesError) throw finishesError

    const { data: compat, error: compatError } = await supabaseAdmin
      .from('cfg_finish_metal_compat')
      .select('*')

    if (compatError) throw compatError

    // Group compatibility by finish_id
    const finishesWithCompat = (finishes || []).map(finish => ({
      ...finish,
      compatibilities: (compat || []).filter(c => c.finish_id === finish.id)
    }))

    return NextResponse.json({ finishes: finishesWithCompat })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/finishes
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, swatch_url, labour_surcharge_percent, sort_order, is_active, compatibilities } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: finish, error: finishError } = await supabaseAdmin
      .from('cfg_finishes')
      .insert([{
        name,
        description,
        swatch_url,
        labour_surcharge_percent: labour_surcharge_percent !== undefined ? Number(labour_surcharge_percent) : 0,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (finishError) {
      if (finishError.code === '23505') {
        return NextResponse.json({ error: `Finish called "${name}" already exists.` }, { status: 409 })
      }
      throw finishError
    }

    let insertedCompat = []
    if (compatibilities && Array.isArray(compatibilities) && compatibilities.length > 0) {
      const compatRows = compatibilities.map((c: any) => ({
        finish_id: finish.id,
        metal_id: c.metal_id,
        karat: c.karat ? Number(c.karat) : null
      }))

      const { data: compatData, error: compatError } = await supabaseAdmin
        .from('cfg_finish_metal_compat')
        .insert(compatRows)
        .select('*')

      if (compatError) throw compatError
      insertedCompat = compatData || []
    }

    return NextResponse.json({
      finish: {
        ...finish,
        compatibilities: insertedCompat
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
