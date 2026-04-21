import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireMaster() {
  const session = await getServerSession(authOptions)
  if (!session) return { error: 'Unauthorized', status: 401 as const }
  if (session.user?.role !== 'master') return { error: 'Master access required', status: 403 as const }
  return { ok: true as const }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireMaster()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  if (typeof body?.label === 'string' && body.label.trim()) update.label = body.label.trim()
  if (Number.isFinite(Number(body?.sort_order))) update.sort_order = Number(body.sort_order)
  if (typeof body?.active === 'boolean') update.active = body.active
  const { data, error } = await supabaseAdmin
    .from('diamond_color_buckets')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single()
  if (error && (error as any).code === '42P01') {
    return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ bucket: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireMaster()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { error } = await supabaseAdmin
    .from('diamond_color_buckets')
    .delete()
    .eq('id', params.id)
  if (error && (error as any).code === '42P01') {
    return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
