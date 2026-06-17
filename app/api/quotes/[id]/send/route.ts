import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { sendQuoteShareLink } from '@/lib/quoteShareNotify'

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/send
// Generates a magic share token, sets status to 'sent', and returns the share info.
export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id

  // 1. Fetch quote details
  const { data: quote, error: getQuoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(*)')
    .eq('id', id)
    .maybeSingle()

  if (getQuoteError) {
    return NextResponse.json({ error: getQuoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Generate 32 hex chars token
  const token = crypto.randomBytes(16).toString('hex')

  // Calculate expires_at: 60 days from now, but capped to valid_until + 30 days
  const now = new Date()
  const days60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  
  const validUntil = new Date(quote.valid_until)
  const capDate = new Date(validUntil.getTime() + 30 * 24 * 60 * 60 * 1000)
  
  const expiresAt = days60.getTime() < capDate.getTime() ? days60 : capDate

  // 2. Insert into quote_share_links
  const { error: insertLinkError } = await supabaseAdmin
    .from('quote_share_links')
    .insert([
      {
        token,
        quote_id: id,
        expires_at: expiresAt.toISOString(),
      }
    ])

  if (insertLinkError) {
    return NextResponse.json({ error: insertLinkError.message }, { status: 500 })
  }

  // 3. Update quote status to 'sent' and save share_token + shared_at
  const { error: updateQuoteError } = await supabaseAdmin
    .from('quotes')
    .update({
      status: 'sent',
      share_token: token,
      shared_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateQuoteError) {
    // Attempt rollback of link insertion
    await supabaseAdmin.from('quote_share_links').delete().eq('token', token)
    return NextResponse.json({ error: updateQuoteError.message }, { status: 500 })
  }

  // 4. Resolve name and phone for WhatsApp dispatch
  let recipientName = 'Customer'
  let recipientPhone = ''

  if (quote.partners) {
    recipientName = quote.partners.store_name || quote.partners.owner_name || 'Partner'
    recipientPhone = quote.partners.phone || ''
  } else {
    recipientName = quote.walk_in_name || 'Customer'
    recipientPhone = quote.walk_in_phone || ''
  }

  // 5. Build and optionally send WhatsApp notification
  const shareResult = await sendQuoteShareLink({
    quoteId: id,
    token,
    recipientName,
    recipientPhone,
    validUntil: quote.valid_until,
  })

  return NextResponse.json({
    success: true,
    token,
    expires_at: expiresAt.toISOString(),
    publicUrl: shareResult.publicUrl,
    waUrl: shareResult.waUrl,
    notification: {
      ok: shareResult.ok,
      reason: shareResult.reason,
      body: shareResult.body,
    }
  })
}
