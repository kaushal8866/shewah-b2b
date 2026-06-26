import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyPayload } from '@/lib/storefrontAuth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const cookieStore = cookies()
  const sessionJwt = cookieStore.get('reseller_customer_jwt')?.value

  if (!sessionJwt) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const sessionCust = verifyPayload(sessionJwt)
  if (!sessionCust || sessionCust.reseller_token !== token) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { product_id, action } = body
  if (!product_id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  // Fetch current wishlist
  const { data: customer, error: fetchErr } = await supabaseAdmin
    .from('reseller_storefront_customers')
    .select('wishlist_product_ids')
    .eq('id', sessionCust.id)
    .single()

  if (fetchErr || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  let currentIds: string[] = customer.wishlist_product_ids || []
  if (action === 'add') {
    if (!currentIds.includes(product_id)) {
      currentIds.push(product_id)
    }
  } else if (action === 'remove') {
    currentIds = currentIds.filter(id => id !== product_id)
  } else {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('reseller_storefront_customers')
    .update({ wishlist_product_ids: currentIds })
    .eq('id', sessionCust.id)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update wishlist' }, { status: 500 })
  }

  return NextResponse.json({ success: true, wishlist_product_ids: currentIds })
}
