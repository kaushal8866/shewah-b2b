/**
 * Live web research for the AURORA copilot.
 *
 * NOTE ON PUPPETEER: this previously imported `puppeteer` at the top level as a
 * headless fallback. That could not work in production — puppeteer is a
 * devDependency, and Vercel prunes those from the runtime; even installed, a
 * bundled Chromium (~170MB) exceeds the 250MB function limit. Worse, the import
 * was static, so resolving it failed for the whole module and could take down
 * /api/aurora/copilot rather than just the fallback.
 *
 * The plain `fetch` path below already handles the two targets this service
 * actually uses (DuckDuckGo HTML and Google News), which serve server-rendered
 * markup. Headless Chrome bought nothing for extracting text snippets.
 */

export interface ScrapedData {
  url: string
  title: string
  headings: string[]
  metaDescription: string
  textSnippet: string
  extractedPrices: string[]
  timestamp: string
}

/**
 * Hosts that must never be fetched server-side. A request originating from the
 * server carries its network position — reaching these would expose cloud
 * credentials or internal services.
 */
function isBlockedHost(hostname: string): boolean {
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

export class WebScraperService {
  /**
   * Fetches a page and extracts title, headings, prices and a text snippet.
   *
   * Only the search URLs this service builds itself are passed in today, but
   * this is a public method taking an arbitrary URL — so the guard lives here
   * rather than relying on every future caller to be careful.
   */
  static async scrapeUrl(url: string): Promise<ScrapedData> {
    const timestamp = new Date().toISOString()

    const neutral = (reason: string): ScrapedData => ({
      url,
      title: 'Real-Time Web Feed',
      headings: [],
      metaDescription: reason,
      textSnippet: '',
      extractedPrices: [],
      timestamp,
    })

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      console.warn('[WebScraperService] rejected unparseable URL')
      return neutral('Invalid URL.')
    }
    // https only — blocks file:, data:, gopher: and plaintext interception.
    if (parsed.protocol !== 'https:') {
      console.warn(`[WebScraperService] rejected non-https protocol: ${parsed.protocol}`)
      return neutral('Only https sources are permitted.')
    }
    if (isBlockedHost(parsed.hostname)) {
      console.warn(`[WebScraperService] rejected internal host: ${parsed.hostname}`)
      return neutral('Internal hosts are not permitted.')
    }

    try {
      // 1. Try lightweight HTTP fetch first
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const html = await response.text()
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : 'Web Resource'

        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
        const metaDescription = metaMatch ? metaMatch[1].trim() : ''

        // Extract headings
        const headingMatches = Array.from(html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi))
        const headings = headingMatches.map((m) => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 8)

        // Extract currency / price patterns (₹, $, €)
        const priceMatches = Array.from(html.matchAll(/(?:₹|\$|€|INR|USD)\s?\d+(?:,\d+)*(?:\.\d+)?/g))
        const extractedPrices = Array.from(new Set(priceMatches.map((m) => m[0]))).slice(0, 10)

        // Strip HTML tags for text snippet
        const cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const textSnippet = cleanText.substring(0, 600)

        return {
          url,
          title,
          headings,
          metaDescription,
          textSnippet,
          extractedPrices,
          timestamp,
        }
      }
    } catch (fetchErr) {
      console.warn(`[WebScraperService] fetch failed for ${url}:`, fetchErr)
    }

    // Neutral shape on failure — callers treat scraped data as optional
    // context, so a miss must degrade rather than throw.
    return {
      url,
      title: 'Real-Time Web Feed',
      headings: [],
      metaDescription: 'Source unavailable or did not respond in time.',
      textSnippet: '',
      extractedPrices: [],
      timestamp,
    }
  }

  /**
   * Performs live real-time market search research for a topic query using live DuckDuckGo & Web Search feeds.
   */
  static async searchMarketData(topic: string): Promise<{
    topic: string
    summary: string
    sourcesScraped: string[]
    timestamp: string
  }> {
    const timestamp = new Date().toISOString()
    const cleanTopic = topic.replace(/[^a-zA-Z0-9\s]/g, '').trim()
    const encodedTopic = encodeURIComponent(cleanTopic)
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodedTopic}`

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (response.ok) {
        const html = await response.text()
        const snippetMatches = Array.from(html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g))
        const snippets = snippetMatches
          .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim())
          .filter((s) => s.length > 20)
          .slice(0, 3)

        if (snippets.length > 0) {
          const summary = snippets.join('\n\n• ')
          return {
            topic,
            summary: `• ${summary}`,
            sourcesScraped: [targetUrl],
            timestamp,
          }
        }
      }
    } catch (err) {
      console.warn('[WebScraperService] DuckDuckGo search snippet fetch failed, falling back to page scrape:', err)
    }

    // Fallback page scrape
    const fallbackUrl = `https://news.google.com/search?q=${encodedTopic}&hl=en-IN&gl=IN&ceid=IN:en`
    const scraped = await this.scrapeUrl(fallbackUrl)

    const summary = scraped.textSnippet
      ? `${scraped.title}: ${scraped.textSnippet.substring(0, 300)}...`
      : `Real-time search feed indexed for "${topic}".`

    return {
      topic,
      summary,
      sourcesScraped: [fallbackUrl],
      timestamp,
    }
  }
}
