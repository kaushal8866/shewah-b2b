import { NextRequest, NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const { data: coupons, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_coupons')
    .select('*')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.coupons.list', 'Failed to fetch coupons.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ coupons: coupons || [] })
}

export async function POST(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { code, discount_type, discount_value, expires_at } = body

  if (!code || !discount_type || discount_value === undefined) {
    return NextResponse.json({ error: 'Missing code, type, or value' }, { status: 400 })
  }

  const cleanCode = code.trim().toUpperCase()

  const { data: newCoupon, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_coupons')
    .insert({
      reseller_id: reseller.id,
      code: cleanCode,
      discount_type,
      discount_value: Number(discount_value),
      expires_at: expires_at || null,
      is_active: true,
      created_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.coupons.create', 'Failed to create promo coupon.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ coupon: newCoupon })
}

export async function PATCH(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, is_active } = body

  if (!id) {
    return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 })
  }

  const { data: updatedCoupon, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_coupons')
    .update({ is_active })
    .eq('id', id)
    .eq('reseller_id', reseller.id)
    .select('*')
    .single()

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.coupons.update', 'Failed to update coupon status.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ coupon: updatedCoupon })
}
