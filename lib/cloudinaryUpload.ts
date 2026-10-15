// Uploads via the server-side /api/upload route, which reads CLOUDINARY_CLOUD_NAME
// and CLOUDINARY_UPLOAD_PRESET secrets. If the server route is unavailable or
// encounters an environment issue, falls back to direct unsigned upload to guarantee
// reliable photo uploads across all browser environments.

export async function uploadToCloudinary(file: File, source?: string, scopeToken?: string): Promise<string> {
  const r = await uploadFileToCloudinary(file, source, scopeToken)
  return r.url
}

export type UploadResult = {
  url: string
  filename: string
  resource_type: 'image' | 'raw'
}

/**
 * Direct unsigned upload to Cloudinary as a resilient fallback
 * if the server-side /api/upload proxy is unreachable or unconfigured.
 */
async function uploadDirectToCloudinary(file: File): Promise<UploadResult> {
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    'ddnlacdta'

  const uploadPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    process.env.CLOUDINARY_UPLOAD_PRESET ||
    'shewah-b2b'

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const isImage = file.type.startsWith('image/') || ['png','jpg','jpeg','webp','gif','heic','heif','avif','svg'].includes(ext)
  const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw'

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message || `Cloudinary upload failed (${res.status})`
    )
  }

  const data = await res.json() as { secure_url: string; original_filename?: string }
  return {
    url: data.secure_url,
    filename: file.name || data.original_filename || 'file',
    resource_type: resourceType,
  }
}

/**
 * Upload any file (image, .stl, .3dm, .step, .pdf, etc.) via the server-side
 * proxy with automatic direct unsigned fallback. Returns the resulting URL
 * plus the original filename for display.
 */
export async function uploadFileToCloudinary(file: File, source?: string, scopeToken?: string): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
  if (source) body.append('source', source)
  // Callers with no session of their own (the invite acceptance page) prove
  // themselves with a one-time token instead. Admin/portal/storefront callers
  // are identified by their cookie and need not send this.
  if (scopeToken) body.append('scope_token', scopeToken)

  try {
    const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'include' })

    if (res.ok) {
      const data = await res.json() as UploadResult
      return data
    }

    // If server returned an error (e.g. 500 config error), try direct upload
    return await uploadDirectToCloudinary(file)
  } catch (err) {
    // If network error reaching /api/upload, attempt direct upload
    try {
      return await uploadDirectToCloudinary(file)
    } catch (directErr) {
      // Return the most descriptive error message
      throw err instanceof Error ? err : directErr
    }
  }
}
