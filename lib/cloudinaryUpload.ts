// Uploads via the server-side /api/upload route, which reads CLOUDINARY_CLOUD_NAME
// and CLOUDINARY_UPLOAD_PRESET secrets. No Cloudinary credentials are exposed to
// the browser.
export async function uploadToCloudinary(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch('/api/upload', { method: 'POST', body })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: string }).error || `Upload failed (${res.status})`
    )
  }

  const data = await res.json() as { url: string }
  return data.url
}
