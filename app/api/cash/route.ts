import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getCategoryMeta } from '@/lib/cashCategories'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const txn_type = searchParams.get('txn_type')
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  let q = supabaseAdmin
    .from('cash_transactions')
    .select('*', { count: 'exact' })

  if (role === 'sub') {
    q = q.eq('created_by', (session.user as any).id)
  }

  if (from) q = q.gte('txn_date', from)
  if (to) q = q.lte('txn_date', to)
  if (txn_type) q = q.eq('txn_type', txn_type)
  if (category) q = q.eq('category', category)
  if (search) {
    q = q.or(`note.ilike.%${search}%,party_name.ilike.%${search}%,txn_number.ilike.%${search}%`)
  }

  q = q.order('txn_date', { ascending: false })
       .order('created_at', { ascending: false })
       .range(offset, offset + limit - 1)

  const { data, error, count } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    count: count || 0,
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    txn_date,
    txn_type,
    category,
    amount,
    payment_mode = 'cash',
    note,
    party_name,
    linked_order_id,
    linked_partner_id,
  } = body

  if (!txn_type || !['income', 'expense'].includes(txn_type)) {
    return NextResponse.json({ error: 'Invalid or missing transaction type' }, { status: 400 })
  }

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 })
  }

  const meta = getCategoryMeta(category)
  if (!meta || meta.type !== txn_type) {
    return NextResponse.json({ error: `Invalid category "${category}" for type "${txn_type}"` }, { status: 400 })
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a number greater than 0' }, { status: 400 })
  }

  if (!['cash', 'upi', 'bank_transfer', 'cheque', 'other'].includes(payment_mode)) {
    return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 })
  }

  // Restrict future dates
  const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const inputDate = txn_date || todayStr
  if (inputDate > todayStr) {
    return NextResponse.json({ error: 'Transaction date cannot be in the future' }, { status: 400 })
  }

  const userId = (session.user as any).id

  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .insert({
      txn_date: inputDate,
      txn_type,
      category_group: meta.group,
      category,
      amount,
      payment_mode,
      note: note || null,
      party_name: party_name || null,
      linked_order_id: linked_order_id || null,
      linked_partner_id: linked_partner_id || null,
      is_cogs: meta.is_cogs,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
