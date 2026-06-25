import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET: validate coupon code
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Promo code parameter is required' }, { status: 400 })
  }

  // 1. Fetch share link
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('reseller_id')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // 2. Fetch coupon matching code
  const { data: coupon } = await supabaseAdmin
    .from('reseller_storefront_coupons')
    .select('*')
    .eq('reseller_id', shareLink.reseller_id)
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) {
    return NextResponse.json({ valid: false, error: 'Invalid or inactive promo code' })
  }

  // 3. Verify expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'This promo code has expired' })
  }

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: Number(coupon.discount_value)
  })
}
