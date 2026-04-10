import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/collections/[id]/products
// Body: { product_ids: string[] }  (full replacement — deletes existing then inserts)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_ids } = await req.json()

  await supabaseAdmin
    .from('design_collection_products')
    .delete()
    .eq('collection_id', params.id)

  if (product_ids && product_ids.length > 0) {
    const rows = product_ids.map((pid: string, idx: number) => ({
      collection_id: params.id,
      product_id: pid,
      sort_order: idx,
    }))
    const { error } = await supabaseAdmin
      .from('design_collection_products')
      .insert(rows)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
