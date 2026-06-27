import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST — fill (or overwrite) every (shape, size) cell for a given
// (color, quality, type) combo using `approx_carats × rate_per_carat`.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const color_bucket_id = String(body?.color_bucket_id || '')
  const quality_bucket_id = String(body?.quality_bucket_id || '')
  const type = body?.type === 'natural' ? 'natural' : 'lgd'
  const rate = Number(body?.rate_per_carat)
  const shape_id = body?.shape_id ? String(body.shape_id) : ''
  const overwrite = !!body?.overwrite
  if (!color_bucket_id || !quality_bucket_id) {
    return NextResponse.json({ error: 'color_bucket_id and quality_bucket_id are required' }, { status: 400 })
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: 'rate_per_carat must be a positive number' }, { status: 400 })
  }
  if (rate > 10_000_000) {
    return NextResponse.json({ error: 'rate_per_carat looks too high (max 1,00,00,000 ₹/ct)' }, { status: 400 })
  }

  let sizesQuery = supabaseAdmin
    .from('diamond_sizes')
    .select('id, shape_id, label, approx_carats, active')
    .eq('active', true)
  if (shape_id) sizesQuery = sizesQuery.eq('shape_id', shape_id)
  const { data: sizes, error: sizesErr } = await sizesQuery
  if (sizesErr) return NextResponse.json({ error: sizesErr.message }, { status: 500 })

  const usable = (sizes || []).filter(s => Number(s.approx_carats) > 0)
  const skipped_no_carats = (sizes || []).length - usable.length

  if (usable.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped_existing: 0, skipped_no_carats })
  }

  const { data: existing, error: existErr } = await supabaseAdmin
    .from('cfg_stone_prices')
    .select('id, shape_id, size_id')
    .eq('quality_bucket_id', quality_bucket_id)
    .eq('color_bucket_id', color_bucket_id)
    .eq('type', type)
  if (existErr && (existErr as any).code === '42P01') {
    return NextResponse.json({ error: 'Stone prices migration is pending — run scripts/migrate_merge_stone_prices.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })

  const existingByKey = new Map<string, string>()
  for (const r of existing || []) existingByKey.set(`${r.shape_id}|${r.size_id}`, r.id)

  const updated_by = session.user?.username || session.user?.id || null
  const updated_at = new Date().toISOString()

  const priceFor = (carats: number) => Math.max(1, Math.round(carats * rate))

  const toInsert: any[] = []
  const toUpdate: { id: string; price: number }[] = []
  for (const s of usable) {
    const key = `${s.shape_id}|${s.id}`
    const existsId = existingByKey.get(key)
    if (existsId) {
      if (overwrite) toUpdate.push({ id: existsId, price: priceFor(Number(s.approx_carats)) })
    } else {
      toInsert.push({
        shape_id: s.shape_id,
        size_id: s.id,
        quality_bucket_id,
        color_bucket_id,
        type,
        price_per_piece: priceFor(Number(s.approx_carats)),
        updated_by,
        updated_at,
      })
    }
  }

  const skipped_existing = overwrite ? 0 : (usable.length - toInsert.length)

  if (toInsert.length === 0 && toUpdate.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped_existing, skipped_no_carats })
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from('cfg_stone_prices')
      .insert(toInsert)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  }

  let updated = 0
  for (const u of toUpdate) {
    const { error: updErr } = await supabaseAdmin
      .from('cfg_stone_prices')
      .update({ price_per_piece: u.price, updated_by, updated_at })
      .eq('id', u.id)
    if (updErr) return NextResponse.json({ error: updErr.message, inserted: toInsert.length, updated }, { status: 400 })
    updated++
  }

  return NextResponse.json({
    inserted: toInsert.length,
    updated,
    skipped_existing,
    skipped_no_carats,
    rate_per_carat: rate,
  })
}
