/**
 * Layout boundary for the consumer-skin journey page (`/c/[token]`).
 *
 * - Loads Cormorant Garamond as the serif heading font (next/font/google).
 * - Wraps the page in the consumer palette tokens.
 * - Bypasses the admin AppShell entirely (the parent layout does the same
 *   public-route detection — we add `/c` to its allow-list).
 */
import type { Metadata } from 'next'
import './consumer.css'

export const metadata: Metadata = {
  title: 'Your custom piece — Shewah Jewellery',
  description: 'Track your custom Shewah piece from quote to delivery.',
}

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div className="consumer-shell min-h-screen bg-white text-stone-800">
        {children}
      </div>
    </>
  )
}
