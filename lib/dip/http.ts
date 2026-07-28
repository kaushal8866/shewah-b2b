/**
 * Outbound HTTP for the DIP corpus.
 *
 * This code runs unattended, every week, against other people's servers. Two
 * consequences shape it:
 *
 *   1. Be a good client. Identify honestly, space requests out, honour
 *      Retry-After, and give up rather than hammer. A source that blocks us is
 *      a permanent hole in the time series — politeness is self-interested.
 *   2. Be a careful one. `base_url` comes from a database row, so the SSRF
 *      guard belongs here rather than at every call site. Same reasoning as
 *      lib/aurora/infrastructure/WebScraperService.ts, whose guard this mirrors.
 */

/** Identifies the crawler and gives an operator a way to reach us. */
export const DIP_USER_AGENT =
  'ShewahDIP/1.0 (+https://shewah.co; research crawler; contact via website)'

/** Minimum gap between two requests to the same host. */
export const MIN_HOST_DELAY_MS = 1000

const REQUEST_TIMEOUT_MS = 20_000
const MAX_ATTEMPTS = 3

/**
 * Hosts that must never be fetched server-side. Ported from WebScraperService
 * so both crawlers fail closed the same way; a request from the server carries
 * its network position, and reaching these would expose cloud credentials or
 * internal services.
 */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()

  // Cloud instance metadata — the classic SSRF payoff.
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true

  // Loopback and unqualified internal names.
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true
  if (h === '0.0.0.0' || h === '[::1]' || h === '::1') return true

  // Private and link-local IPv4.
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
  }

  return false
}

/** Throws when a URL is unfetchable by policy. Callers should not catch this. */
export function assertFetchable(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Unparseable URL: ${url}`)
  }
  // https only — blocks file:, data:, and plaintext interception.
  if (parsed.protocol !== 'https:') {
    throw new Error(`Only https is permitted, got ${parsed.protocol}`)
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`Internal host is not permitted: ${parsed.hostname}`)
  }
  return parsed
}

const lastRequestAt = new Map<string, number>()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Space requests to a host, so a wide catalogue never becomes a burst. */
async function throttle(hostname: string): Promise<void> {
  const previous = lastRequestAt.get(hostname)
  if (previous !== undefined) {
    const wait = MIN_HOST_DELAY_MS - (Date.now() - previous)
    if (wait > 0) await sleep(wait)
  }
  lastRequestAt.set(hostname, Date.now())
}

export interface FetchJsonResult<T> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

/**
 * Fetch JSON with throttling, timeout and bounded retry.
 *
 * Returns a result rather than throwing on HTTP failure: one brand returning
 * 403 must not abort the other brands in the run, and the status code itself is
 * data we record in `dip_ingest_runs`. Policy violations (non-https, internal
 * host) still throw, because those are bugs rather than conditions.
 */
export async function fetchJson<T>(url: string): Promise<FetchJsonResult<T>> {
  const parsed = assertFetchable(url)
  let lastError = 'unknown error'
  let lastStatus = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle(parsed.hostname)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': DIP_USER_AGENT,
          Accept: 'application/json',
        },
      })
      lastStatus = res.status

      // 429/503 are the server asking us to back off. Obey it, within reason.
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 60_000)
          : attempt * 5_000
        lastError = `HTTP ${res.status}; backing off ${waitMs}ms`
        if (attempt < MAX_ATTEMPTS) {
          await sleep(waitMs)
          continue
        }
        return { ok: false, status: res.status, data: null, error: lastError }
      }

      // Other 5xx are transient. Observed live: limelightdiamonds.com returns
      // 500 on one pagination page while the pages either side serve fine.
      // Treating that as final silently truncated the catalogue by 3,500
      // designs, so retry before believing it.
      if (res.status >= 500) {
        lastError = `HTTP ${res.status}`
        if (attempt < MAX_ATTEMPTS) {
          await sleep(attempt * 2_000)
          continue
        }
        return { ok: false, status: res.status, data: null, error: lastError }
      }

      if (!res.ok) {
        // 4xx are settled answers — this brand is not readable this way.
        // Retrying wastes their capacity and ours.
        return { ok: false, status: res.status, data: null, error: `HTTP ${res.status}` }
      }

      const data = (await res.json()) as T
      return { ok: true, status: res.status, data, error: null }
    } catch (err: any) {
      lastError = err?.name === 'AbortError'
        ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
        : err?.message || String(err)
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 2_000)
    } finally {
      clearTimeout(timer)
    }
  }

  return { ok: false, status: lastStatus, data: null, error: lastError }
}
