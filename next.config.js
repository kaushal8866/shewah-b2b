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
}

module.exports = nextConfig
