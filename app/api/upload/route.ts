import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Allow up to ~25 MB uploads — needed for STEP/STL CAD exports and high-res
// retailer reference photos taken on phones (HEIC originals are easily 8-12 MB).
export const runtime = 'nodejs'
export const maxDuration = 60
const MAX_BYTES = 25 * 1024 * 1024

const IMAGE_EXTS = new Set(['png','jpg','jpeg','webp','gif','heic','heif','avif','svg'])

function pickResourceType(filename: string): 'image' | 'raw' {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return IMAGE_EXTS.has(ext) ? 'image' : 'raw'
}

type FailureMeta = {
  fileName?: string | null
  fileSize?: number | null
  fileType?: string | null
  source?: string | null
}

async function logFailure(
  statusCode: number,
  errorMessage: string,
  meta: FailureMeta,
) {
  try {
    const session = await getServerSession(authOptions).catch(() => null)
    const user = session?.user
    await supabaseAdmin.from('upload_errors').insert({
      user_id: user?.id ?? null,
      username: user?.username ?? null,
      user_role: user?.role ?? null,
      file_name: meta.fileName ?? null,
      file_size: meta.fileSize ?? null,
      file_type: meta.fileType ?? null,
      status_code: statusCode,
      error_message: errorMessage.slice(0, 1000),
      source: meta.source ?? null,
    })
  } catch (e) {
    // Logging must never break the user-facing response.
    console.error('[upload] failed to record upload_error:', e)
  }
}

export async function POST(req: NextRequest) {
  const CLOUD_NAME =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  const UPLOAD_PRESET =
    process.env.CLOUDINARY_UPLOAD_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    const msg = 'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.'
    await logFailure(500, msg, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    await logFailure(400, 'Invalid form data', {})
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const sourceHint = (formData.get('source') as string | null) || null

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    await logFailure(400, 'No file provided', { source: sourceHint })
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const meta: FailureMeta = {
    fileName: file.name || null,
    fileSize: file.size,
    fileType: file.type || null,
    source: sourceHint,
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    const msg = `File is too large (${mb} MB). Maximum size is 25 MB. Please compress or resize and try again.`
    await logFailure(413, msg, meta)
    return NextResponse.json({ error: msg }, { status: 413 })
  }
  if (file.size === 0) {
    await logFailure(400, 'File is empty.', meta)
    return NextResponse.json({ error: 'File is empty.' }, { status: 400 })
  }

  // Caller can override resource type, but default is auto-detected by extension.
  const requested = (formData.get('resource_type') as string | null) || ''
  const resourceType: 'image' | 'raw' =
    requested === 'image' || requested === 'raw'
      ? (requested as 'image' | 'raw')
      : pickResourceType(file.name || '')

  const upload = new FormData()
  upload.append('file', file)
  upload.append('upload_preset', UPLOAD_PRESET)
  // NOTE: `use_filename` / `unique_filename` are NOT allowed on unsigned
  // uploads (Cloudinary returns 400). The karigar ZIP route renames files
  // using `cad_file_names` and our API responses include the original
  // filename, so the asset URL itself doesn't need to carry the name.

  let res: Response
  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: 'POST', body: upload },
    )
  } catch (e: any) {
    console.error('[upload] network error:', e)
    const msg = 'Could not reach the image server. Please check your connection and try again.'
    await logFailure(502, `network error: ${e?.message || e}`, meta)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const rawMsg = (err as { error?: { message?: string } }).error?.message || ''
    console.error(`[upload] cloudinary ${res.status}:`, rawMsg, 'file=', file.name, 'size=', file.size)
    // Surface a clean message to the retailer. Cloudinary's own messages
    // (e.g. "File size too large", "Invalid image file") are user-friendly
    // enough to pass through, but fall back to a generic line if missing.
    const msg = rawMsg || `Upload failed (server returned ${res.status}). Please try again.`
    await logFailure(res.status, rawMsg || `cloudinary ${res.status}`, meta)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const data = await res.json() as { secure_url: string; original_filename?: string; format?: string }
  return NextResponse.json({
    url: data.secure_url,
    filename: file.name || data.original_filename || 'file',
    resource_type: resourceType,
  })
}
