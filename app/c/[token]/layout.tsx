/**
 * Layout boundary for the consumer-skin journey page (`/c/[token]`).
 *
 * - Loads Cormorant Garamond as the serif heading font (next/font/google).
 * - Wraps the page in the consumer palette tokens.
 * - Bypasses the admin AppShell entirely (the parent layout does the same
 *   public-route detection — we add `/c` to its allow-list).
 */
import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './consumer.css'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-consumer-serif',
  display: 'swap',
})

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-consumer-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Your custom piece — Shewah Jewellery',
  description: 'Track your custom Shewah piece from quote to delivery.',
}

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${sans.variable} consumer-shell min-h-screen bg-[#FBF7F0] text-[#2A241B]`}>
      {children}
    </div>
  )
}
