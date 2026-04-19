import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

// Master / sub-admin endpoint to list order change requests filed by retailers.
// Admin-side errors can pass through more detail (these are internal users)
// but we still scrub through the sanitiser so we don't leak schema in logs
// shipped to the browser.
async function requireAdmin() {
  const s = await getServerSession(authOptions)
  const u: any = s?.user
  if (!u || (u.role !== 'master' && u.role !== 'sub')) return null
  return u
}

export async function GET(req: Request) {
  const u = await requireAdmin()
  if (!u) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const orderId = searchParams.get('order_id') || ''

  let q = supabaseAdmin
    .from('order_change_requests')
    .select(`
      id, created_at, status, changes, retailer_note,
      reviewed_at, review_note,
      order:orders ( id, order_number, status, quantity, ring_size, special_notes, brief_text ),
      partner:partners ( id, store_name, city ),
      requester:app_users!requested_by ( id, username, display_name ),
      reviewer:app_users!reviewed_by ( id, username, display_name )
    `)
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) q = q.eq('status', status)
  if (orderId) q = q.eq('order_id', orderId)

  const { data, error } = await q
  if (error) {
    return NextResponse.json(
      { error: safeDbError(error, 'admin.change_requests.list', 'Could not load change requests.') },
      { status: 500 },
    )
  }
  return NextResponse.json({ requests: data || [] })
}
