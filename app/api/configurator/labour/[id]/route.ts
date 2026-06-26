import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/labour/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: rate, error } = await supabaseAdmin
      .from('cfg_labour_rates')
      .select(`
        *,
        metal:cfg_metals(id, name, metal_type),
        finish:cfg_finishes(id, name)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!rate) return NextResponse.json({ error: 'Labour rate not found' }, { status: 404 })

    return NextResponse.json({ rate })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/labour/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { rate_per_gram, karat, finish_id, category } = body

    if (rate_per_gram === undefined) {
      return NextResponse.json({ error: 'rate_per_gram is required' }, { status: 400 })
    }

    const { data: rate, error } = await supabaseAdmin
      .from('cfg_labour_rates')
      .update({
        rate_per_gram: Number(rate_per_gram),
        karat: karat ? Number(karat) : null,
        finish_id: finish_id || null,
        category: category || null,
        updated_by: session.user?.email || 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ rate })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/labour/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_labour_rates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
