// Uploads via the server-side /api/upload route, which reads CLOUDINARY_CLOUD_NAME
// and CLOUDINARY_UPLOAD_PRESET secrets. No Cloudinary credentials are exposed to
// the browser.
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
 * Upload any file (image, .stl, .3dm, .step, .pdf, etc.) to Cloudinary via
 * the server-side proxy. Returns the resulting URL plus the original filename
 * for display.
 */
export async function uploadFileToCloudinary(file: File, source?: string, scopeToken?: string): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
  if (source) body.append('source', source)
  // Callers with no session of their own (the invite acceptance page) prove
  // themselves with a one-time token instead. Admin/portal/storefront callers
  // are identified by their cookie and need not send this.
  if (scopeToken) body.append('scope_token', scopeToken)

  const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'include' })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error || `Upload failed (${res.status})`
    )
  }

  const data = await res.json() as UploadResult
  return data
}
