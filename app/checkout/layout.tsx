import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private Client Checkout',
  description: 'Complete your bespoke fine jewellery order with Shewah Atelier.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://shewah.co/checkout',
  },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
