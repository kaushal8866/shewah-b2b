import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('diamond_color_buckets')
    .select('*')
    .order('sort_order')
    .order('label')
  if (error && (error as any).code === '42P01') {
    return NextResponse.json({ buckets: [], migration_pending: true })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ buckets: data || [] })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const label = String(body?.label || '').trim()
  if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  const sort_order = Number(body?.sort_order)
  const { data, error } = await supabaseAdmin
    .from('diamond_color_buckets')
    .insert([{
      label,
      sort_order: Number.isFinite(sort_order) ? sort_order : 100,
      active: body?.active !== false,
    }])
    .select('*')
    .single()
  if (error) {
    if ((error as any).code === '42P01') {
      return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
    }
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: `A color bucket called "${label}" already exists.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ bucket: data })
}
