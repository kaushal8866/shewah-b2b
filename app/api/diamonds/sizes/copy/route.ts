import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Master-only helper that copies every active size from one shape into
// another, skipping any labels that already exist on the target. Used by
// /diamonds/catalog → "Copy sizes from..." so a master can seed a freshly
// added shape (e.g. Rose Cut) from an existing one in a single click
// instead of typing the whole grid by hand.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const from_shape_id = String(body?.from_shape_id || '').trim()
  const to_shape_id = String(body?.to_shape_id || '').trim()
  if (!from_shape_id || !to_shape_id) {
    return NextResponse.json({ error: 'from_shape_id and to_shape_id are required' }, { status: 400 })
  }
  if (from_shape_id === to_shape_id) {
    return NextResponse.json({ error: 'Source and target must be different' }, { status: 400 })
  }

  const [srcShape, dstShape, src, existing] = await Promise.all([
    supabaseAdmin.from('diamond_shapes').select('id').eq('id', from_shape_id).maybeSingle(),
    supabaseAdmin.from('diamond_shapes').select('id').eq('id', to_shape_id).maybeSingle(),
    supabaseAdmin.from('diamond_sizes').select('label,approx_carats,reorder_threshold_pieces,sort_order')
      .eq('shape_id', from_shape_id).eq('active', true),
    supabaseAdmin.from('diamond_sizes').select('label').eq('shape_id', to_shape_id),
  ])
  if (srcShape.error)  return NextResponse.json({ error: srcShape.error.message }, { status: 500 })
  if (dstShape.error)  return NextResponse.json({ error: dstShape.error.message }, { status: 500 })
  if (!srcShape.data)  return NextResponse.json({ error: 'Source shape not found' }, { status: 404 })
  if (!dstShape.data)  return NextResponse.json({ error: 'Target shape not found' }, { status: 404 })
  if (src.error)       return NextResponse.json({ error: src.error.message }, { status: 500 })
  if (existing.error)  return NextResponse.json({ error: existing.error.message }, { status: 500 })

  // Skip if the target already has a label that matches case-insensitively,
  // and also dedupe within the source itself (last-wins) so a master who
  // hand-added "5x3 mm" + "5X3 MM" doesn't end up with both copied over.
  const taken = new Set((existing.data || []).map(r => r.label.toLowerCase()))
  const dedup = new Map<string, typeof src.data[number]>()
  for (const r of (src.data || [])) {
    const k = r.label.toLowerCase()
    if (taken.has(k)) continue
    dedup.set(k, r)
  }
  const rows = Array.from(dedup.values()).map(r => ({
    shape_id: to_shape_id,
    label: r.label,
    approx_carats: r.approx_carats,
    reorder_threshold_pieces: r.reorder_threshold_pieces,
    sort_order: r.sort_order,
    active: true,
  }))
  const sourceCount = src.data?.length || 0
  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: sourceCount })
  }
  // upsert with ignoreDuplicates so a concurrent writer inserting the same
  // (shape_id, label) doesn't fail the whole batch.
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('diamond_sizes')
    .upsert(rows, { onConflict: 'shape_id,label', ignoreDuplicates: true })
    .select('id')
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  const insertedCount = inserted?.length || 0
  return NextResponse.json({
    inserted: insertedCount,
    skipped: sourceCount - insertedCount,
  })
}
