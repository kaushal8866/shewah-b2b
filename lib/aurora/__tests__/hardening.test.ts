import { describe, it, expect } from 'vitest'
import { sanitizeActions } from '../infrastructure/LLMSynthesisEngine'
import { WebScraperService } from '../infrastructure/WebScraperService'

/**
 * NOTE: vitest is not a dependency on `main` — it arrives with the audit
 * branch (PR #7). This file is written against that setup rather than adding
 * vitest here, which would conflict on package.json. It runs as soon as PR #7
 * merges; until then it is inert.
 */

describe('suggestedActions sanitisation (prompt-injection defence)', () => {
  it('keeps actions that point at real routes', () => {
    const out = sanitizeActions(['View Orders (/orders)', 'Check Cash Book (/cash)'])
    expect(out).toEqual(['View Orders (/orders)', 'Check Cash Book (/cash)'])
  })

  it('strips the link from a route the app does not serve', () => {
    // The prompt contains scraped third-party text, so the model could be
    // steered into emitting a route that does not exist. Keep the advice,
    // drop the link.
    const out = sanitizeActions(['Do something (/evil-admin-backdoor)'])
    expect(out).toEqual(['Do something'])
  })

  it('strips an absolute external URL', () => {
    const out = sanitizeActions(['Click here (https://attacker.example/steal)'])
    expect(out).toEqual(['Click here'])
  })

  it('falls back when given nothing usable', () => {
    expect(sanitizeActions(undefined)).toEqual(['View Overview (/dashboard)'])
    expect(sanitizeActions([])).toEqual(['View Overview (/dashboard)'])
    expect(sanitizeActions([123, null])).toEqual(['View Overview (/dashboard)'])
  })

  it('caps the list and the length of each entry', () => {
    const out = sanitizeActions(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(out).toHaveLength(4)
    expect(sanitizeActions(['x'.repeat(500)])[0].length).toBeLessThanOrEqual(120)
  })
})

describe('scrapeUrl SSRF guard', () => {
  // Each returns the neutral shape rather than throwing, so a blocked target
  // degrades the answer instead of breaking the request.
  it('refuses cloud instance metadata', async () => {
    const r = await WebScraperService.scrapeUrl('https://169.254.169.254/latest/meta-data/')
    expect(r.metaDescription).toMatch(/Internal hosts/i)
    expect(r.textSnippet).toBe('')
  })

  it('refuses loopback and private ranges', async () => {
    for (const u of [
      'https://localhost/admin',
      'https://127.0.0.1/',
      'https://10.0.0.5/',
      'https://192.168.1.1/',
      'https://172.16.0.1/',
      'https://metadata.google.internal/',
    ]) {
      const r = await WebScraperService.scrapeUrl(u)
      expect(r.metaDescription, u).toMatch(/Internal hosts/i)
    }
  })

  it('refuses non-https schemes', async () => {
    for (const u of ['http://example.com/', 'file:///etc/passwd']) {
      const r = await WebScraperService.scrapeUrl(u)
      expect(r.metaDescription, u).toMatch(/https/i)
    }
  })

  it('allows a normal public https host through the guard', async () => {
    // Reaches the fetch stage — the guard is not what stops it.
    const r = await WebScraperService.scrapeUrl('https://example.com/')
    expect(r.metaDescription).not.toMatch(/Internal hosts|Only https/i)
  })
})
