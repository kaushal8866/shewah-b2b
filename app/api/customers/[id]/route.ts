/**
 * GET /api/customers/[id]
 *
 * Returns the customer plus their addresses and a brief enquiry summary
 * (id, number, title, status, created_at) for the profile page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  const [customerRes, addrRes, enqRes] = await Promise.all([
    supabaseAdmin.from('customers').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('customer_addresses').select('*').eq('customer_id', id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
    supabaseAdmin.from('customer_enquiries')
      .select('id, enquiry_number, title, status, created_at, target_date, budget_min, budget_max')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (customerRes.error)             return NextResponse.json({ error: customerRes.error.message }, { status: 500 })
  if (!customerRes.data)             return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    customer:  customerRes.data,
    addresses: addrRes.data || [],
    enquiries: enqRes.data || [],
  })
}
