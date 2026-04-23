/**
 * Operator-side endpoints for production updates on an order.
 *
 *   GET  — list all updates (admin sees both visible + hidden).
 *   POST — create a new update.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('production_updates')
    .select('id, title, body, photo_url, is_customer_visible, author_id, created_at')
    .eq('order_id', params.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updates: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const actorId = (session.user as any).id || null

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = (body?.title || '').toString().trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (title.length > 140) return NextResponse.json({ error: 'Title too long (140 max)' }, { status: 400 })

  const text = (body?.body || '').toString().trim() || null
  const photoUrl = (body?.photo_url || '').toString().trim() || null
  const isVisible = body?.is_customer_visible === false ? false : true

  // Make sure the order exists.
  const { data: order } = await supabaseAdmin
    .from('orders').select('id').eq('id', params.id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('production_updates')
    .insert({
      order_id: params.id,
      title,
      body: text,
      photo_url: photoUrl,
      is_customer_visible: isVisible,
      author_id: actorId,
    })
    .select('id, title, body, photo_url, is_customer_visible, author_id, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ update: data })
}
