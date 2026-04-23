/**
 * POST /api/orders/[id]/journey-link/extend
 * body: { days: number }
 *
 * Extends an existing journey link's expiry by N days from the *current*
 * expires_at (or from now, whichever is later — so an already-expired link
 * is brought back to life with a fresh window).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const days = parseInt(body?.days)
  if (!Number.isFinite(days) || days < 1 || days > 730) {
    return NextResponse.json({ error: 'days must be between 1 and 730' }, { status: 400 })
  }

  // Confirm the order is still a D2C order before extending — protects
  // against an audience flip-back from 'd2c' to 'b2b' leaving an active
  // consumer link in the wild.
  const { data: order } = await supabaseAdmin
    .from('orders').select('audience').eq('id', params.id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if ((order as any).audience !== 'd2c') {
    return NextResponse.json({ error: "Journey links are only available for D2C orders." }, { status: 400 })
  }

  const { data: link } = await supabaseAdmin
    .from('customer_journey_links')
    .select('token, expires_at')
    .eq('order_id', params.id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'No journey link for this order' }, { status: 404 })

  const base = Math.max(new Date((link as any).expires_at).getTime(), Date.now())
  const next = new Date(base + days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('customer_journey_links')
    .update({ expires_at: next, revoked_at: null })
    .eq('order_id', params.id)
    .select('token, expires_at, revoked_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}
