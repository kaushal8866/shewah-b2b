import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fine Diamond Jewellery Collection',
  description:
    'Explore handcrafted fine diamond rings, necklaces, earrings, bracelets, and coordinated suites individually made to order in precious metals and solid gold.',
  alternates: {
    canonical: 'https://shewah.co/jewellery',
  },
  openGraph: {
    title: 'Fine Diamond Jewellery Collection | SHEWAH',
    description:
      'Explore handcrafted fine diamond rings, necklaces, earrings, bracelets, and coordinated suites individually made to order in precious metals and solid gold.',
    url: 'https://shewah.co/jewellery',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

export default function JewelleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
