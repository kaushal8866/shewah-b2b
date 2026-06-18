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

  const tradeId = params.id
  if (!tradeId) {
    return NextResponse.json({ error: 'trade_id is required' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { amount, payment_date, reference, method, notes } = body || {}

  if (!amount) {
    return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  try {
    // 1. Insert payment row
    const payIns = await supabaseAdmin.from('partner_trade_payments').insert([{
      trade_id: tradeId,
      amount: numAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      reference: reference || null,
      method: method || 'other',
      notes: notes || null,
      created_by: session.user?.name || session.user?.username || 'admin',
    }]).select('*').single()

    if (payIns.error) throw payIns.error

    // 2. Fetch all payments for this trade to compute sum
    const allPays = await supabaseAdmin
      .from('partner_trade_payments')
      .select('amount')
      .eq('trade_id', tradeId)

    if (allPays.error) throw allPays.error

    const totalPaid = (allPays.data || []).reduce((sum, p) => sum + Number(p.amount), 0)

    // 3. Fetch trade total_amount
    const tradeQ = await supabaseAdmin
      .from('partner_diamond_trades')
      .select('total_amount, trade_type')
      .eq('id', tradeId)
      .single()

    if (tradeQ.error) throw tradeQ.error
    const totalAmount = Number(tradeQ.data.total_amount)

    // 4. Determine status
    let status = 'unpaid'
    if (totalPaid >= totalAmount) {
      status = 'paid'
    } else if (totalPaid > 0) {
      status = 'partially_paid'
    }

    // 5. Update trade
    const upd = await supabaseAdmin
      .from('partner_diamond_trades')
      .update({
        paid_amount: totalPaid,
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)
      .select('*')
      .single()

    if (upd.error) throw upd.error

    return NextResponse.json({ payment: payIns.data, trade: upd.data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to record payment' }, { status: 400 })
  }
}
