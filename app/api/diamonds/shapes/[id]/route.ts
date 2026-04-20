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
  if (typeof body.name === 'string') {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ error: 'Name cannot be blank' }, { status: 400 })
    patch.name = n
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
    .from('diamond_shapes').update(patch).eq('id', params.id).select('*').single()
  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Another shape already uses that name.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ shape: data })
}

// Hard delete only when nothing depends on the shape — otherwise the
// admin should toggle `active=false`. The FK from stock_movements is
// ON DELETE SET NULL, so the cascade would silently orphan diamond
// rows; we'd rather force the operator to make the call.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await gateMaster(); if (g.err) return g.err
  const { count: usedInMovements } = await supabaseAdmin
    .from('stock_movements')
    .select('id', { head: true, count: 'exact' })
    .eq('diamond_shape_id', params.id)
  if ((usedInMovements || 0) > 0) {
    return NextResponse.json({
      error: 'This shape is referenced by stock movements. Mark it inactive instead.',
    }, { status: 409 })
  }
  const { error } = await supabaseAdmin.from('diamond_shapes').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
