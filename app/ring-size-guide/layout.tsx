import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'International Ring Size Guide & Interactive Sizer',
  description:
    'Find your accurate ring size at home with our interactive on-screen sizer, circumference calculator, and US, UK, EU, and Indian conversion chart.',
  alternates: {
    canonical: 'https://shewah.co/ring-size-guide',
  },
  openGraph: {
    title: 'International Ring Size Guide & Interactive Sizer | SHEWAH',
    description:
      'Find your accurate ring size at home with our interactive on-screen sizer, circumference calculator, and US, UK, EU, and Indian conversion chart.',
    url: 'https://shewah.co/ring-size-guide',
    siteName: 'SHEWAH',
    type: 'website',
  },
}

export default function RingSizeGuideLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
