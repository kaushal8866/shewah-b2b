import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bespoke Diamond Jewellery Commissions',
  description:
    'Commission one-of-a-kind engagement rings, bridal suites, and fine diamond jewellery directly with Shewah master artisans in solid 18K gold.',
  alternates: {
    canonical: 'https://shewah.co/bespoke',
  },
  openGraph: {
    title: 'Bespoke Diamond Jewellery Commissions | SHEWAH',
    description:
      'Commission one-of-a-kind engagement rings, bridal suites, and fine diamond jewellery directly with Shewah master artisans in solid 18K gold.',
    url: 'https://shewah.co/bespoke',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

export default function BespokeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
