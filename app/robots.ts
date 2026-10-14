import { MetadataRoute } from 'next'

const PUBLIC_ALLOW_PATHS = [
  '/',
  '/api/blog/v1/media/',
  '/api/d2c/',
  '/api/public/',
]

const PRIVATE_DISALLOW_PATHS = [
  '/admin',
  '/admin/',
  '/portal',
  '/portal/',
  '/dashboard',
  '/dashboard/',
  '/settings',
  '/editorial',
  '/editorial/',
  '/api/admin/',
  '/api/portal/',
  '/api/db',
  '/api/auth/',
  '/api/blog/v1/drafts',
  '/api/blog/v1/posts',
  '/api/',
  '/*?*preview=*',
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://shewah.co'

  return {
    rules: [
      // Search & user-triggered retrieval crawlers: allow public storefront, blog media, and D2C catalog API;
      // retain all private/admin/portal/editorial path exclusions.
      // Note: /login uses <meta name="robots" content="noindex, nofollow"> + X-Robots-Tag instead of Disallow
      // so crawlers following header/trade links can read the noindex directive without reporting a blocked page.
      {
        userAgent: [
          'Googlebot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'Perplexity-User',
          'Claude-User',
          'Claude-SearchBot',
        ],
        allow: PUBLIC_ALLOW_PATHS,
        disallow: PRIVATE_DISALLOW_PATHS,
      },
      // Google-Extended controls Gemini training & grounding (does not affect Google Search inclusion/ranking).
      // Owner policy option: change allow/disallow to disallow: ['/'] if opting out of Gemini training.
      {
        userAgent: 'Google-Extended',
        allow: PUBLIC_ALLOW_PATHS,
        disallow: PRIVATE_DISALLOW_PATHS,
      },
      {
        userAgent: '*',
        allow: PUBLIC_ALLOW_PATHS,
        disallow: PRIVATE_DISALLOW_PATHS,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
