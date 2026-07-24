import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { toResponseBody } from '@/lib/pdfHelpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function safeName(s: string, fallback: string): string {
  const cleaned = (s || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
  return cleaned || fallback
}

function urlBasename(url: string, fallback: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').pop() || ''
    return safeName(decodeURIComponent(last), fallback)
  } catch {
    return fallback
  }
}

// SSRF guard: only allow https URLs whose host is on the asset-CDN allowlist.
// Reference image / CAD URLs are user-writable in app flows, so unrestricted
// server-side fetches would let a caller probe internal services.
const ALLOWED_HOST_SUFFIXES = [
  '.cloudinary.com',
  'res.cloudinary.com',
  '.supabase.co',
  '.supabase.in',
]
function isAllowedAssetUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return ALLOWED_HOST_SUFFIXES.some(s =>
      s.startsWith('.') ? host.endsWith(s) : host === s
    )
  } catch {
    return false
  }
}

export async function GET(_: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token

  const { data: link } = await supabaseAdmin
    .from('mfg_share_links')
    .select('token, manufacturing_order_id, expires_at, revoked')
    .eq('token', token)
    .maybeSingle()

  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if (link.revoked) return NextResponse.json({ error: 'Link revoked' }, { status: 410 })
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const { data: order } = await supabaseAdmin
    .from('manufacturing_orders')
    .select('order_number, reference_images, cad_files, cad_file_names')
    .eq('id', link.manufacturing_order_id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const zip = new JSZip()
  const root = zip.folder(safeName(order.order_number || 'order', 'order')) || zip

  // Reference images
  const refs = (order.reference_images as string[]) || []
  if (refs.length) {
    const refFolder = root.folder('reference-images')!
    await Promise.all(refs.map(async (url, i) => {
      try {
        if (!isAllowedAssetUrl(url)) return
        const res = await fetch(url)
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        const name = urlBasename(url, `image-${i + 1}.jpg`)
        refFolder.file(name, buf)
      } catch { /* skip individual failures */ }
    }))
  }

  // CAD / STL / PDF files — use the original filename when we have it.
  const cads = (order.cad_files as string[]) || []
  const cadNames = (order.cad_file_names as string[]) || []
  if (cads.length) {
    const cadFolder = root.folder('cad-files')!
    await Promise.all(cads.map(async (url, i) => {
      try {
        if (!isAllowedAssetUrl(url)) return
        const res = await fetch(url)
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        const name = safeName(cadNames[i] || '', '') || urlBasename(url, `file-${i + 1}.bin`)
        cadFolder.file(name, buf)
      } catch { /* skip */ }
    }))
  }

  const blob = await zip.generateAsync({ type: 'nodebuffer' })

  // Atomic increment via Postgres function — avoids the read-then-write race
  // where two parallel downloads collapse to a single increment.
  const bump = await supabaseAdmin.rpc('mfg_share_link_record_download', { p_token: token })
  if (bump.error) {
    // Don't block the download, but log so failed analytics are noticed.
    console.error('mfg_share_link_record_download failed', bump.error)
  }

  const filename = `${safeName(order.order_number || 'order', 'order')}.zip`
  return new NextResponse(toResponseBody(blob), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
