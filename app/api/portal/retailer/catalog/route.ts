import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Fields the retailer is allowed to see. Internal cost / margin fields
// (diamond_cost, making_charges, mrp_suggested) are intentionally excluded.
const LIST_COLS = `
  id, code, name, description, category,
  diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_type,
  gold_karat, gold_weight_g,
  trade_price, photo_urls, delivery_days, models_available, tags
`

async function requireRetailer() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer' || !user.partnerId) return null
  return user
}

export async function GET() {
  const user = await requireRetailer()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(LIST_COLS)
    .eq('is_active', true)
    .order('code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}
