/**
 * DELETE /api/orders/[id]/production-updates/[updateId]
 * Operator-only — removes a production update.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function DELETE(_: NextRequest, { params }: { params: { id: string; updateId: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { error } = await supabaseAdmin
    .from('production_updates')
    .delete()
    .eq('id', params.updateId)
    .eq('order_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; updateId: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const patch: any = {}
  if (typeof body.is_customer_visible === 'boolean') patch.is_customer_visible = body.is_customer_visible
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 140)
  if (typeof body.body === 'string') patch.body = body.body.trim() || null
  if (typeof body.photo_url === 'string') patch.photo_url = body.photo_url.trim() || null
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'no writable fields' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('production_updates')
    .update(patch)
    .eq('id', params.updateId)
    .eq('order_id', params.id)
    .select('id, title, body, photo_url, is_customer_visible, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ update: data })
}
