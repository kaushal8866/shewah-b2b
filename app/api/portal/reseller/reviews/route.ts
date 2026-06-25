import { NextRequest, NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const { data: reviews, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_reviews')
    .select('*, products(code, name)')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.reviews.list', 'Failed to fetch reviews.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ reviews: reviews || [] })
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, status, reseller_reply } = body

  if (!id) {
    return NextResponse.json({ error: 'Review ID is required' }, { status: 400 })
  }

  const updateFields: any = {}
  if (status) updateFields.status = status
  if (reseller_reply !== undefined) updateFields.reseller_reply = reseller_reply

  const { data: updatedReview, error: dbErr } = await supabaseAdmin
    .from('reseller_storefront_reviews')
    .update(updateFields)
    .eq('id', id)
    .eq('reseller_id', reseller.id)
    .select('*')
    .single()

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.reviews.update', 'Failed to update review status.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ review: updatedReview })
}
