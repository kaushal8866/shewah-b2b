import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { renderQuotePdf } from '@/lib/quotePdf'
import { safeName } from '@/lib/pdfHelpers'

export const dynamic = 'force-dynamic'

// GET /api/quotes/[id]/pdf
// Admin-gated endpoint that streams the generated quotation PDF.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const id = params.id
  const { searchParams } = new URL(req.url)
  const isDownload = searchParams.get('download') === '1'

  // 1. Fetch quote header
  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('*, partners(owner_name, store_name, city, phone), prepared_by_user:app_users!prepared_by(display_name, username, signature_url)')
    .eq('id', id)
    .maybeSingle()

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // 2. Fetch quote items sorted by position
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // 2b. Build shape_id → name lookup to backfill shape_name for older diamond rows
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
          shape_name: d.shape_name || (d.shape_id ? shapeMap[d.shape_id] : null) || null,
        }))
      : [],
  }))

  // 3. Generate PDF Buffer
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderQuotePdf(quote as any, patchedItems as any[])
  } catch (err: any) {
    return NextResponse.json({ error: `PDF generation failed: ${err.message || err}` }, { status: 500 })
  }

  // 4. Set headers and stream
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
