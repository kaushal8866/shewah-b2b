import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST — multiply every price in the matrix by (1 + percent/100).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const percent = Number(body?.percent)
  if (!Number.isFinite(percent) || percent === 0) {
    return NextResponse.json({ error: 'percent must be a non-zero number' }, { status: 400 })
  }
  if (Math.abs(percent) > 50) {
    return NextResponse.json({ error: 'percent must be between -50 and +50 in a single adjustment' }, { status: 400 })
  }
  const type = body?.type === 'natural' ? 'natural' : (body?.type === 'lgd' ? 'lgd' : null)

  const factor = 1 + percent / 100

  let q = supabaseAdmin.from('cfg_stone_prices').select('id, price_per_piece, type')
  if (type) q = q.eq('type', type)
  const { data: rows, error: readErr } = await q
  if (readErr && (readErr as any).code === '42P01') {
    return NextResponse.json({ error: 'Stone prices migration is pending — run scripts/migrate_merge_stone_prices.sql in Supabase.', migration_pending: true }, { status: 503 })
  }
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  const updated_by = session.user?.username || session.user?.id || null
  const updated_at = new Date().toISOString()
  let updated = 0
  for (const r of rows || []) {
    const newPrice = Math.max(0, Math.round(Number(r.price_per_piece) * factor))
    const { error: upErr } = await supabaseAdmin
      .from('cfg_stone_prices')
      .update({ price_per_piece: newPrice, updated_by, updated_at })
      .eq('id', r.id)
    if (!upErr) updated += 1
  }

  return NextResponse.json({ updated, percent, factor })
}
