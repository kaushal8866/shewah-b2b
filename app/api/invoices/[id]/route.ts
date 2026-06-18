import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET: individual invoice details
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master' && session.user?.role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = params
  try {
    const { data, error } = await supabaseAdmin
      .from('gst_invoices')
      .select('*, orders:order_id(order_number)')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return NextResponse.json({ invoice: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invoice not found' }, { status: 404 })
  }
}

// PUT: update invoice metadata
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json().catch(() => ({}))
  const {
    buyer_name,
    buyer_address,
    buyer_gstin,
    buyer_state,
    invoice_date,
  } = body

  if (!buyer_name || !buyer_state || !invoice_date) {
    return NextResponse.json({ error: 'buyer_name, buyer_state, and invoice_date are required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('gst_invoices')
      .update({
        buyer_name,
        buyer_address,
        buyer_gstin,
        buyer_state,
        invoice_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ invoice: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update invoice' }, { status: 500 })
  }
}

// DELETE: hard delete invoice
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const { id } = params
  try {
    const { error } = await supabaseAdmin
      .from('gst_invoices')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true, message: 'Invoice deleted successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete invoice' }, { status: 500 })
  }
}
