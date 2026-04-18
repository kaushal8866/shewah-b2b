import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { AlertTriangle, Diamond, Clock, FileDown, Download, CheckCircle2, AlertOctagon } from 'lucide-react'
import RespondPanel from './RespondPanel'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(d) }
}

function relExpiry(expires: string): string {
  const ms = new Date(expires).getTime() - Date.now()
  if (ms < 0) return 'expired'
  const h = Math.floor(ms / (60 * 60 * 1000))
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min remaining`
  if (h < 24) return `${h} hr remaining`
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) === 1 ? '' : 's'} remaining`
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center text-stone-400 max-w-sm">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-stone-600" />
        <h1 className="text-white text-lg font-semibold mb-2">{title}</h1>
        <p className="text-sm">{message}</p>
      </div>
    </div>
  )
}

export default async function CadPartnerSharePage({ params }: { params: { token: string } }) {
  const token = params.token

  const { data: link } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, cad_request_id, expires_at, revoked_at, partner_name, last_opened_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) return <ErrorPage title="Link not found" message="This link is invalid or has been removed. Please contact Shewah." />
  if ((link as any).revoked_at) return <ErrorPage title="Link revoked" message="This link has been revoked by Shewah. Please contact us for a fresh link." />
  if (new Date((link as any).expires_at).getTime() < Date.now()) {
    return <ErrorPage title="Link expired" message="This handoff link has expired. Please contact Shewah for a fresh one." />
  }

  // Stamp last_opened_at (atomic).
  const stamp = await supabaseAdmin.rpc('cad_partner_share_record_visit', { p_token: token })
  if (stamp.error) console.error('cad_partner_share_record_visit failed', stamp.error)

  const { data: cad } = await supabaseAdmin
    .from('cad_requests')
    .select(`
      id, request_number, brief_text, special_requests,
      diamond_shape, diamond_weight, gold_karat, setting_type,
      received_date, due_date, reference_images, status,
      partners(store_name, owner_name, city),
      orders(order_number, quantity, ring_size)
    `)
    .eq('id', (link as any).cad_request_id)
    .maybeSingle()

  if (!cad) return <ErrorPage title="Brief not found" message="The CAD brief this link points to could not be loaded." />

  const c = cad as any
  const refs: string[] = c.reference_images || []
  const partner = (c.partners as any) || {}
  const order = (c.orders as any) || {}

  // Latest partner response (if any) — show on the page so refreshing after
  // submit confirms the action stuck.
  const { data: latest } = await supabaseAdmin
    .from('cad_partner_responses')
    .select('decision, comment, responded_at, partner_name')
    .eq('link_id', token)
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const zipUrl = `/api/cad-share/${token}/zip`
  const pdfUrl = `/api/cad-share/${token}/pdf`

  const specs: [string, string][] = [
    ['Quantity', order.quantity != null ? String(order.quantity) : '—'],
    ['Ring size', order.ring_size || '—'],
    ['Diamond shape', c.diamond_shape || '—'],
    ['Diamond weight', c.diamond_weight || '—'],
    ['Gold karat', c.gold_karat ? `${c.gold_karat}K` : '—'],
    ['Setting type', c.setting_type || '—'],
    ['Due date', fmtDate(c.due_date)],
    ['Received', fmtDate(c.received_date)],
  ]

  return (
    <div className="min-h-screen bg-stone-950 pb-12 text-stone-100">
      <div className="bg-stone-900 border-b border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A5F] flex items-center justify-center shrink-0">
              <Diamond className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[#B7C8DD] text-xs font-medium tracking-wider uppercase">Shewah Jewellery</p>
              <p className="text-stone-400 text-xs">CAD partner brief</p>
            </div>
          </div>
          <h1 className="text-white text-2xl font-semibold">{c.request_number}</h1>
          {(link as any).partner_name && (
            <p className="text-stone-400 text-sm mt-0.5">For {(link as any).partner_name}</p>
          )}
          {partner.store_name && (
            <p className="text-stone-500 text-xs mt-0.5">Retailer: {partner.store_name}{partner.city ? ` · ${partner.city}` : ''}</p>
          )}
          <p className="text-stone-500 text-xs mt-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {relExpiry((link as any).expires_at)}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Brief */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
          <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-[#B7C8DD]">Design brief</h2>
          <p className="text-stone-200 text-sm whitespace-pre-wrap leading-relaxed">
            {c.brief_text || 'No brief text provided.'}
          </p>
          {c.special_requests && (
            <div className="mt-4 pt-4 border-t border-stone-800">
              <p className="text-xs text-[#B7C8DD] uppercase tracking-wider mb-1">Special requests</p>
              <p className="text-stone-200 text-sm whitespace-pre-wrap leading-relaxed">{c.special_requests}</p>
            </div>
          )}
        </div>

        {/* Spec */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
          <h2 className="text-white text-sm font-medium mb-4 uppercase tracking-wider text-[#B7C8DD]">Spec</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-5 text-sm">
            {specs.map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-stone-500">{k}</p>
                <p className="text-stone-100 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Downloads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href={zipUrl}
             className="flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white py-3.5 rounded-2xl text-sm font-semibold transition-colors">
            <Download className="w-4 h-4" />
            Download all images (ZIP)
          </a>
          <a href={pdfUrl}
             className="flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-white py-3.5 rounded-2xl text-sm font-semibold transition-colors border border-stone-700">
            <FileDown className="w-4 h-4" />
            Download brief (PDF)
          </a>
        </div>

        {/* Reference images */}
        {refs.length > 0 && (
          <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
            <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-[#B7C8DD]">
              Reference images ({refs.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {refs.map((url, i) => (
                <a key={url + i} href={url} target="_blank" rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-stone-800 block bg-stone-800">
                  <img src={url} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Latest response indicator */}
        {latest && (
          <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
            (latest as any).decision === 'approved'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100'
              : 'bg-amber-950/40 border-amber-800 text-amber-100'
          }`}>
            {(latest as any).decision === 'approved'
              ? <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              : <AlertOctagon className="w-5 h-5 mt-0.5 shrink-0" />}
            <div className="text-sm">
              <p className="font-medium">
                You {(latest as any).decision === 'approved' ? 'approved' : 'requested a revision on'} this brief.
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Submitted {fmtDate((latest as any).responded_at)}{(latest as any).partner_name ? ` by ${(latest as any).partner_name}` : ''}
              </p>
              {(latest as any).comment && (
                <p className="text-sm mt-2 whitespace-pre-wrap">{(latest as any).comment}</p>
              )}
              <p className="text-xs opacity-70 mt-2">You can submit again below if you need to update your decision.</p>
            </div>
          </div>
        )}

        {/* Approve / request revision form */}
        <RespondPanel token={token} />

        <p className="text-center text-stone-600 text-xs pt-2">
          This link is private and will expire on {fmtDate((link as any).expires_at)}.
        </p>
      </div>
    </div>
  )
}
