import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { JOURNEY_STAGES, deriveCurrentStage, stageIndex, type JourneyStageKey } from '@/lib/consumerTheme'
import { Diamond, Phone, MessageCircle, Check, Truck, Sparkles, Clock, Camera } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Narrow row shapes for the DB reads on this page. Supabase's typed
// client doesn't infer joined relations cleanly, so we keep tight local
// types and cast once at the boundary.
type LinkRow = {
  token: string
  customer_id: string
  order_id: string | null
  enquiry_id: string | null
  expires_at: string
  revoked_at: string | null
}
type CustomerRow = { id: string; full_name: string | null; city: string | null }
type ProductRow = { name: string | null; code: string | null; image_urls: string[] | null }
type OrderRow = {
  id: string
  order_number: string | null
  status: string | null
  order_date: string | null
  expected_delivery: string | null
  expected_delivery_date: string | null
  actual_delivery: string | null
  dispatch_date: string | null
  courier: string | null
  tracking_number: string | null
  ring_size: string | null
  quantity: number | null
  gold_karat: number | null
  audience: string | null
  customer_id: string | null
  updated_at?: string | null
  products: ProductRow | ProductRow[] | null
}
type ProductionUpdateRow = {
  id: string
  title: string
  body: string | null
  photo_url: string | null
  created_at: string
}
type CadRevisionRow = {
  image_urls: string[] | null
  is_approved: boolean | null
  approved_at: string | null
  created_at: string
}
type SettingsRow = { key: string; value: string | null }

function pickProduct(p: OrderRow['products']): ProductRow | null {
  if (!p) return null
  return Array.isArray(p) ? (p[0] || null) : p
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(d) }
}
function fmtRelative(d: string | null | undefined): string {
  if (!d) return ''
  const t = new Date(d).getTime()
  const diff = Date.now() - t
  const day = 86400000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function ErrorPage({ title, message, contact }: { title: string; message: string; contact?: { whatsapp: string | null } }) {
  const wa = contact?.whatsapp
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#E8D6AC] flex items-center justify-center mb-5">
          <Diamond className="w-6 h-6 text-[#A88A4F]" />
        </div>
        <h1 className="serif text-3xl text-[#2A241B] mb-3">{title}</h1>
        <p className="text-[#5C5347] text-base leading-relaxed mb-6">{message}</p>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            className="inline-flex items-center gap-2 bg-[#C9A86A] hover:bg-[#A88A4F] text-white font-medium px-5 py-3 rounded-full transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> Chat with Shewah
          </a>
        )}
      </div>
    </div>
  )
}

// Each failure kind is its own member. Collapsing them into a single member
// with a union-typed `kind` prevents TypeScript from eliminating that member
// after the three guards below, so the `ok` fields never narrowed.
type LoadResult =
  | { kind: 'not_found' }
  | { kind: 'revoked' }
  | { kind: 'expired' }
  | {
      kind: 'ok'
      link: LinkRow
      customer: CustomerRow
      order: OrderRow | null
      productionUpdates: ProductionUpdateRow[]
      cad: { images: string[]; approvedAt: string | null } | null
      contact: { whatsapp: string | null; phone: string | null }
    }

