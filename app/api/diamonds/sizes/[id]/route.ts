import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function gateMaster() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.user?.role !== 'master') {
    return { err: NextResponse.json({ error: 'Master access required' }, { status: 403 }) }
  }
  return { err: null }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await gateMaster(); if (g.err) return g.err
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof body.label === 'string') {
    const n = body.label.trim()
    if (!n) return NextResponse.json({ error: 'Label cannot be blank' }, { status: 400 })
    patch.label = n
  }
  if (typeof body.approx_carats !== 'undefined') {
    if (body.approx_carats === '' || body.approx_carats === null) patch.approx_carats = null
    else {
      const n = Number(body.approx_carats)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'approx_carats must be a positive number' }, { status: 400 })
      }
      patch.approx_carats = n
    }
  }
  if (typeof body.reorder_threshold_pieces !== 'undefined') {
    if (body.reorder_threshold_pieces === '' || body.reorder_threshold_pieces === null) {
      patch.reorder_threshold_pieces = null
    } else {
      const n = Number(body.reorder_threshold_pieces)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: 'reorder_threshold_pieces must be a non-negative integer' }, { status: 400 })
      }
      patch.reorder_threshold_pieces = n
    }
  }
  if (typeof body.sort_order !== 'undefined') {
    const n = Number(body.sort_order)
    if (Number.isFinite(n)) patch.sort_order = n
  }
  if (typeof body.active === 'boolean') patch.active = body.active
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('diamond_sizes').update(patch).eq('id', params.id).select('*').single()
  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Another size already uses that label for this shape.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ size: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await gateMaster(); if (g.err) return g.err
  const { count: used } = await supabaseAdmin
    .from('stock_movements')
    .select('id', { head: true, count: 'exact' })
    .eq('diamond_size_id', params.id)
  if ((used || 0) > 0) {
    return NextResponse.json({
      error: 'This size is referenced by stock movements. Mark it inactive instead.',
    }, { status: 409 })
  }
  const { error } = await supabaseAdmin.from('diamond_sizes').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
