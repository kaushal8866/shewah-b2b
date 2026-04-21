import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Latest cost-per-piece lookup for a (shape, size, type) combo.
 * Used by product/inventory forms to auto-fill the diamond cost field.
 *
 * Source priority:
 *   1. Most recent product whose `diamond_specs` array contains a row with
 *      this shape_id + size_id (and matching type when provided). Cost lives
 *      in the row's `cost` field.
 *   2. Most recent vendor inventory row matching shape_id + size_id + type
 *      (cost lives in `avg_purchase_price`).
 *
 * Returns null if nothing found yet — the caller leaves the field blank.
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
    })
  }

  return NextResponse.json({ cost: null })
}
