import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Diamond Rings in Surat | Bespoke Jewellery by Shewah',
  description:
    'Handcrafted custom diamond rings made to order in our Surat atelier. Design your bespoke ring with lab-grown, natural, or gemstone diamonds in solid gold with transparent Indian pricing.',
  alternates: {
    canonical: 'https://shewah.co/bespoke',
  },
  openGraph: {
    title: 'Custom Diamond Rings in Surat | Bespoke Jewellery by Shewah',
    description:
      'Handcrafted custom diamond rings made to order in our Surat atelier. Design your bespoke ring with lab-grown, natural, or gemstone diamonds in solid gold.',
    url: 'https://shewah.co/bespoke',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

export default function BespokeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
