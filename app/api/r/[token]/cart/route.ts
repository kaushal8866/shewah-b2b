import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStorefrontCustomer } from '@/lib/storefrontAuth'

// GET: load synced cart
export async function GET(req: NextRequest) {
  const customer = await getStorefrontCustomer()
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cart } = await supabaseAdmin
    .from('reseller_storefront_carts')
    .select('items')
    .eq('customer_id', customer.id)
    .maybeSingle()

  return NextResponse.json({ items: cart?.items || [] })
}

// POST: save cart items
export async function POST(req: NextRequest) {
  const customer = await getStorefrontCustomer()
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { items } = body
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'Items must be an array' }, { status: 400 })
  }

  const { data: updatedCart, error } = await supabaseAdmin
    .from('reseller_storefront_carts')
    .upsert({
      customer_id: customer.id,
      items: items,
      updated_at: new Date().toISOString()
    }, { onConflict: 'customer_id' })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Could not sync cart: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, cart: updatedCart })
}
