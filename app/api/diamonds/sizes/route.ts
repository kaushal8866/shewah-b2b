import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const shape_id = url.searchParams.get('shape_id')
  let q = supabaseAdmin
    .from('diamond_sizes')
    .select('*')
    .order('sort_order')
    .order('label')
  if (shape_id) q = q.eq('shape_id', shape_id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sizes: data || [] })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const shape_id = String(body?.shape_id || '').trim()
  const label = String(body?.label || '').trim()
  if (!shape_id) return NextResponse.json({ error: 'shape_id is required' }, { status: 400 })
  if (!label)    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  const approx = body?.approx_carats != null && body.approx_carats !== '' ? Number(body.approx_carats) : null
  const reorder = body?.reorder_threshold_pieces != null && body.reorder_threshold_pieces !== ''
    ? Number(body.reorder_threshold_pieces) : null
  const sort_order = Number(body?.sort_order)
  const { data, error } = await supabaseAdmin
    .from('diamond_sizes')
    .insert([{
      shape_id, label,
      approx_carats: approx,
      reorder_threshold_pieces: reorder,
      sort_order: Number.isFinite(sort_order) ? sort_order : 100,
      active: body?.active !== false,
    }])
    .select('*')
    .single()
  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: `Size "${label}" already exists for this shape.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ size: data })
}
