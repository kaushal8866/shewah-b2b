import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json().catch(() => ({}))
  const { reason } = body || {}

  if (!reason) {
    return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('gst_invoices')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ invoice: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to cancel invoice' }, { status: 400 })
  }
}
