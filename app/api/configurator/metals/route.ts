import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/metals
// Fetch all metal options and their associated karat grades
export async function GET() {
  try {
    const { data: metals, error: metalsError } = await supabaseAdmin
      .from('cfg_metals')
      .select('*')
      .order('sort_order', { ascending: true })

    if (metalsError) throw metalsError

    const { data: karats, error: karatsError } = await supabaseAdmin
      .from('cfg_karats')
      .select('*')
      .order('sort_order', { ascending: true })

    if (karatsError) throw karatsError

    // Group karats by metal_id
    const metalsWithKarats = (metals || []).map(metal => ({
      ...metal,
      karats: (karats || []).filter(k => k.metal_id === metal.id)
    }))

    return NextResponse.json({ metals: metalsWithKarats })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/metals
// Create a new metal option along with optional karat grades
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, metal_type, color_hex, color_name, alloy_notes, sort_order, is_active, karats } = body

    if (!name || !metal_type) {
      return NextResponse.json({ error: 'Name and Metal Type are required' }, { status: 400 })
    }

    // Insert metal
    const { data: metal, error: metalError } = await supabaseAdmin
      .from('cfg_metals')
      .insert([{
        name,
        metal_type,
        color_hex,
        color_name,
        alloy_notes,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (metalError) {
      if (metalError.code === '23505') {
        return NextResponse.json({ error: `Metal called "${name}" already exists.` }, { status: 409 })
      }
      throw metalError
    }

    // Insert associated karats if provided
    let insertedKarats = []
    if (karats && Array.isArray(karats) && karats.length > 0) {
      const karatRows = karats.map((k: any) => ({
        metal_id: metal.id,
        karat: Number(k.karat),
        karat_label: k.karat_label,
        purity_factor: Number(k.purity_factor),
        sort_order: k.sort_order !== undefined ? Number(k.sort_order) : 100,
        is_active: k.is_active !== false
      }))

      const { data: karatData, error: karatError } = await supabaseAdmin
        .from('cfg_karats')
        .insert(karatRows)
        .select('*')

      if (karatError) throw karatError
      insertedKarats = karatData || []
    }

    return NextResponse.json({
      metal: {
        ...metal,
        karats: insertedKarats
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
