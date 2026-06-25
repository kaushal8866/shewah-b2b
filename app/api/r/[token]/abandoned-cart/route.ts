import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStorefrontCustomer } from '@/lib/storefrontAuth'

// POST: log or update abandoned cart tracking
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { items, guest_phone, guest_name } = body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
  }

  // 1. Resolve reseller
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('reseller_id')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // 2. Resolve optional customer session
  const customer = await getStorefrontCustomer()

  // 3. Upsert abandoned cart record
  let query = supabaseAdmin
    .from('reseller_storefront_abandoned_carts')

  // If customer is logged in, use customer_id check
  let updateKey: any = {}
  if (customer) {
    updateKey = { customer_id: customer.id }
  } else if (guest_phone) {
    updateKey = { guest_phone: guest_phone.replace(/\s+/g, '') }
  } else {
    // If guest and no contact info, do not save in DB
    return NextResponse.json({ success: true, logged: false })
  }

  // Find existing active abandoned cart
  const { data: existing } = await supabaseAdmin
    .from('reseller_storefront_abandoned_carts')
    .select('id, recovery_attempts')
    .eq('reseller_id', shareLink.reseller_id)
    .eq(customer ? 'customer_id' : 'guest_phone', customer ? customer.id : guest_phone.replace(/\s+/g, ''))
    .eq('status', 'active')
    .maybeSingle()

  let result
  if (existing) {
    result = await supabaseAdmin
      .from('reseller_storefront_abandoned_carts')
      .update({
        items: items,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
  } else {
    result = await supabaseAdmin
      .from('reseller_storefront_abandoned_carts')
      .insert({
        reseller_id: shareLink.reseller_id,
        customer_id: customer?.id || null,
        guest_phone: guest_phone ? guest_phone.replace(/\s+/g, '') : null,
        guest_name: guest_name || null,
        items: items,
        recovery_attempts: 0,
        status: 'active'
      })
  }

  if (result.error) {
    return NextResponse.json({ error: 'Could not log abandoned cart: ' + result.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, logged: true })
}
