import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Private Client Concierge',
  description:
    'Connect with the Shewah Atelier private client concierge for bespoke commissions, diamond certification enquiries, and international order assistance.',
  alternates: {
    canonical: 'https://shewah.co/contact',
  },
  openGraph: {
    title: 'Contact Private Client Concierge | SHEWAH',
    description:
      'Connect with the Shewah Atelier private client concierge for bespoke commissions, diamond certification enquiries, and international order assistance.',
    url: 'https://shewah.co/contact',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
