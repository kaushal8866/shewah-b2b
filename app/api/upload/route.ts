import { NextRequest, NextResponse } from 'next/server'

const IMAGE_EXTS = new Set(['png','jpg','jpeg','webp','gif','heic','heif','avif','svg'])

function pickResourceType(filename: string): 'image' | 'raw' {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return IMAGE_EXTS.has(ext) ? 'image' : 'raw'
}

export async function POST(req: NextRequest) {
  const CLOUD_NAME =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  const UPLOAD_PRESET =
    process.env.CLOUDINARY_UPLOAD_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return NextResponse.json(
      { error: 'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.' },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
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

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: upload }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } }).error?.message || `Cloudinary error (${res.status})`
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const data = await res.json() as { secure_url: string; original_filename?: string; format?: string }
  return NextResponse.json({
    url: data.secure_url,
    filename: file.name || data.original_filename || 'file',
    resource_type: resourceType,
  })
}
