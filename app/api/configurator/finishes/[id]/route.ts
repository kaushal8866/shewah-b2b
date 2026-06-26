import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/finishes/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: finish, error: finishError } = await supabaseAdmin
      .from('cfg_finishes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (finishError) throw finishError
    if (!finish) return NextResponse.json({ error: 'Finish not found' }, { status: 404 })

    const { data: compat, error: compatError } = await supabaseAdmin
      .from('cfg_finish_metal_compat')
      .select('*')
      .eq('finish_id', id)

    if (compatError) throw compatError

    return NextResponse.json({
      finish: {
        ...finish,
        compatibilities: compat || []
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/finishes/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { name, description, swatch_url, labour_surcharge_percent, sort_order, is_active, compatibilities } = body

    // 1. Update finish
    const { data: finish, error: finishError } = await supabaseAdmin
      .from('cfg_finishes')
      .update({
        name,
        description,
        swatch_url,
        labour_surcharge_percent: labour_surcharge_percent !== undefined ? Number(labour_surcharge_percent) : 0,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (finishError) throw finishError

    // 2. Reconcile compatibility mapping
    let finalCompat = []
    if (compatibilities && Array.isArray(compatibilities)) {
      // Clear current compatibilities
      const { error: deleteError } = await supabaseAdmin
        .from('cfg_finish_metal_compat')
        .delete()
        .eq('finish_id', id)

      if (deleteError) throw deleteError

      // Insert new
      if (compatibilities.length > 0) {
        const compatRows = compatibilities.map((c: any) => ({
          finish_id: id,
          metal_id: c.metal_id,
          karat: c.karat ? Number(c.karat) : null
        }))

        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('cfg_finish_metal_compat')
          .insert(compatRows)
          .select('*')

        if (insertError) throw insertError
        finalCompat = insertedData || []
      }
    } else {
      const { data: existingCompat } = await supabaseAdmin
        .from('cfg_finish_metal_compat')
        .select('*')
        .eq('finish_id', id)
      finalCompat = existingCompat || []
    }

    return NextResponse.json({
      finish: {
        ...finish,
        compatibilities: finalCompat
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/finishes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_finishes')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
