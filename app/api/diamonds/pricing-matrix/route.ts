import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET — list every matrix cell. Optional filters: ?shape_id=&size_id=&type=
// Authenticated read so the catalog form and the retailer comparison quote
// can show suggested prices.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const shapeId = searchParams.get('shape_id')
  const sizeId  = searchParams.get('size_id')
  const type    = searchParams.get('type')

  let q = supabaseAdmin
    .from('diamond_price_matrix')
    .select('id, shape_id, size_id, quality_bucket_id, color_bucket_id, type, price_per_piece, updated_by, updated_at')
  if (shapeId) q = q.eq('shape_id', shapeId)
  if (sizeId)  q = q.eq('size_id', sizeId)
  if (type)    q = q.eq('type', type)

  const { data, error } = await q
  if (error && (error as any).code === '42P01') {
    return NextResponse.json({ cells: [], migration_pending: true })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cells: data || [] })
}

// PUT — upsert one cell. Body: {shape_id,size_id,quality_bucket_id,color_bucket_id,type?,price_per_piece}
// Sending price_per_piece <= 0 deletes the cell instead (clears the price).
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const shape_id = String(body?.shape_id || '')
  const size_id  = String(body?.size_id  || '')
  const quality_bucket_id = String(body?.quality_bucket_id || '')
  const color_bucket_id   = String(body?.color_bucket_id   || '')
  const type = body?.type === 'natural' ? 'natural' : 'lgd'
  const price = Number(body?.price_per_piece)
  if (!shape_id || !size_id || !quality_bucket_id || !color_bucket_id) {
    return NextResponse.json({ error: 'shape_id, size_id, quality_bucket_id, color_bucket_id are required' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'price_per_piece must be a non-negative number' }, { status: 400 })
  }

  // 0 (or empty) clears the cell so the team can blank rates they no longer
  // want suggesting.
  if (price === 0) {
    const { error } = await supabaseAdmin
      .from('diamond_price_matrix')
      .delete()
      .eq('shape_id', shape_id)
      .eq('size_id', size_id)
      .eq('quality_bucket_id', quality_bucket_id)
      .eq('color_bucket_id', color_bucket_id)
      .eq('type', type)
    if (error && (error as any).code === '42P01') {
      return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ cleared: true })
  }

  const updated_by = session.user?.username || session.user?.id || null
  const { data, error } = await supabaseAdmin
    .from('diamond_price_matrix')
    .upsert(
      [{
        shape_id, size_id, quality_bucket_id, color_bucket_id, type,
        price_per_piece: price,
        updated_by,
        updated_at: new Date().toISOString(),
      }],
      { onConflict: 'shape_id,size_id,quality_bucket_id,color_bucket_id,type' },
    )
    .select('*')
    .single()
  if (error && (error as any).code === '42P01') {
    return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ cell: data })
}
