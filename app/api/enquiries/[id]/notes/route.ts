/**
 * POST /api/enquiries/[id]/notes
 *
 * Append a note to an enquiry's timeline. Notes are stored in the
 * customer_enquiry_activity table with type='note' so they show inline
 * with status changes and assignments.
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
  const actorId = (session.user as any).id || null

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const text = String(body.body || '').trim()
  if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('customer_enquiry_activity')
    .insert({ enquiry_id: params.id, actor_id: actorId, type: 'note', body: text, payload: null })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bump updated_at so the inbox surfaces freshness.
  await supabaseAdmin.from('customer_enquiries').update({ updated_at: new Date().toISOString() }).eq('id', params.id)

  return NextResponse.json({ activity: data })
}
