import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Consultation Confirmed | Shewah Atelier',
  description: 'Your bespoke diamond jewellery consultation with Shewah Atelier has been confirmed.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://shewah.co/consultation/thank-you',
  },
}

export default function ConsultationThankYouLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
