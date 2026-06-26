import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/metals/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: metal, error: metalError } = await supabaseAdmin
      .from('cfg_metals')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (metalError) throw metalError
    if (!metal) return NextResponse.json({ error: 'Metal not found' }, { status: 404 })

    const { data: karats, error: karatsError } = await supabaseAdmin
      .from('cfg_karats')
      .select('*')
      .eq('metal_id', id)
      .order('sort_order', { ascending: true })

    if (karatsError) throw karatsError

    return NextResponse.json({
      metal: {
        ...metal,
        karats: karats || []
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/metals/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { name, metal_type, color_hex, color_name, alloy_notes, sort_order, is_active, karats } = body

    // 1. Update metal
    const { data: metal, error: metalError } = await supabaseAdmin
      .from('cfg_metals')
      .update({
        name,
        metal_type,
        color_hex,
        color_name,
        alloy_notes,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (metalError) throw metalError

    // 2. Reconcile karats if provided
    let finalKarats = []
    if (karats && Array.isArray(karats)) {
      // Get current karats in DB
      const { data: currentKarats, error: getKaratsError } = await supabaseAdmin
        .from('cfg_karats')
        .select('id')
        .eq('metal_id', id)

      if (getKaratsError) throw getKaratsError

      const currentIds = (currentKarats || []).map(k => k.id)
      const incomingIds = karats.filter(k => k.id).map(k => k.id)

      // Identify to delete
      const toDelete = currentIds.filter(cid => !incomingIds.includes(cid))

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('cfg_karats')
          .delete()
          .in('id', toDelete)
        if (deleteError) throw deleteError
      }

      // Upsert incoming
      const toUpsert = karats.map((k: any) => ({
        id: k.id || undefined,
        metal_id: id,
        karat: Number(k.karat),
        karat_label: k.karat_label,
        purity_factor: Number(k.purity_factor),
        sort_order: k.sort_order !== undefined ? Number(k.sort_order) : 100,
        is_active: k.is_active !== false
      }))

      const { data: upsertedData, error: upsertError } = await supabaseAdmin
        .from('cfg_karats')
        .upsert(toUpsert)
        .select('*')

      if (upsertError) throw upsertError
      finalKarats = upsertedData || []
    } else {
      // Return existing
      const { data: existingKarats } = await supabaseAdmin
        .from('cfg_karats')
        .select('*')
        .eq('metal_id', id)
        .order('sort_order', { ascending: true })
      finalKarats = existingKarats || []
    }

    return NextResponse.json({
      metal: {
        ...metal,
        karats: finalKarats
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/metals/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_metals')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
