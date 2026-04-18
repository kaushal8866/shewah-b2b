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
        const res = await fetch(url)
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        const name = safeName(cadNames[i] || '', '') || urlBasename(url, `file-${i + 1}.bin`)
        cadFolder.file(name, buf)
      } catch { /* skip */ }
    }))
  }

  const blob = await zip.generateAsync({ type: 'nodebuffer' })

  // Bump access stats. Best-effort; failures don't block the download.
  await supabaseAdmin
    .from('mfg_share_links')
    .update({
      last_accessed_at: new Date().toISOString(),
      download_count: ((link as any).download_count || 0) + 1,
    } as any)
    .eq('token', token)
    .then(() => {}, () => {})

  const filename = `${safeName(order.order_number || 'order', 'order')}.zip`
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
