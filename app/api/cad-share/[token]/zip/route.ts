import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
    return ALLOWED_HOST_SUFFIXES.some(s => s.startsWith('.') ? host.endsWith(s) : host === s)
  } catch { return false }
}

export async function GET(_: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token

  const { data: link } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, cad_request_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if ((link as any).revoked_at) return NextResponse.json({ error: 'Link revoked' }, { status: 410 })
  if (new Date((link as any).expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const { data: cad } = await supabaseAdmin
    .from('cad_requests')
    .select('request_number, reference_images')
    .eq('id', (link as any).cad_request_id)
    .maybeSingle()

  if (!cad) return NextResponse.json({ error: 'CAD request not found' }, { status: 404 })

  const refs: string[] = (cad as any).reference_images || []
  const zip = new JSZip()
  const root = zip.folder(safeName((cad as any).request_number || 'cad-brief', 'cad-brief')) || zip
  const imgs = root.folder('reference-images')!

  await Promise.all(refs.map(async (url, i) => {
    try {
      if (!isAllowedAssetUrl(url)) return
      const res = await fetch(url)
      if (!res.ok) return
      const buf = Buffer.from(await res.arrayBuffer())
      const padded = String(i + 1).padStart(2, '0')
      const original = urlBasename(url, `image-${padded}.jpg`)
      // Prefix with sequence so the partner sees them in the same order
      // they appear on the brief page.
      imgs.file(`${padded}-${original}`, buf)
    } catch { /* skip individual failures */ }
  }))

  const blob = await zip.generateAsync({ type: 'nodebuffer' })
  const filename = `${safeName((cad as any).request_number || 'cad-brief', 'cad-brief')}-references.zip`
  return new NextResponse(new Uint8Array(blob), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
