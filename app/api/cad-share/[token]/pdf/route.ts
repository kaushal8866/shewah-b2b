import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(d) }
}

function safeName(s: string, fallback: string): string {
  const cleaned = (s || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
  return cleaned || fallback
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    if (!isAllowedAssetUrl(url)) return null
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}

export async function GET(_: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token

  const { data: link } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, cad_request_id, expires_at, revoked_at, partner_name')
    .eq('token', token)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if ((link as any).revoked_at) return NextResponse.json({ error: 'Link revoked' }, { status: 410 })
  if (new Date((link as any).expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const { data: cad } = await supabaseAdmin
    .from('cad_requests')
    .select(`
      request_number, brief_text, special_requests,
      diamond_shape, diamond_weight, gold_karat, setting_type,
      received_date, due_date, reference_images,
      partners(id, city),
      orders(order_number, quantity, ring_size)
    `)
    .eq('id', (link as any).cad_request_id)
    .maybeSingle()
  if (!cad) return NextResponse.json({ error: 'CAD request not found' }, { status: 404 })

  const c = cad as any
  const refs: string[] = c.reference_images || []
  const partner = (c.partners as any) || {}
  const order = (c.orders as any) || {}

  // Pre-fetch images so we can stream them into the PDF synchronously.
  const images = await Promise.all(
    refs.slice(0, 24).map(async (url) => ({ url, buf: await fetchImage(url) })),
  )

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: {
    Title: `CAD brief — ${c.request_number}`,
    Author: 'Shewah Jewellery',
  }})

  const chunks: Buffer[] = []
  doc.on('data', (b: Buffer) => chunks.push(b))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // ── Header ────────────────────────────────────────────────
  doc.fillColor('#1E3A5F').fontSize(20).text('Shewah Jewellery', { continued: false })
  doc.fillColor('#666').fontSize(10).text('Production reference — CAD brief')
  doc.moveDown(0.4)
  doc.strokeColor('#1E3A5F').lineWidth(1).moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
  doc.moveDown(0.6)

  doc.fillColor('#111').fontSize(16).text(c.request_number)
  if (order.order_number) {
    doc.fillColor('#555').fontSize(10).text(`Order ${order.order_number}`)
  }
  if ((link as any).partner_name) {
    doc.fillColor('#555').fontSize(10).text(`For: ${(link as any).partner_name}`)
  }
  doc.moveDown(0.6)

  // ── Spec table ────────────────────────────────────────────
  // Anonymise the retailer to the CAD partner — show a derived reference
  // code instead of the store / owner name. The code is deterministic from the
  // partner's UUID so admins can trace it back internally without leaking the
  // retailer's identity to the external CAD vendor.
  const partnerRef = partner.id
    ? `SH-PTR-${String(partner.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
    : '—'
  const rows: [string, string][] = [
    ['Partner ref', partnerRef],
    ['City', partner.city || '—'],
    ['Received', fmtDate(c.received_date)],
    ['Due date', fmtDate(c.due_date)],
    ['Quantity', order.quantity != null ? String(order.quantity) : '—'],
    ['Ring size', order.ring_size || '—'],
    ['Diamond shape', c.diamond_shape || '—'],
    ['Diamond weight', c.diamond_weight || '—'],
    ['Gold karat', c.gold_karat ? `${c.gold_karat}K` : '—'],
    ['Setting type', c.setting_type || '—'],
  ]

  const colW = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2
  const startX = doc.page.margins.left
  let rowY = doc.y
  doc.fillColor('#1E3A5F').fontSize(11).text('Specification', startX, rowY)
  rowY = doc.y + 4
  doc.strokeColor('#ddd').lineWidth(0.5).moveTo(startX, rowY).lineTo(doc.page.width - doc.page.margins.right, rowY).stroke()
  rowY += 6
  doc.fontSize(10)
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i]
    const right = rows[i + 1]
    doc.fillColor('#888').fontSize(8).text(left[0].toUpperCase(), startX, rowY)
    doc.fillColor('#111').fontSize(10).text(left[1], startX, rowY + 10, { width: colW - 12 })
    if (right) {
      doc.fillColor('#888').fontSize(8).text(right[0].toUpperCase(), startX + colW, rowY)
      doc.fillColor('#111').fontSize(10).text(right[1], startX + colW, rowY + 10, { width: colW - 12 })
    }
    rowY += 32
  }
  doc.y = rowY
  doc.moveDown(0.5)

  // ── Brief ─────────────────────────────────────────────────
  doc.fillColor('#1E3A5F').fontSize(11).text('Design brief')
  doc.moveDown(0.2)
  doc.fillColor('#111').fontSize(11).text(c.brief_text || 'No brief text provided.', { align: 'left' })
  doc.moveDown(0.5)

  if (c.special_requests) {
    doc.fillColor('#1E3A5F').fontSize(11).text('Special requests')
    doc.moveDown(0.2)
    doc.fillColor('#111').fontSize(11).text(c.special_requests, { align: 'left' })
    doc.moveDown(0.5)
  }

  // ── Reference image gallery ───────────────────────────────
  if (images.length > 0) {
    if (doc.y > doc.page.height - 240) doc.addPage()
    doc.fillColor('#1E3A5F').fontSize(11).text(`Reference images (${images.length})`)
    doc.moveDown(0.3)

    const cols = 3
    const gutter = 10
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const cellW = (pageW - gutter * (cols - 1)) / cols
    const cellH = cellW
    let col = 0
    let yStart = doc.y

    for (let i = 0; i < images.length; i++) {
      if (col === 0 && yStart + cellH + 24 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        yStart = doc.page.margins.top
      }
      const x = doc.page.margins.left + col * (cellW + gutter)
      const y = yStart
      doc.save()
      doc.roundedRect(x, y, cellW, cellH, 4).strokeColor('#ddd').lineWidth(0.5).stroke()
      const img = images[i]
      if (img.buf) {
        try {
          doc.image(img.buf, x + 2, y + 2, { fit: [cellW - 4, cellH - 4], align: 'center', valign: 'center' })
        } catch {
          doc.fontSize(8).fillColor('#999').text('image unavailable', x, y + cellH / 2 - 4, { width: cellW, align: 'center' })
        }
      } else {
        doc.fontSize(8).fillColor('#999').text('image unavailable', x, y + cellH / 2 - 4, { width: cellW, align: 'center' })
      }
      doc.restore()
      doc.fillColor('#666').fontSize(8).text(`Reference ${i + 1}`, x, y + cellH + 2, { width: cellW, align: 'center' })

      col += 1
      if (col >= cols) { col = 0; yStart += cellH + 22 }
    }
  }

  doc.end()
  const pdf = await done

  const filename = `${safeName(c.request_number || 'cad-brief', 'cad-brief')}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
