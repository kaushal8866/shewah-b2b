import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './consultation.css'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bespoke Jewellery Design Consultation | SHEWAH',
  description: 'Co-create solid gold & certified lab-grown diamond jewellery with our master designers. Zero obligation. Private digital CAD previews.',
  alternates: { canonical: '/consultation' },
  openGraph: {
    title: 'Bespoke Jewellery Design Consultation | SHEWAH',
    description: 'Co-create solid gold & certified lab-grown diamond jewellery with our master designers. Zero obligation. Private digital CAD previews.',
    url: '/consultation',
    type: 'website',
    siteName: 'Shewah',
  },
  robots: { index: true, follow: true },
}

export default function ConsultationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${sans.variable} consultation-shell min-h-screen bg-[#070A11] text-[#E2E8F0]`}>
      {children}
    </div>
  )
}
