import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Apply for a Trade Account | Shewah Business',
  description:
    'Apply for a verified Shewah B2B retail partner and jewellery manufacturing trade account.',
  alternates: {
    canonical: 'https://shewah.co/apply',
  },
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
