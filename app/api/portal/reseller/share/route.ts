import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import crypto from 'crypto'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch share links
  const { data: shareLinks, error: dbErr } = await supabaseAdmin
    .from('reseller_share_links')
    .select('*')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.share.list', 'Could not load share links.') }, { status: 500 })
  }

  return NextResponse.json({ shareLinks })
}

export async function POST(req: Request) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { link_name, markup_percent, scope, curated_product_ids, id } = body

  if (!link_name || markup_percent === undefined) {
    return NextResponse.json({ error: 'Link name and markup percentage are required' }, { status: 400 })
  }

  const markupVal = Number(markup_percent)
  if (markupVal < 0 || markupVal > 100) {
    return NextResponse.json({ error: 'Markup percent must be between 0 and 100' }, { status: 400 })
  }

  const payload: any = {
    reseller_id: reseller.id,
    link_name,
    markup_percent: markupVal,
    scope: scope || 'full',
    curated_product_ids: curated_product_ids || [],
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString()
  }

  if (id) {
    // Update existing link
    const { data: updatedLink, error: updErr } = await supabaseAdmin
      .from('reseller_share_links')
      .update(payload)
      .eq('id', id)
      .eq('reseller_id', reseller.id)
      .select('*')
      .single()

    if (updErr) {
      return NextResponse.json({ error: safeDbError(updErr, 'reseller.share.update', 'Could not update share link.') }, { status: 500 })
    }

    return NextResponse.json({ shareLink: updatedLink })
  } else {
    // Generate new unique hex link token (32 chars / 16 bytes)
    const linkToken = crypto.randomBytes(16).toString('hex')
    payload.link_token = linkToken
    payload.created_at = new Date().toISOString()

    const { data: newLink, error: insErr } = await supabaseAdmin
      .from('reseller_share_links')
      .insert(payload)
      .select('*')
      .single()

    if (insErr) {
      return NextResponse.json({ error: safeDbError(insErr, 'reseller.share.create', 'Could not generate share link.') }, { status: 500 })
    }

    return NextResponse.json({ shareLink: newLink })
  }
}
