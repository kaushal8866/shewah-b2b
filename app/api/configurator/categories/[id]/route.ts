import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/categories/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: option, error } = await supabaseAdmin
      .from('cfg_category_options')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 })

    return NextResponse.json({ option })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const {
      category,
      option_key,
      option_label,
      option_type,
      options,
      default_value,
      min_value,
      max_value,
      unit,
      is_required,
      sort_order
    } = body

    const { data: option, error } = await supabaseAdmin
      .from('cfg_category_options')
      .update({
        category,
        option_key,
        option_label,
        option_type,
        options: options || null,
        default_value,
        min_value: min_value !== undefined && min_value !== null ? Number(min_value) : null,
        max_value: max_value !== undefined && max_value !== null ? Number(max_value) : null,
        unit,
        is_required: is_required === true,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ option })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/categories/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_category_options')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
