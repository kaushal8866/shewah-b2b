import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  if (role === 'sub' && data.created_by !== (session.user as any).id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master') {
    return NextResponse.json({ error: 'Only master users can void transactions' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { void_reason } = body

  if (!void_reason?.trim()) {
    return NextResponse.json({ error: 'Void reason is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('cash_transactions')
    .update({
      is_void: true,
      void_reason: void_reason.trim(),
      voided_at: new Date().toISOString(),
      voided_by: (session.user as any).id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
