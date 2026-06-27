import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Cost-per-piece suggestions for a (shape, size, type) combo.
 *
 * Returns:
 *   - `cost`           — the single best historical guess (product > inventory),
 *                        kept for backward compatibility with older callers.
 *   - `matrix_options` — every quality × color cell in the central price
 *                        matrix for this shape/size/type. The team-managed
 *                        source of truth (Task #82). Empty when no cell has
 *                        been priced yet, or while the migration is pending.
 *
 * Catalog forms now show both side-by-side and let the user pick (or type
 * their own price) — required so the team can close verbal deals at a
 * negotiated rate without touching the matrix.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const shape_id = searchParams.get('shape_id')
  const size_id  = searchParams.get('size_id')
  const type     = searchParams.get('type') // 'lgd' | 'natural' | null
  if (!shape_id || !size_id) {
    return NextResponse.json({ error: 'shape_id and size_id are required' }, { status: 400 })
  }

  // Matrix lookup (Task #82). LGD-only today; future natural rows will work
  // here too because we filter by `type` when the caller supplies one.
  let matrix_options: Array<{
    cell_id: string
    quality_bucket_id: string
    quality_label: string
    color_bucket_id: string
    color_label: string
    type: string
    price: number
  }> = []
  try {
    let mq = supabaseAdmin
      .from('cfg_stone_prices')
      .select('id, type, price_per_piece, quality_bucket_id, color_bucket_id, quality:diamond_quality_buckets(label,sort_order), color:diamond_color_buckets(label,sort_order)')
      .eq('shape_id', shape_id)
      .eq('size_id', size_id)
    if (type) mq = mq.eq('type', type)
    const { data: cells, error: mErr } = await mq
    // 42P01 = "relation does not exist" → migration not yet applied. Fall
    // through silently so the legacy product/inventory lookup still works.
    if (!mErr && cells) {
      matrix_options = cells.map((c: any) => ({
        cell_id: c.id,
        quality_bucket_id: c.quality_bucket_id,
        quality_label: c.quality?.label || '',
        color_bucket_id: c.color_bucket_id,
        color_label: c.color?.label || '',
        type: c.type,
        price: Number(c.price_per_piece) || 0,
      })).sort((a, b) => a.quality_label.localeCompare(b.quality_label) || a.color_label.localeCompare(b.color_label))
    }
  } catch {
    // Matrix tables aren't available yet — keep going with legacy lookup.
  }

  // 1. Recent products' diamond_specs.
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, sku, created_at, diamond_specs')
    .order('created_at', { ascending: false })
    .limit(300)

  for (const p of products || []) {
    // diamond_specs may be `{ rows: [...] }` or just `[...]` depending on age.
    const specs = (p as any).diamond_specs
    const rows: any[] = Array.isArray(specs) ? specs : (specs?.rows || specs?.diamonds || [])
    for (const r of rows) {
      const sameShape = r.shape_id === shape_id || r.shapeId === shape_id
      const sameSize  = r.size_id  === size_id  || r.sizeId  === size_id
      if (!sameShape || !sameSize) continue
      if (type && r.type && String(r.type).toLowerCase() !== String(type).toLowerCase()) continue
      const cost = Number(r.cost ?? r.cost_per_piece ?? r.unit_cost)
      if (Number.isFinite(cost) && cost > 0) {
        return NextResponse.json({
          cost,
          source: 'product',
          source_label: `Product ${(p as any).sku || (p as any).id}`,
          source_date: (p as any).created_at,
          matrix_options,
        })
      }
    }
  }

  // 2. Vendor inventory fallback.
  let inv = supabaseAdmin
    .from('inventory')
    .select('id, avg_purchase_price, updated_at, created_at, diamond_shape_id, diamond_size_id, diamond_material_type, material_type')
    .eq('diamond_shape_id', shape_id)
    .eq('diamond_size_id', size_id)
    .gt('avg_purchase_price', 0)
    .order('updated_at', { ascending: false })
    .limit(5)
  if (type) {
    inv = inv.or(`diamond_material_type.eq.diamond_${type},material_type.eq.diamond_${type}`)
  }
  const { data: invRows } = await inv
  const invHit = (invRows || []).find(r => Number(r.avg_purchase_price) > 0)
  if (invHit) {
    return NextResponse.json({
      cost: Number(invHit.avg_purchase_price),
      source: 'inventory',
      source_label: 'Vendor inventory',
      source_date: (invHit as any).updated_at || (invHit as any).created_at,
      matrix_options,
    })
  }

  return NextResponse.json({ cost: null, matrix_options })
}
