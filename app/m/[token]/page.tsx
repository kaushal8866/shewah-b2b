import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { AlertTriangle, Download, Diamond, FileDown, Clock } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d }
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

export default async function KarigarAssetPage({ params }: { params: { token: string } }) {
  const token = params.token

  const { data: link } = await supabaseAdmin
    .from('mfg_share_links')
    .select('token, manufacturing_order_id, expires_at, revoked, download_count, last_accessed_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) {
    return <ErrorPage title="Link not found" message="This link is invalid or has been removed. Please contact Shewah." />
  }
  if (link.revoked) {
    return <ErrorPage title="Link revoked" message="This link has been revoked by Shewah. Please contact us for a fresh link." />
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return <ErrorPage title="Link expired" message="This 48-hour link has expired. Please contact Shewah for a fresh one." />
  }

  // Best-effort access stamp (the zip download bumps download_count too).
  await supabaseAdmin
    .from('mfg_share_links')
    .update({ last_accessed_at: new Date().toISOString() } as any)
    .eq('token', token)
    .then(() => {}, () => {})

  const { data: order } = await supabaseAdmin
    .from('manufacturing_orders')
    .select('order_number, description, quantity, ring_size, gold_karat, gold_weight_required, diamond_weight, special_notes, expected_date, reference_images, cad_files, cad_file_names, manufacturing_partners(name, city)')
    .eq('id', link.manufacturing_order_id)
    .maybeSingle()

  if (!order) {
    return <ErrorPage title="Order not found" message="The order this link points to could not be loaded." />
  }

  const o = order as any
  const partner = o.manufacturing_partners as { name?: string } | null
  const refs: string[] = o.reference_images || []
  const cads: string[] = o.cad_files || []
  const cadNames: string[] = o.cad_file_names || []
  const hasAssets = refs.length > 0 || cads.length > 0

  const zipUrl = `/api/m/${token}/zip`

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
              <p className="text-stone-400 text-xs">Manufacturing pack</p>
            </div>
          </div>
          <h1 className="text-white text-2xl font-semibold">{o.order_number}</h1>
          {partner?.name && (
            <p className="text-stone-400 text-sm mt-0.5">For {partner.name}</p>
          )}
          <p className="text-stone-500 text-xs mt-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {relExpiry(link.expires_at)}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Spec card */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
          <h2 className="text-white text-sm font-medium mb-4 uppercase tracking-wider text-[#B7C8DD]">Order spec</h2>
          {o.description && <p className="text-stone-200 text-sm mb-4 whitespace-pre-wrap">{o.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-5 text-sm">
            {[
              ['Quantity', o.quantity],
              ['Ring size', o.ring_size || '—'],
              ['Gold karat', o.gold_karat ? `${o.gold_karat}K` : '—'],
              ['Gold weight needed', o.gold_weight_required ? `${o.gold_weight_required}g` : '—'],
              ['Diamond weight', o.diamond_weight ? `${o.diamond_weight}ct` : '—'],
              ['Expected by', fmtDate(o.expected_date)],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs text-stone-500">{k}</p>
                <p className="text-stone-100 mt-0.5">{String(v)}</p>
              </div>
            ))}
          </div>
          {o.special_notes && (
            <div className="mt-4 pt-4 border-t border-stone-800">
              <p className="text-xs text-[#B7C8DD] uppercase tracking-wider mb-1">Special instructions</p>
              <p className="text-stone-200 text-sm whitespace-pre-wrap">{o.special_notes}</p>
            </div>
          )}
        </div>

        {/* Download all */}
        {hasAssets && (
          <a href={zipUrl}
             className="flex items-center justify-center gap-2 w-full bg-[#1E3A5F] hover:bg-[#162B47] text-white py-3.5 rounded-2xl text-sm font-semibold transition-colors">
            <Download className="w-4 h-4" />
            Download all as ZIP ({refs.length + cads.length} file{refs.length + cads.length === 1 ? '' : 's'})
          </a>
        )}

        {/* CAD files */}
        {cads.length > 0 && (
          <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
            <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-[#B7C8DD]">CAD / STL files</h2>
            <ul className="divide-y divide-stone-800">
              {cads.map((url, i) => {
                const name = cadNames[i] || `file-${i + 1}`
                return (
                  <li key={url + i} className="py-3 flex items-center gap-3">
                    <FileDown className="w-4 h-4 text-stone-500 shrink-0" />
                    <span className="flex-1 text-sm text-stone-200 truncate">{name}</span>
                    <a href={url} download={name} target="_blank" rel="noreferrer"
                      className="text-xs bg-stone-800 hover:bg-stone-700 text-white px-3 py-1.5 rounded-lg font-medium">
                      Download
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Reference images */}
        {refs.length > 0 && (
          <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5">
            <h2 className="text-white text-sm font-medium mb-3 uppercase tracking-wider text-[#B7C8DD]">Reference images</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {refs.map((url, i) => (
                <a key={url + i} href={url} target="_blank" rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-stone-800 block bg-stone-800">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {!hasAssets && (
          <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 text-center text-stone-400 text-sm">
            No assets attached to this order yet.
          </div>
        )}

        <p className="text-center text-stone-600 text-xs pt-2">
          This link is private and will expire on {fmtDate(link.expires_at)}.
        </p>
      </div>
    </div>
  )
}
