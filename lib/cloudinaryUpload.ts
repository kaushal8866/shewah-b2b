// Uploads via the server-side /api/upload route, which reads CLOUDINARY_CLOUD_NAME
// and CLOUDINARY_UPLOAD_PRESET secrets. No Cloudinary credentials are exposed to
// the browser.
export async function uploadToCloudinary(file: File): Promise<string> {
  const r = await uploadFileToCloudinary(file)
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
export async function uploadFileToCloudinary(file: File): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch('/api/upload', { method: 'POST', body })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error || `Upload failed (${res.status})`
    )
  }

  const data = await res.json() as UploadResult
  return data
}
