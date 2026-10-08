/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Type errors and lint errors MUST fail the build. These were previously
  // both set to ignore, which is how 21 guaranteed runtime crashes — undefined
  // variables and temporal-dead-zone reads that killed entire modules in
  // production — shipped while the build reported success. Do not re-enable.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
  async headers() {
    return [
      {
        source: '/editorial/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
