import { NextRequest, NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const { data: notifications, error: dbErr } = await supabaseAdmin
    .from('reseller_notifications')
    .select('*')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.notifications.list', 'Failed to retrieve notifications.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ notifications: notifications || [] })
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
    body = {}
  }

  const { id, mark_all_read } = body

  let query = supabaseAdmin
    .from('reseller_notifications')
    .update({ is_read: true })
    .eq('reseller_id', reseller.id)

  if (mark_all_read !== true) {
    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }
    query = query.eq('id', id)
  }

  const { error: dbErr } = await query

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.notifications.read', 'Failed to update notification read status.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
