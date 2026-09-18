import type { Metadata } from 'next'
import './consultation.css'

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
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className="consultation-shell min-h-screen bg-stone-900 text-[rgba(255,255,255,0.90)]">
        {children}
      </div>
    </>
  )
}
