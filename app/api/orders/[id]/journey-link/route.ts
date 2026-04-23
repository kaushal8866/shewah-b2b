/**
 * Operator-side CRUD for the customer journey magic link.
 *
 *   GET    — return the link for this order (or null)
 *   POST   — create a link if none exists (idempotent: returns existing)
 *   DELETE — revoke the existing link (sets revoked_at)
 *
 * Admin-gated. The order must have a customer_id and audience='d2c'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateJourneyToken, defaultJourneyExpiry } from '@/lib/journeyToken'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) return null
  return session
}

async function loadOrder(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_id, audience, expected_delivery_date')
    .eq('id', orderId)
    .maybeSingle()
  if (error || !data) return null
  return data as any
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const order = await loadOrder(params.id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: link } = await supabaseAdmin
    .from('customer_journey_links')
    .select('token, customer_id, expires_at, revoked_at, opened_count, first_opened_at, last_opened_at, created_at')
    .eq('order_id', params.id)
    .maybeSingle()
  return NextResponse.json({ link: link || null, order: { id: order.id, order_number: order.order_number, audience: order.audience, customer_id: order.customer_id } })
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const actorId = (session.user as any).id || null

  const order = await loadOrder(params.id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.customer_id) {
    return NextResponse.json({ error: 'Attach a customer to this order before creating a journey link.' }, { status: 400 })
  }
  if (order.audience !== 'd2c') {
    return NextResponse.json({ error: "Journey links are only available for D2C orders. Set this order's audience to 'd2c' first." }, { status: 400 })
  }

  // Idempotent — return existing link if one is present (even if revoked,
  // so the operator can see it; new link must come from explicit "rotate"
  // workflow which we do not expose yet).
  const existing = await supabaseAdmin
    .from('customer_journey_links')
    .select('token, expires_at, revoked_at, opened_count, last_opened_at, created_at')
    .eq('order_id', params.id)
    .maybeSingle()
  if (existing.data) {
    return NextResponse.json({ link: existing.data, created: false })
  }

  const token = generateJourneyToken()
  // Default expiry: max(180 days from now, 180 days after expected delivery).
  const base = order.expected_delivery_date ? new Date(order.expected_delivery_date) : new Date()
  const expiresAt = defaultJourneyExpiry(base)

  const { data, error } = await supabaseAdmin
    .from('customer_journey_links')
    .insert({
      token,
      customer_id: order.customer_id,
      order_id: params.id,
      expires_at: expiresAt.toISOString(),
      created_by: actorId,
    })
    .select('token, expires_at, opened_count, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ link: data, created: true })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('customer_journey_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('order_id', params.id)
    .is('revoked_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
