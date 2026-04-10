import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Validate that a collection is published and a partner exists.
async function validate(collectionId: string, partnerId: string): Promise<{ ok: boolean; error?: string }> {
  const [{ data: coll }, { data: partner }] = await Promise.all([
    supabaseAdmin.from('design_collections').select('id, is_published').eq('id', collectionId).single(),
    supabaseAdmin.from('partners').select('id').eq('id', partnerId).single(),
  ])
  if (!coll) return { ok: false, error: 'Collection not found' }
  if (!coll.is_published) return { ok: false, error: 'Collection is not published' }
  if (!partner) return { ok: false, error: 'Partner not found' }
  return { ok: true }
}

// POST — add or upsert an interest row
export async function POST(req: NextRequest) {
  const { collection_id, partner_id, product_id } = await req.json()
  if (!collection_id || !partner_id || !product_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const check = await validate(collection_id, partner_id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('design_interests')
    .upsert({ collection_id, partner_id, product_id, note: '', quantity_hint: null },
      { onConflict: 'partner_id,product_id,collection_id' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove an interest row (validates it belongs to this partner)
export async function DELETE(req: NextRequest) {
  const { id, partner_id } = await req.json()
  if (!id || !partner_id) return NextResponse.json({ error: 'Missing id or partner_id' }, { status: 400 })

  // Only delete if the row actually belongs to this partner
  const { error } = await supabaseAdmin
    .from('design_interests')
    .delete()
    .eq('id', id)
    .eq('partner_id', partner_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — update note or quantity_hint for a row
export async function PATCH(req: NextRequest) {
  const { id, partner_id, note, quantity_hint } = await req.json()
  if (!id || !partner_id) return NextResponse.json({ error: 'Missing id or partner_id' }, { status: 400 })

  const update: { note?: string | null; quantity_hint?: number | null } = {}
  if (note !== undefined) update.note = note
  if (quantity_hint !== undefined) update.quantity_hint = quantity_hint

  const { error } = await supabaseAdmin
    .from('design_interests')
    .update(update)
    .eq('id', id)
    .eq('partner_id', partner_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
