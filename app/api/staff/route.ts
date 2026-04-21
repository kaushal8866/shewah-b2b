/**
 * GET /api/staff
 *
 * Constrained read-only list of admin staff (role in master/sub) intended
 * for in-app pickers like the lead-inbox assignee dropdown. Available to
 * any authenticated admin user — narrower fields than /api/users (which
 * is master-only and exposes the full user record).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, role')
    .in('role', ['master', 'sub'])
    .order('display_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data || [] })
}
