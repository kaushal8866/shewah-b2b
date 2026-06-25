import { NextRequest, NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'

export async function GET(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const threadType = searchParams.get('thread_type')
  const orderId = searchParams.get('linked_order_id')
  const sampleId = searchParams.get('linked_sample_id')

  let query = supabaseAdmin
    .from('reseller_messages')
    .select('id, reseller_id, sender_role, message_type, body, file_url, thread_type, linked_order_id, linked_sample_id, is_read_by_reseller, created_at')
    .eq('reseller_id', reseller.id)
    .is('internal_notes', null)

  if (threadType) {
    query = query.eq('thread_type', threadType)
  }
  if (orderId) {
    query = query.eq('linked_order_id', orderId)
  }
  if (sampleId) {
    query = query.eq('linked_sample_id', sampleId)
  }

  // Order by created_at ascending for chat history
  query = query.order('created_at', { ascending: true })

  const { data: messages, error: dbErr } = await query

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.messages.list', 'Failed to retrieve messages.') },
      { status: 500 }
    )
  }

  // Proactively mark unread messages from admin/system as read by the reseller
  const unreadMsgIds = (messages || [])
    .filter(m => !m.is_read_by_reseller && m.sender_role !== 'reseller')
    .map(m => m.id)

  if (unreadMsgIds.length > 0) {
    await supabaseAdmin
      .from('reseller_messages')
      .update({ is_read_by_reseller: true })
      .in('id', unreadMsgIds)
  }

  return NextResponse.json({ messages: messages || [] })
}

export async function POST(req: NextRequest) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { body: msgBody, file_url, thread_type, linked_order_id, linked_sample_id } = body

  if (!msgBody || !thread_type) {
    return NextResponse.json({ error: 'Message body and thread type are required' }, { status: 400 })
  }

  const { data: newMessage, error: dbErr } = await supabaseAdmin
    .from('reseller_messages')
    .insert({
      reseller_id: reseller.id,
      sender_role: 'reseller',
      message_type: file_url ? 'file' : 'text',
      body: msgBody,
      file_url: file_url || null,
      thread_type,
      linked_order_id: linked_order_id || null,
      linked_sample_id: linked_sample_id || null,
      is_read_by_reseller: true,
      is_read_by_admin: false,
      created_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (dbErr) {
    return NextResponse.json(
      { error: safeDbError(dbErr, 'reseller.messages.send', 'Failed to post message.') },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: newMessage })
}
