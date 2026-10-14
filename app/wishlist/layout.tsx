import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Saved Creations | Wishlist',
  description: 'Your saved fine jewellery creations from Shewah Atelier.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://shewah.co/wishlist',
  },
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
