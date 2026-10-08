import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://shewah.co'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/admin',
          '/admin/',
          '/portal',
          '/portal/',
          '/dashboard',
          '/dashboard/',
          '/settings',
          '/editorial',
          '/editorial/',
          '/api/',
          '/*?*preview=*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
