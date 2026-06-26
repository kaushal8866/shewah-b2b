import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/stones/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: stoneType, error } = await supabaseAdmin
      .from('cfg_stone_types')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!stoneType) return NextResponse.json({ error: 'Stone type not found' }, { status: 404 })

    return NextResponse.json({ stoneType })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/stones/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { name, category, default_cert_body, sort_order, is_active } = body

    const { data: stoneType, error } = await supabaseAdmin
      .from('cfg_stone_types')
      .update({
        name,
        category,
        default_cert_body,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ stoneType })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/stones/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_stone_types')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
