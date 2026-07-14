import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { renderQuotePdf } from '@/lib/quotePdf'
import { safeName } from '@/lib/pdfHelpers'

export const dynamic = 'force-dynamic'

// GET /api/quotes/share/[token]/pdf
// Public tokenized endpoint streaming the quotation PDF file.
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token
  const { searchParams } = new URL(req.url)
  const isDownload = searchParams.get('download') === '1'

  // 1. Fetch and validate share link
  const { data: shareLink, error: shareError } = await supabaseAdmin
    .from('quote_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 500 })
  }

  if (!shareLink) {
    return NextResponse.json({ error: 'Quote link not found' }, { status: 404 })
  }

  if (shareLink.revoked_at) {
    return NextResponse.json({ error: 'Quote link has been revoked' }, { status: 410 })
  }

  const expiresAt = new Date(shareLink.expires_at)
  if (expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Quote link has expired' }, { status: 410 })
  }

  // 2. Fetch linked quote
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name, city, phone), prepared_by_user:app_users!prepared_by(display_name, username, signature_url)')
    .eq('id', shareLink.quote_id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 3. Fetch quote items sorted by position
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)
    .order('position', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // 3b. Build a shape_id → name lookup to backfill shape_name for older
  //     diamond rows that were saved before the picker stored shape_name.
  const { data: shapes } = await supabaseAdmin
    .from('diamond_shapes')
    .select('id, name')
  const shapeMap: Record<string, string> = {}
  for (const s of shapes || []) shapeMap[s.id] = s.name

  const patchedItems = (items || []).map((item: any) => ({
    ...item,
    diamonds: Array.isArray(item.diamonds)
      ? item.diamonds.map((d: any) => ({
          ...d,
          // Prefer stored shape_name; fall back to lookup via shape_id
          shape_name: d.shape_name || (d.shape_id ? shapeMap[d.shape_id] : null) || null,
        }))
      : [],
  }))

  // 4. Generate PDF Buffer
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderQuotePdf(quote as any, patchedItems as any[])
  } catch (err: any) {
    return NextResponse.json({ error: `PDF generation failed: ${err.message || err}` }, { status: 500 })
  }

  // 5. Set headers and stream
  let billToSlug = 'walk-in'
  if (quote.partners) {
    billToSlug = safeName(quote.partners.store_name || quote.partners.owner_name, 'partner')
  } else if (quote.walk_in_name) {
    billToSlug = safeName(quote.walk_in_name, 'walk-in')
  }

  const filename = `Shewah-Quote-${quote.quote_number}-${billToSlug}.pdf`
  const disposition = isDownload ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
