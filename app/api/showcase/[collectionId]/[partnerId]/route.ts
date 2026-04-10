import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Params = { params: { collectionId: string; partnerId: string } }

type Selection = {
  product_id: string
  note?: string | null
  quantity_hint?: number | null
}

async function validateLink(collectionId: string, partnerId: string) {
  const [{ data: coll }, { data: partner }] = await Promise.all([
    supabaseAdmin.from('design_collections').select('id, name, description, circuit_target, is_published').eq('id', collectionId).single(),
    supabaseAdmin.from('partners').select('id, store_name, owner_name, city').eq('id', partnerId).single(),
  ])
  return { coll, partner }
}

// GET — returns collection metadata, products, and existing partner interests
export async function GET(_req: NextRequest, { params }: Params) {
  const { collectionId, partnerId } = params

  const { coll, partner } = await validateLink(collectionId, partnerId)

  if (!coll || !partner) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }
  if (!coll.is_published) {
    return NextResponse.json({ error: 'Collection not published' }, { status: 403 })
  }

  // Get products in collection
  const { data: collProds } = await supabaseAdmin
    .from('design_collection_products')
    .select('product_id, sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order')

  let products: object[] = []
  if (collProds && collProds.length > 0) {
    const ids = collProds.map(r => r.product_id)
    const { data: prods } = await supabaseAdmin
      .from('products')
      .select('id, code, name, gold_karat, diamond_shape, trade_price, photo_urls, is_active')
      .in('id', ids)
    const sorted = (prods ?? []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    products = sorted
  }

  // Get existing interests for this partner+collection
  const { data: interests } = await supabaseAdmin
    .from('design_interests')
    .select('id, product_id, note, quantity_hint')
    .eq('collection_id', collectionId)
    .eq('partner_id', partnerId)

  // Track visit (non-blocking, fire and forget)
  void supabaseAdmin.from('showcase_views').insert({
    collection_id: collectionId,
    partner_id: partnerId,
  })

  return NextResponse.json({
    collection: { id: coll.id, name: coll.name, description: coll.description, circuit_target: coll.circuit_target, is_published: coll.is_published },
    partner: { id: partner.id, store_name: partner.store_name, owner_name: partner.owner_name, city: partner.city },
    products,
    interests: interests ?? [],
  })
}

// POST — bulk upsert all partner selections for this collection
export async function POST(req: NextRequest, { params }: Params) {
  const { collectionId, partnerId } = params

  const { coll, partner } = await validateLink(collectionId, partnerId)
  if (!coll || !partner) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if (!coll.is_published) return NextResponse.json({ error: 'Collection not published' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const selections: Selection[] = Array.isArray(body.selections) ? body.selections : []

  // Validate all product_ids actually belong to this collection
  const { data: collProds } = await supabaseAdmin
    .from('design_collection_products')
    .select('product_id')
    .eq('collection_id', collectionId)

  const validProductIds = new Set((collProds ?? []).map(r => r.product_id))
  const validSelections = selections.filter(s => validProductIds.has(s.product_id))

  // Upsert submitted selections (conflict on collection_id,partner_id,product_id)
  if (validSelections.length > 0) {
    const rows = validSelections.map(s => ({
      collection_id: collectionId,
      partner_id: partnerId,
      product_id: s.product_id,
      note: s.note ?? null,
      quantity_hint: s.quantity_hint ?? null,
    }))
    const { error: upsertError } = await supabaseAdmin
      .from('design_interests')
      .upsert(rows, { onConflict: 'partner_id,product_id,collection_id' })
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Remove de-selected products (rows NOT in the submitted set)
  const submittedIds = validSelections.map(s => s.product_id)
  const { error: deleteError } = submittedIds.length > 0
    ? await supabaseAdmin
        .from('design_interests')
        .delete()
        .eq('collection_id', collectionId)
        .eq('partner_id', partnerId)
        .not('product_id', 'in', `(${submittedIds.join(',')})`)
    : await supabaseAdmin
        .from('design_interests')
        .delete()
        .eq('collection_id', collectionId)
        .eq('partner_id', partnerId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: validSelections.length })
}
