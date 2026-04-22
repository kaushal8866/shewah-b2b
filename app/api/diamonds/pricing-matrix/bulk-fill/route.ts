import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST — fill every blank (shape, size) cell for a given (color, quality, type)
// combo using `approx_carats × rate_per_carat`. Existing rows are left alone so
// the master can keep any hand-tuned prices. Master only.
//   Body: { color_bucket_id, quality_bucket_id, type?: 'lgd'|'natural', rate_per_carat }
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
  if (!color_bucket_id || !quality_bucket_id) {
    return NextResponse.json({ error: 'color_bucket_id and quality_bucket_id are required' }, { status: 400 })
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: 'rate_per_carat must be a positive number' }, { status: 400 })
  }
  // Soft cap so a fat-fingered ₹/ct doesn't seed an absurd price book.
  if (rate > 10_000_000) {
    return NextResponse.json({ error: 'rate_per_carat looks too high (max 1,00,00,000 ₹/ct)' }, { status: 400 })
  }

  // 1. Load every active size with a known approx_carats — that's all we can
  //    derive a price for. Sizes without approx_carats are skipped and reported.
  const { data: sizes, error: sizesErr } = await supabaseAdmin
    .from('diamond_sizes')
    .select('id, shape_id, label, approx_carats, active')
    .eq('active', true)
  if (sizesErr) return NextResponse.json({ error: sizesErr.message }, { status: 500 })

  const usable = (sizes || []).filter(s => Number(s.approx_carats) > 0)
  const skipped_no_carats = (sizes || []).length - usable.length

  if (usable.length === 0) {
    return NextResponse.json({ inserted: 0, skipped_existing: 0, skipped_no_carats })
  }

  // 2. Find which of those (shape, size) cells already have a price for this
  //    (quality, color, type) so we never overwrite them.
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('diamond_price_matrix')
    .select('shape_id, size_id')
    .eq('quality_bucket_id', quality_bucket_id)
    .eq('color_bucket_id', color_bucket_id)
    .eq('type', type)
  if (existErr && (existErr as any).code === '42P01') {
    return NextResponse.json({ error: 'Diamond price matrix migration is pending — run scripts/migrate_task82_diamond_price_matrix.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })

  const taken = new Set((existing || []).map(r => `${r.shape_id}|${r.size_id}`))

  const updated_by = session.user?.username || session.user?.id || null
  const updated_at = new Date().toISOString()

  const rows = usable
    .filter(s => !taken.has(`${s.shape_id}|${s.id}`))
    .map(s => ({
      shape_id: s.shape_id,
      size_id: s.id,
      quality_bucket_id,
      color_bucket_id,
      type,
      // Round to a whole rupee so the grid stays tidy.
      price_per_piece: Math.max(1, Math.round(Number(s.approx_carats) * rate)),
      updated_by,
      updated_at,
    }))

  const skipped_existing = usable.length - rows.length

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped_existing, skipped_no_carats })
  }

  // Insert (not upsert) so any race with a concurrent edit fails loudly rather
  // than silently overwriting — but the pre-check above means this is rare.
  const { error: insErr } = await supabaseAdmin
    .from('diamond_price_matrix')
    .insert(rows)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  return NextResponse.json({
    inserted: rows.length,
    skipped_existing,
    skipped_no_carats,
    rate_per_carat: rate,
  })
}
