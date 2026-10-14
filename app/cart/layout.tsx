import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shopping Bag',
  description: 'Review your selected made-to-order fine jewellery pieces from Shewah Atelier.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://shewah.co/cart',
  },
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
