const ALLOWED_HOST_SUFFIXES = [
  '.cloudinary.com',
  'res.cloudinary.com',
  '.supabase.co',
  '.supabase.in',
]

export function isAllowedAssetUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return ALLOWED_HOST_SUFFIXES.some(s => s.startsWith('.') ? host.endsWith(s) : host === s)
  } catch { return false }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return String(d)
  }
}

export function safeName(s: string, fallback: string): string {
  const cleaned = (s || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
  return cleaned || fallback
}

export async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    if (!isAllowedAssetUrl(url)) return null
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

