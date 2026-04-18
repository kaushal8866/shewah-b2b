import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB per file
const MAX_FILES_PER_REQUEST = 6

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'avif'])
const ALLOWED_RAW_EXTS = new Set(['stl', '3dm', 'step', 'stp', 'obj', 'pdf', 'zip', 'dwg'])

function pickResourceType(filename: string): 'image' | 'raw' | null {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ALLOWED_RAW_EXTS.has(ext)) return 'raw'
  return null
}

export async function POST(req: NextRequest, ctx: { params: { token: string } }) {
  const token = ctx.params.token

  // -- Validate token + load context ---------------------------------------
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

  const CLOUD_NAME =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const UPLOAD_PRESET =
    process.env.CLOUDINARY_UPLOAD_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return NextResponse.json(
      { error: 'File uploads are not configured. Please contact Shewah.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('file').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Please upload at most ${MAX_FILES_PER_REQUEST} files at a time.` },
      { status: 400 },
    )
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const ua = (req.headers.get('user-agent') || '').slice(0, 500)
  const partnerName = (link as any).partner_name || ''
  const cadRequestId = (link as any).cad_request_id

  const uploaded: Array<{
    id: string
    url: string
    filename: string
    resource_type: 'image' | 'raw'
    bytes: number
    uploaded_at: string
  }> = []
  const errors: string[] = []

  for (const file of files) {
    const filename = file.name || 'file'
    const resourceType = pickResourceType(filename)
    if (!resourceType) {
      errors.push(`${filename}: unsupported file type`)
      continue
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${filename}: file is larger than ${MAX_BYTES / (1024 * 1024)}MB`)
      continue
    }

    const upload = new FormData()
    upload.append('file', file)
    upload.append('upload_preset', UPLOAD_PRESET)
    upload.append('use_filename', 'true')
    upload.append('unique_filename', 'true')

    const cRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: 'POST', body: upload },
    )
    if (!cRes.ok) {
      const err = await cRes.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message
        || `upload failed (${cRes.status})`
      errors.push(`${filename}: ${msg}`)
      continue
    }
    const data = await cRes.json() as {
      secure_url: string
      bytes?: number
      original_filename?: string
    }

    const insert = await supabaseAdmin
      .from('cad_partner_uploads')
      .insert([{
        link_id: token,
        cad_request_id: cadRequestId,
        partner_name: partnerName || null,
        url: data.secure_url,
        filename,
        resource_type: resourceType,
        bytes: data.bytes ?? file.size,
        ip: ip || null,
        user_agent: ua || null,
      }])
      .select('id, url, filename, resource_type, bytes, uploaded_at')
      .single()
    if (insert.error) {
      errors.push(`${filename}: ${insert.error.message}`)
      continue
    }
    uploaded.push(insert.data as any)
  }

  if (uploaded.length > 0) {
    // Stamp last_opened_at as a side-effect of the upload too.
    await supabaseAdmin.rpc('cad_partner_share_record_visit', { p_token: token })

    // Append a single 'partner_upload' entry to the revision timeline so the
    // admin / retailer view shows the new files inline with the rest of the
    // conversation. We attach the URLs to render_images for the existing
    // timeline UI to render thumbnails for image uploads; non-image files are
    // listed as "Files" via the note body so they render as download links.
    const imageUrls = uploaded.filter(u => u.resource_type === 'image').map(u => u.url)
    const rawFiles = uploaded.filter(u => u.resource_type === 'raw')
    const noteAuthor = `CAD partner${partnerName ? ` — ${partnerName}` : ''}`
    const noteLines = [`${noteAuthor} uploaded ${uploaded.length} draft file${uploaded.length === 1 ? '' : 's'}.`]
    if (rawFiles.length > 0) {
      noteLines.push('Files:')
      for (const f of rawFiles) noteLines.push(`• ${f.filename} — ${f.url}`)
    }
    await supabaseAdmin.from('cad_revisions').insert({
      cad_request_id: cadRequestId,
      kind: 'partner_upload',
      author: 'admin',
      note: noteLines.join('\n'),
      render_images: imageUrls.length > 0 ? imageUrls : null,
    })
  }

  return NextResponse.json({
    ok: uploaded.length > 0,
    uploaded,
    errors,
  })
}

// List the uploads previously made through this token, so the partner sees
// what they've already attached when they reopen the share page.
export async function GET(_req: NextRequest, ctx: { params: { token: string } }) {
  const token = ctx.params.token
  const { data: link } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  if ((link as any).revoked_at) return NextResponse.json({ error: 'Link revoked' }, { status: 410 })

  const { data, error } = await supabaseAdmin
    .from('cad_partner_uploads')
    .select('id, url, filename, resource_type, bytes, uploaded_at')
    .eq('link_id', token)
    .order('uploaded_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ uploads: data || [] })
}
