import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function getRetailerUser() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; partnerId?: string; username?: string; id?: string } | undefined
  if (!user || user.role !== 'retailer' || !user.partnerId) return null
  return user
}

const PUBLIC_COLS = `
  id, karat, gross_weight, pure_24kt_weight, diamond_specs, photos, list_price, created_at,
  product:products ( id, code, name, photo_urls )
`

export async function GET() {
  const user = await getRetailerUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: items, error } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select(PUBLIC_COLS)
    .eq('status', 'available')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pull this retailer's own offer status per item so the list can show
  // "Pending offer ₹X" / "Countered to ₹Y" badges.
  const ids = (items || []).map((i: { id: string }) => i.id)
  let myOffers: Record<string, unknown> = {}
  if (ids.length) {
    const { data: ofs } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .select('id, item_id, offer_price, status, counter_price, counter_note, created_at')
      .eq('partner_id', user.partnerId)
      .in('item_id', ids)
      .order('created_at', { ascending: false })
    for (const o of (ofs || []) as { item_id: string }[]) {
      // Keep only the most recent offer per item.
      if (!myOffers[o.item_id]) myOffers[o.item_id] = o
    }
  }

  return NextResponse.json({
    items: (items || []).map((i: Record<string, unknown>) => ({
      ...i,
      my_offer: myOffers[i.id as string] || null,
    })),
  })
}
