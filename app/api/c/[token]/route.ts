/**
 * GET /api/c/[token]
 *
 * Public, no auth — validates the token, stamps a visit, returns the
 * payload that drives the customer journey page. All sensitive fields
 * (margin, COGS, internal notes, retailer identity) are filtered out
 * here, before the data ever reaches the client.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function publicError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const token = params.token
  if (!token || token.length < 10) return publicError(404, 'Link not found')

  const { data: link } = await supabaseAdmin
    .from('customer_journey_links')
    .select('token, customer_id, order_id, enquiry_id, expires_at, revoked_at, opened_count, last_opened_at, first_opened_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) return publicError(404, 'Link not found')
  if ((link as any).revoked_at) return publicError(410, 'This link is no longer active.')
  if (new Date((link as any).expires_at).getTime() < Date.now()) {
    return publicError(410, 'This link has expired.')
  }

  // Stamp visit (best-effort — never fails the request).
  const stamp = await supabaseAdmin.rpc('customer_journey_record_visit', { p_token: token })
  if (stamp.error) console.error('[journey] record_visit failed', stamp.error)

  const customerP = supabaseAdmin
    .from('customers')
    .select('id, full_name, city')
    .eq('id', (link as any).customer_id)
    .maybeSingle()

  const orderP = (link as any).order_id
    ? supabaseAdmin
        .from('orders')
        .select(`
          id, order_number, status, order_date, expected_delivery, expected_delivery_date,
          actual_delivery, dispatch_date, courier, tracking_number, ring_size, quantity,
          gold_karat, audience, customer_id,
          products(name, code, image_urls)
        `)
        .eq('id', (link as any).order_id)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const [{ data: customer }, { data: order }] = await Promise.all([customerP, orderP])
  if (!customer) return publicError(404, 'Link not found')

  // Production updates — visible only.
  let updates: any[] = []
  if ((link as any).order_id) {
    const { data: u } = await supabaseAdmin
      .from('production_updates')
      .select('id, title, body, photo_url, created_at')
      .eq('order_id', (link as any).order_id)
      .eq('is_customer_visible', true)
      .order('created_at', { ascending: false })
    updates = u || []
  }

  // CAD design preview — latest CAD revision images on any cad_request linked
  // to the order. This is a read-only preview (no approve flow on the public
  // side yet); the operator continues to drive design approval through the
  // existing CAD workflow.
  let cadImages: string[] = []
  let cadApprovedAt: string | null = null
  if ((link as any).order_id) {
    const { data: cads } = await supabaseAdmin
      .from('cad_requests')
      .select('id, status')
      .eq('order_id', (link as any).order_id)
      .order('created_at', { ascending: false })
      .limit(1)
    const cadId = cads?.[0]?.id
    if (cadId) {
      const { data: revs } = await supabaseAdmin
        .from('cad_revisions')
        .select('image_urls, is_approved, approved_at, created_at')
        .eq('cad_request_id', cadId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (revs && revs.length) {
        // Show the latest approved revision if any, else the latest one.
        const approved = revs.find((r: any) => r.is_approved)
        const chosen = approved || revs[0]
        cadImages = (chosen as any).image_urls || []
        cadApprovedAt = approved ? (approved as any).approved_at : null
      }
    }
  }

  // First-name only — privacy.
  const firstName = (customer.full_name || '').split(/\s+/)[0] || 'there'

  return NextResponse.json({
    token,
    expiresAt: (link as any).expires_at,
    customer: { firstName, city: customer.city || null },
    order: order ? {
      orderNumber: (order as any).order_number,
      status: (order as any).status,
      orderDate: (order as any).order_date,
      expectedDelivery: (order as any).expected_delivery_date || (order as any).expected_delivery,
      actualDelivery: (order as any).actual_delivery,
      dispatchDate: (order as any).dispatch_date,
      courier: (order as any).courier,
      trackingNumber: (order as any).tracking_number,
      ringSize: (order as any).ring_size,
      quantity: (order as any).quantity,
      goldKarat: (order as any).gold_karat,
      product: (order as any).products
        ? {
            name: (order as any).products.name,
            code: (order as any).products.code,
            heroImage: ((order as any).products.image_urls || [])[0] || null,
          }
        : null,
    } : null,
    cad: cadImages.length ? { images: cadImages, approvedAt: cadApprovedAt } : null,
    productionUpdates: updates,
    // Operator contact is read from settings (same fallbacks used elsewhere
    // in the app).
    contact: await loadContact(),
  })
}

async function loadContact(): Promise<{ whatsapp: string | null; phone: string | null }> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', ['lead_notify_whatsapp_to', 'shewah_contact_phone'])
  const map: Record<string, string> = {}
  for (const row of data || []) map[(row as any).key] = ((row as any).value || '').toString().trim()
  const wa = (map['lead_notify_whatsapp_to'] || '').replace(/\D/g, '') || null
  const phone = map['shewah_contact_phone'] || wa
  return { whatsapp: wa, phone }
}