async function loadPayload(token: string): Promise<LoadResult> {
  const linkRes = await supabaseAdmin
    .from('customer_journey_links')
    .select('token, customer_id, order_id, enquiry_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  const link = linkRes.data as LinkRow | null

  if (!link) return { kind: 'not_found' }
  if (link.revoked_at) return { kind: 'revoked' }
  if (new Date(link.expires_at).getTime() < Date.now()) return { kind: 'expired' }

  // Stamp visit (best-effort; function is SECURITY DEFINER).
  const stamp = await supabaseAdmin.rpc('customer_journey_record_visit', { p_token: token })
  if (stamp.error) console.error('[journey] record_visit failed', stamp.error)

  const [customerRes, orderRes] = await Promise.all([
    supabaseAdmin.from('customers').select('id, full_name, city').eq('id', link.customer_id).maybeSingle(),
    link.order_id
      ? supabaseAdmin.from('orders').select(`
          id, order_number, status, order_date, expected_delivery, expected_delivery_date,
          actual_delivery, dispatch_date, courier, tracking_number, ring_size, quantity,
          gold_karat, audience, customer_id, updated_at,
          products(name, code, image_urls)
        `).eq('id', link.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const customer = customerRes.data as CustomerRow | null
  const order = (orderRes.data as OrderRow | null) || null
  if (!customer) return { kind: 'not_found' }

  let productionUpdates: ProductionUpdateRow[] = []
  if (order?.id) {
    const { data } = await supabaseAdmin
      .from('production_updates')
      .select('id, title, body, photo_url, created_at')
      .eq('order_id', order.id)
      .eq('is_customer_visible', true)
      .order('created_at', { ascending: false })
    productionUpdates = (data as ProductionUpdateRow[] | null) || []
  }

  let cad: { images: string[]; approvedAt: string | null } | null = null
  if (order?.id) {
    const { data: cads } = await supabaseAdmin
      .from('cad_requests').select('id').eq('order_id', order.id)
      .order('created_at', { ascending: false }).limit(1)
    const cadId = (cads as { id: string }[] | null)?.[0]?.id
    if (cadId) {
      const { data: revsData } = await supabaseAdmin
        .from('cad_revisions')
        .select('image_urls, is_approved, approved_at, created_at')
        .eq('cad_request_id', cadId)
        .order('created_at', { ascending: false })
        .limit(5)
      const revs = (revsData as CadRevisionRow[] | null) || []
      if (revs.length) {
        const approved = revs.find(r => r.is_approved) || null
        const chosen = approved || revs[0]
        cad = { images: chosen.image_urls || [], approvedAt: approved ? approved.approved_at : null }
      }
    }
  }

  // Operator contact (settings; falls back to env on the contact card).
  const { data: contactData } = await supabaseAdmin
    .from('settings').select('key, value')
    .in('key', ['lead_notify_whatsapp_to', 'shewah_contact_phone'])
  const contactRows = (contactData as SettingsRow[] | null) || []
  const cmap: Record<string, string> = {}
  for (const r of contactRows) cmap[r.key] = (r.value || '').toString().trim()
  const wa = (cmap['lead_notify_whatsapp_to'] || '').replace(/\D/g, '') || null
  const phone = cmap['shewah_contact_phone'] || wa

  return {
    kind: 'ok',
    link,
    customer,
    order,
    productionUpdates,
    cad,
    contact: { whatsapp: wa, phone },
  }
}

function Timeline({ stages, currentKey, datesByStage }: {
  stages: typeof JOURNEY_STAGES
  currentKey: JourneyStageKey
  datesByStage: Partial<Record<JourneyStageKey, string>>
}) {
  const cur = stageIndex(currentKey)
  return (
    <ol className="space-y-0">
      {stages.map((s, i) => {
        const done = i < cur
        const active = i === cur
        const date = datesByStage[s.key]
        const isLast = i === stages.length - 1
        return (
          <li key={s.key} className="flex items-stretch gap-4">
            <div className="flex flex-col items-center">
              <div className={[
                'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all',
                done ? 'bg-[#C9A86A] text-white' :
                active ? 'bg-white text-[#A88A4F] ring-2 ring-[#C9A86A] stage-glow' :
                'bg-[#F4ECDD] text-[#8C8275] ring-1 ring-[#E8DFC9]',
              ].join(' ')}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-6 mt-1 mb-1 ${done ? 'bg-[#C9A86A]/60' : 'bg-[#E8DFC9]'}`} />
              )}
            </div>
            <div className={`${isLast ? 'pb-0' : 'pb-5'} pt-1.5 flex-1`}>
              <p className={`serif text-lg leading-tight ${
                active ? 'text-[#2A241B]' : done ? 'text-[#5C5347]' : 'text-[#8C8275]'
              }`}>
                {s.label}
                {active && (
                  <span className="ml-2 align-middle text-[10px] tracking-widest font-sans uppercase bg-[#E8D6AC] text-[#A88A4F] px-2 py-0.5 rounded-full">
                    Now
                  </span>
                )}
              </p>
              {date && <p className="text-xs text-[#8C8275] mt-0.5 tracking-wider uppercase">{fmtDate(date)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default async function CustomerJourneyPage({ params }: { params: { token: string } }) {
  const r = await loadPayload(params.token)

  if (r.kind === 'not_found') {
    return <ErrorPage title="Link not found" message="This link is invalid or has been removed. Please reach out to us if you think this is a mistake." />
  }
  if (r.kind === 'revoked') {
    return <ErrorPage title="Link no longer active" message="This link has been retired. Tap below to chat with us — we'll send you a fresh one." />
  }
  if (r.kind === 'expired') {
    return <ErrorPage title="Link expired" message="This link has expired. Tap below to chat with us — we'll send you a fresh one." />
  }

  const { customer, order, productionUpdates, cad, contact } = r
  const firstName = (customer.full_name || '').split(/\s+/)[0] || 'there'

  const currentKey = deriveCurrentStage({
    hasOrder: !!order,
    orderStatus: order?.status,
    hasQuote: false, // quote module not built yet (Task #115)
    hasApprovedCad: !!cad?.approvedAt,
  })

  const datesByStage: Partial<Record<JourneyStageKey, string>> = {
    enquiry_received: order?.order_date || undefined,
    quote_shared: undefined,
    design_approved: cad?.approvedAt || undefined,
    in_production: order?.status === 'production' ? (order?.updated_at || undefined) : undefined,
    quality_check: order?.status === 'qc' ? (order?.updated_at || undefined) : undefined,
    dispatched: order?.dispatch_date || undefined,
    delivered: order?.actual_delivery || undefined,
  }

  const product = pickProduct(order?.products ?? null)
  const heroImage = cad?.images?.[0] || (product?.image_urls?.[0] ?? null) || (productionUpdates.find(u => u.photo_url)?.photo_url) || null
  const waNumber = contact.whatsapp
  const phoneNumber = contact.phone

  return (
    <main className="pb-32 md:pb-16">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="px-5 pt-6 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#C9A86A] flex items-center justify-center">
            <Diamond className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="serif text-xl text-[#2A241B] leading-none">Shewah</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#A88A4F] mt-1">Fine Jewellery</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 space-y-8">
        {/* ── Hero greeting ───────────────────────────────── */}
        <section>
          {heroImage ? (
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-[#F4ECDD] mb-6 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt="Your custom piece" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-[#E8D6AC] via-[#F4ECDD] to-[#FBF7F0] mb-6 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-[#A88A4F]/60" />
            </div>
          )}
          <h1 className="serif text-4xl md:text-5xl text-[#2A241B] leading-tight">
            Hi {firstName},<br />
            <span className="text-[#A88A4F]">here's your piece.</span>
          </h1>
          {order?.order_number && (
            <p className="text-[#5C5347] text-sm mt-3">Order {order.order_number}</p>
          )}
        </section>

        {/* ── Journey timeline ────────────────────────────── */}
        <section className="bg-white rounded-3xl border border-[#E8DFC9] p-6 shadow-sm">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="serif text-2xl text-[#2A241B]">Your journey</h2>
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#A88A4F]">Step {stageIndex(currentKey) + 1} of {JOURNEY_STAGES.length}</span>
          </div>
          <Timeline stages={JOURNEY_STAGES} currentKey={currentKey} datesByStage={datesByStage} />
        </section>

        {/* ── Quote placeholder (until Task #115 ships) ──── */}
        <section className="bg-white rounded-3xl border border-[#E8DFC9] p-6 shadow-sm">
          <h2 className="serif text-2xl text-[#2A241B] mb-2">Your quote</h2>
          <p className="text-[#5C5347] text-sm leading-relaxed">
            Your personalised quote will appear here as soon as it's ready. We'll send you a WhatsApp the moment it's shared.
          </p>
        </section>

        {/* ── Design preview (read-only — approval happens with your designer) ── */}
        {cad && cad.images.length > 0 && (
          <section className="bg-white rounded-3xl border border-[#E8DFC9] p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="serif text-2xl text-[#2A241B]">Design preview</h2>
              {cad.approvedAt && (
                <span className="text-[11px] tracking-wider uppercase bg-[#E8F1E2] text-[#5C7F5F] px-2.5 py-1 rounded-full">
                  Approved {fmtDate(cad.approvedAt)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cad.images.slice(0, 4).map((url, i) => (
                <a key={url + i} href={url} target="_blank" rel="noreferrer"
                   className="aspect-square rounded-2xl overflow-hidden bg-[#F4ECDD] block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Design ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
            {!cad.approvedAt && (
              <p className="text-xs text-[#8C8275] mt-4 leading-relaxed">
                Reach out on WhatsApp to share feedback or approve the design.
              </p>
            )}
          </section>
        )}

        {/* ── Production updates ──────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4 px-1">
            <h2 className="serif text-2xl text-[#2A241B]">Workshop updates</h2>
            {productionUpdates.length > 0 && (
              <span className="text-xs text-[#8C8275]">{productionUpdates.length} {productionUpdates.length === 1 ? 'update' : 'updates'}</span>
            )}
          </div>
          {productionUpdates.length === 0 ? (
            <div className="bg-white/70 rounded-3xl border border-dashed border-[#E8DFC9] p-8 text-center">
              <Camera className="w-8 h-8 text-[#A88A4F]/50 mx-auto mb-3" />
              <p className="text-[#5C5347] text-sm leading-relaxed">
                Updates from our workshop will appear here as your piece comes to life.
              </p>
            </div>
          ) : (
            <ol className="space-y-4">
              {productionUpdates.map(u => (
                <li key={u.id} className="bg-white rounded-3xl border border-[#E8DFC9] overflow-hidden shadow-sm">
                  {u.photo_url && (
                    <div className="aspect-[4/3] bg-[#F4ECDD]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u.photo_url} alt={u.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-[#A88A4F] flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {fmtRelative(u.created_at)}
                      </p>
                    </div>
                    <h3 className="serif text-xl text-[#2A241B] mb-1.5 leading-tight">{u.title}</h3>
                    {u.body && (
                      <p className="text-[#5C5347] text-sm leading-relaxed whitespace-pre-wrap">{u.body}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Dispatch tracking ───────────────────────────── */}
        {order && (order.dispatch_date || order.courier || order.tracking_number) && (
          <section className="bg-[#F4ECDD] rounded-3xl border border-[#E8DFC9] p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Truck className="w-5 h-5 text-[#A88A4F]" />
              <h2 className="serif text-2xl text-[#2A241B]">On its way</h2>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-5 text-sm">
              {order.dispatch_date && (
                <div>
                  <dt className="text-[10px] tracking-widest uppercase text-[#8C8275] mb-0.5">Dispatched</dt>
                  <dd className="text-[#2A241B]">{fmtDate(order.dispatch_date)}</dd>
                </div>
              )}
              {order.courier && (
                <div>
                  <dt className="text-[10px] tracking-widest uppercase text-[#8C8275] mb-0.5">Courier</dt>
                  <dd className="text-[#2A241B]">{order.courier}</dd>
                </div>
              )}
              {order.tracking_number && (
                <div className="col-span-2">
                  <dt className="text-[10px] tracking-widest uppercase text-[#8C8275] mb-0.5">Tracking number</dt>
                  <dd className="text-[#2A241B] font-mono text-base">{order.tracking_number}</dd>
                </div>
              )}
              {order.expected_delivery && !order.actual_delivery && (
                <div>
                  <dt className="text-[10px] tracking-widest uppercase text-[#8C8275] mb-0.5">Expected delivery</dt>
                  <dd className="text-[#2A241B]">{fmtDate(order.expected_delivery)}</dd>
                </div>
              )}
              {order.actual_delivery && (
                <div>
                  <dt className="text-[10px] tracking-widest uppercase text-[#8C8275] mb-0.5">Delivered</dt>
                  <dd className="text-[#2A241B]">{fmtDate(order.actual_delivery)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* ── Footer / contact ────────────────────────────── */}
        <footer className="pt-6 pb-2 text-center">
          <p className="serif text-xl text-[#2A241B] mb-2">Have a question?</p>
          <p className="text-[#5C5347] text-sm mb-5 leading-relaxed">
            We're here every step of the way. Tap to reach us.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {waNumber && (
              <a href={`https://wa.me/${waNumber}`}
                 className="inline-flex items-center gap-2 bg-[#C9A86A] hover:bg-[#A88A4F] text-white font-medium px-5 py-3 rounded-full transition-colors text-sm">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {phoneNumber && (
              <a href={`tel:${phoneNumber}`}
                 className="inline-flex items-center gap-2 bg-white hover:bg-[#F4ECDD] border border-[#E8DFC9] text-[#2A241B] font-medium px-5 py-3 rounded-full transition-colors text-sm">
                <Phone className="w-4 h-4" /> Call us
              </a>
            )}
          </div>
          <p className="mt-8 text-[10px] tracking-[0.25em] uppercase text-[#A88A4F]">Shewah · Fine Jewellery</p>
        </footer>
      </div>

      {/* ── Sticky bottom contact bar (mobile only) ──────── */}
      {(waNumber || phoneNumber) && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E8DFC9] px-4 py-3 safe-area-pb z-40">
          <div className="max-w-2xl mx-auto flex gap-2">
            {waNumber && (
              <a href={`https://wa.me/${waNumber}`}
                 className="flex-1 inline-flex items-center justify-center gap-2 bg-[#C9A86A] text-white font-medium py-3 rounded-full text-sm">
                <MessageCircle className="w-4 h-4" /> Chat
              </a>
            )}
            {phoneNumber && (
              <a href={`tel:${phoneNumber}`}
                 className="flex-1 inline-flex items-center justify-center gap-2 bg-[#F4ECDD] text-[#2A241B] font-medium py-3 rounded-full text-sm border border-[#E8DFC9]">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
